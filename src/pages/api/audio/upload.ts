import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File } from "formidable";
import fs from "fs/promises";
import {
  uploadToS3,
  generateAudioS3Key,
  isValidAudioContentType,
  isS3Configured,
} from "@/lib/s3";
import { withAuth } from "@/lib/api";
import { getAudioMaxSizeMB } from "@/lib/db";
import type { ApiError } from "@/types";

// Disable Next.js body parser to handle multipart form data
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

interface UploadResponse {
  s3Key: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ApiError>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only POST requests are allowed",
      statusCode: 405,
    });
  }

  if (!isS3Configured()) {
    return res.status(503).json({
      error: "Service Unavailable",
      message: "S3 storage is not configured",
      statusCode: 503,
    });
  }

  try {
    // Get max file size from database settings for audio
    const audioMaxSizeMB = await getAudioMaxSizeMB();
    const maxSizeBytes = audioMaxSizeMB * 1024 * 1024;

    // Parse form data
    const form = new IncomingForm({
      maxFileSize: maxSizeBytes,
      keepExtensions: true,
    });

    const { fields, files } = await new Promise<{
      fields: Record<string, string | string[]>;
      files: Record<string, File | File[]>;
    }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else
          resolve({
            fields: fields as Record<string, string | string[]>,
            files: files as Record<string, File | File[]>,
          });
      });
    });

    // Get trackId from fields
    const trackIdField = fields.trackId;
    const trackId = Array.isArray(trackIdField)
      ? trackIdField[0]
      : trackIdField;

    if (!trackId || typeof trackId !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "trackId is required",
        statusCode: 400,
      });
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trackId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid track ID format",
        statusCode: 400,
      });
    }

    // Get the uploaded file
    const fileField = files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    if (!file) {
      return res.status(400).json({
        error: "Bad Request",
        message: "No file uploaded",
        statusCode: 400,
      });
    }

    // Validate content type
    const contentType = file.mimetype || "application/octet-stream";
    if (!isValidAudioContentType(contentType)) {
      // Clean up the temp file
      await fs.unlink(file.filepath).catch(() => {});
      return res.status(400).json({
        error: "Bad Request",
        message: `Invalid file type: ${contentType}. Allowed: mp3, wav, ogg, m4a, flac, aac, webm`,
        statusCode: 400,
      });
    }

    // Read file into buffer
    const buffer = await fs.readFile(file.filepath);

    // Generate S3 key
    const originalFilename = file.originalFilename || "audio.mp3";
    const s3Key = generateAudioS3Key(trackId, originalFilename);

    // Upload to S3
    await uploadToS3(s3Key, buffer, contentType);

    // Clean up temp file
    await fs.unlink(file.filepath).catch(() => {});

    return res.status(200).json({ s3Key });
  } catch (error) {
    console.error("[API] Audio upload error:", error);

    // Handle file size exceeded
    if ((error as { code?: string }).code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "Payload Too Large",
        message: "File size exceeds the maximum allowed limit",
        statusCode: 413,
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to upload audio file",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
