import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File } from "formidable";
import fs from "fs/promises";
import {
  uploadToS3,
  generateBookS3Key,
  isValidContentType,
  isS3Configured,
} from "@/lib/s3";
import { withAuth } from "@/lib/api";
import { getUploadMaxSizeMB } from "@/lib/db";
import type { ApiError } from "@/types";

// Disable Next.js body parser to handle multipart form data
// responseLimit: false allows streaming large responses if needed
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
    // Get max file size from database
    const maxSizeMB = await getUploadMaxSizeMB();
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

    // Get bookId from fields
    const bookIdField = fields.bookId;
    const bookId = Array.isArray(bookIdField) ? bookIdField[0] : bookIdField;

    if (!bookId || typeof bookId !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "bookId is required",
        statusCode: 400,
      });
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid book ID format",
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
    const originalFilename = file.originalFilename || "upload";

    // Helper to clean up temp file
    const cleanupTempFile = () => fs.unlink(file.filepath).catch(() => {});

    // Validate content type
    if (!isValidContentType(contentType)) {
      await cleanupTempFile();
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Invalid file type. Only PDF, EPUB, and MOBI files are allowed.",
        statusCode: 400,
      });
    }

    // Validate file size (double-check after upload)
    if (file.size > maxSizeBytes) {
      await cleanupTempFile();
      return res.status(400).json({
        error: "Bad Request",
        message: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
        statusCode: 400,
      });
    }

    // Read file and upload to S3
    const fileBuffer = await fs.readFile(file.filepath);
    const s3Key = generateBookS3Key(bookId, originalFilename);

    await uploadToS3(s3Key, fileBuffer, contentType);

    // Clean up temp file
    await cleanupTempFile();

    return res.status(200).json({ s3Key });
  } catch (error) {
    console.error("[API] Upload error:", error);

    // Handle file size exceeded error from formidable
    if (error instanceof Error && error.message.includes("maxFileSize")) {
      const maxSizeMB = await getUploadMaxSizeMB();
      return res.status(400).json({
        error: "Bad Request",
        message: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
        statusCode: 400,
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to upload file",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
