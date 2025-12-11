import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  generateDownloadPresignedUrl,
  fileExistsInS3,
  isS3Configured,
} from "@/lib/s3";
import { withAuth } from "@/lib/api";
import { config } from "@/lib/config";
import type { DownloadPresignedUrlResponse, ApiError } from "@/types";

// Request validation schema
const downloadUrlSchema = z.object({
  s3Key: z.string().min(1, "S3 key is required"),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DownloadPresignedUrlResponse | ApiError>
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
    const result = downloadUrlSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Bad Request",
        message: result.error.issues.map((e) => e.message).join(", "),
        statusCode: 400,
      });
    }

    const { s3Key } = result.data;

    // Check if file exists
    const exists = await fileExistsInS3(s3Key);
    if (!exists) {
      return res.status(404).json({
        error: "Not Found",
        message: "File not found in storage",
        statusCode: 404,
      });
    }

    // Generate presigned download URL
    const expiresIn = config.upload.presignedUrlExpiry;
    const downloadUrl = await generateDownloadPresignedUrl(s3Key, expiresIn);

    return res.status(200).json({
      downloadUrl,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  } catch (error) {
    console.error("[API] Error generating download URL:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate download URL",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
