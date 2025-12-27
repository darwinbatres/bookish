/**
 * Video Cover Upload API
 * POST /api/video/cover-upload - Upload a video cover/thumbnail image
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File } from "formidable";
import fs from "fs/promises";
import {
  uploadToS3,
  generateVideoCoverS3Key,
  isValidCoverContentType,
  isS3Configured,
  MAX_COVER_SIZE_BYTES,
} from "@/lib/s3";
import { withAuth } from "@/lib/api";
import type { ApiError } from "@/types";

// Disable Next.js body parser
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
    // Parse form data
    const form = new IncomingForm({
      maxFileSize: MAX_COVER_SIZE_BYTES,
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

    // Get videoId from fields
    const videoIdField = fields.videoId;
    const videoId = Array.isArray(videoIdField)
      ? videoIdField[0]
      : videoIdField;

    if (!videoId || typeof videoId !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "videoId is required",
        statusCode: 400,
      });
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(videoId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid video ID format",
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
    if (!isValidCoverContentType(contentType)) {
      await fs.unlink(file.filepath).catch(() => {});
      return res.status(400).json({
        error: "Bad Request",
        message: `Invalid file type: ${contentType}. Allowed: jpeg, png, webp, gif`,
        statusCode: 400,
      });
    }

    // Read file into buffer
    const buffer = await fs.readFile(file.filepath);

    // Generate S3 key
    const originalFilename = file.originalFilename || "cover.jpg";
    const s3Key = generateVideoCoverS3Key(videoId, originalFilename);

    // Upload to S3
    await uploadToS3(s3Key, buffer, contentType);

    // Clean up temp file
    await fs.unlink(file.filepath).catch(() => {});

    return res.status(200).json({ s3Key });
  } catch (error) {
    console.error("[API] Video cover upload error:", error);

    if ((error as { code?: string }).code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "Payload Too Large",
        message: "Cover image size exceeds the maximum allowed limit (5MB)",
        statusCode: 413,
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to upload cover image",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
