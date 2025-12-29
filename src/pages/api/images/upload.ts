/**
 * Image Upload API - Proxied to S3
 * POST /api/images/upload - Upload an image file
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs/promises";
import crypto from "crypto";
import { withAuth } from "@/lib/api";
import {
  uploadToS3,
  generateImageS3Key,
  isValidImageContentType,
  getImageFormatFromContentType,
} from "@/lib/s3";
import { getUploadMaxSizeMB } from "@/lib/db";
import type { ApiError } from "@/types";

// Disable built-in body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

interface UploadResponse {
  s3Key: string;
  fileSize: number;
  format: string;
  originalFilename: string;
}

type ResponseData = UploadResponse | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only POST method is allowed",
      statusCode: 405,
    });
  }

  try {
    // Get max file size from settings
    const maxSizeMB = await getUploadMaxSizeMB();
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // Parse multipart form data
    const form = formidable({
      maxFileSize: maxSizeBytes,
      filter: ({ mimetype }) => {
        return mimetype ? isValidImageContentType(mimetype) : false;
      },
    });

    const [, files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "No valid image file provided. Supported formats: JPG, PNG, GIF, WebP, SVG, BMP, AVIF, HEIC",
        statusCode: 400,
      });
    }

    // Read file into buffer
    const buffer = await fs.readFile(file.filepath);

    // Generate unique ID and S3 key
    const imageId = crypto.randomUUID();
    const originalFilename = file.originalFilename || "image";
    const s3Key = generateImageS3Key(imageId, originalFilename);
    const contentType = file.mimetype || "image/jpeg";
    const format = getImageFormatFromContentType(contentType);

    // Upload to S3
    await uploadToS3(s3Key, buffer, contentType);

    // Clean up temp file
    await fs.unlink(file.filepath).catch(() => {});

    return res.status(200).json({
      s3Key,
      fileSize: file.size,
      format,
      originalFilename,
    });
  } catch (error) {
    console.error("[API] Error uploading image:", error);

    if ((error as { code?: number }).code === 1009) {
      return res.status(413).json({
        error: "Payload Too Large",
        message: "File size exceeds the maximum allowed",
        statusCode: 413,
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to upload image",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
