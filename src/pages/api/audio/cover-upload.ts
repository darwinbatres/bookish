import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File } from "formidable";
import fs from "fs/promises";
import {
  uploadToS3,
  generateAudioCoverS3Key,
  isValidCoverContentType,
  isS3Configured,
} from "@/lib/s3";
import { withAuth } from "@/lib/api";
import { getCoverMaxSizeMB } from "@/lib/db/repositories/settings";
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
    // Get max cover size from database
    const maxSizeMB = await getCoverMaxSizeMB();
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

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

    const contentType = file.mimetype || "application/octet-stream";
    const originalFilename = file.originalFilename || "cover.jpg";

    // Helper to clean up temp file
    const cleanupTempFile = () => fs.unlink(file.filepath).catch(() => {});

    // Validate content type
    if (!isValidCoverContentType(contentType)) {
      await cleanupTempFile();
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.",
        statusCode: 400,
      });
    }

    // Validate file size (double-check after upload)
    if (file.size > maxSizeBytes) {
      await cleanupTempFile();
      return res.status(400).json({
        error: "Bad Request",
        message: `Cover size exceeds maximum allowed size of ${maxSizeMB}MB`,
        statusCode: 400,
      });
    }

    // Read file and upload to S3
    const fileBuffer = await fs.readFile(file.filepath);
    const s3Key = generateAudioCoverS3Key(trackId, originalFilename);

    await uploadToS3(s3Key, fileBuffer, contentType);

    // Clean up temp file
    await cleanupTempFile();

    return res.status(200).json({ s3Key });
  } catch (error) {
    console.error("[API] Audio cover upload error:", error);

    // Handle file size exceeded error from formidable
    if (error instanceof Error && error.message.includes("maxFileSize")) {
      const maxSizeMB = await getCoverMaxSizeMB();
      return res.status(400).json({
        error: "Bad Request",
        message: `Cover size exceeds maximum allowed size of ${maxSizeMB}MB`,
        statusCode: 400,
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to upload cover",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
