import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  generateUploadPresignedUrl,
  generateCoverS3Key,
  isValidCoverContentType,
  isS3Configured,
} from "@/lib/s3";
import { withAuth } from "@/lib/api";
import { getCoverMaxSizeMB } from "@/lib/db/repositories/settings";
import { config } from "@/lib/config";
import type { UploadPresignedUrlResponse, ApiError } from "@/types";

// Request validation schema
const coverUploadUrlSchema = z.object({
  bookId: z.string().uuid("Invalid book ID format"),
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().min(1, "Content type is required"),
  fileSize: z.number().positive("File size must be positive"),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadPresignedUrlResponse | ApiError>
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only POST requests are allowed",
      statusCode: 405,
    });
  }

  // Check if S3 is configured
  if (!isS3Configured()) {
    return res.status(503).json({
      error: "Service Unavailable",
      message: "S3 storage is not configured",
      statusCode: 503,
    });
  }

  try {
    // Validate request body
    const result = coverUploadUrlSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Bad Request",
        message: result.error.issues.map((e) => e.message).join(", "),
        statusCode: 400,
      });
    }

    const { bookId, filename, contentType, fileSize } = result.data;

    // Validate content type (images only)
    if (!isValidCoverContentType(contentType)) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.",
        statusCode: 400,
      });
    }

    // Validate file size against database setting
    const maxCoverSizeMB = await getCoverMaxSizeMB();
    const maxCoverSizeBytes = maxCoverSizeMB * 1024 * 1024;
    if (fileSize > maxCoverSizeBytes) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Cover image size exceeds maximum allowed size of ${maxCoverSizeMB}MB`,
        statusCode: 400,
      });
    }

    // Generate S3 key and presigned URL
    const s3Key = generateCoverS3Key(bookId, filename);
    const expiresIn = config.upload.presignedUrlExpiry;
    const uploadUrl = await generateUploadPresignedUrl(
      s3Key,
      contentType,
      expiresIn
    );

    return res.status(200).json({
      uploadUrl,
      s3Key,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  } catch (error) {
    console.error("[API] Error generating cover upload URL:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate upload URL",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
