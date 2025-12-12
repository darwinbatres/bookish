import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getS3Client, fileExistsInS3, isS3Configured } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { withAuth } from "@/lib/api";
import { config as appConfig } from "@/lib/config";
import type { ApiError } from "@/types";

// Next.js API config: disable response size limit for streaming large files
export const config = {
  api: {
    responseLimit: false,
  },
};

// Request validation schema
const streamSchema = z.object({
  s3Key: z.string().min(1, "S3 key is required"),
});

/**
 * Proxy endpoint that streams files from S3 through the app server.
 *
 * Benefits:
 * - Only the app needs to be exposed to the internet (via Cloudflare Tunnel)
 * - S3/MinIO stays internal and never accessible from outside
 * - Works on all devices (mobile, desktop) without localhost issues
 * - Better security: presigned URLs and S3 credentials never leave the server
 *
 * This is the industry-standard API Gateway pattern.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Buffer | ApiError>
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET requests are allowed",
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
    // Validate query params
    const result = streamSchema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        error: "Bad Request",
        message: result.error.issues.map((e) => e.message).join(", "),
        statusCode: 400,
      });
    }

    const { s3Key } = result.data;

    // Security: Validate s3Key format to prevent directory traversal
    // Allow both books/* and covers/* paths
    const isValidPath =
      !s3Key.includes("..") &&
      (s3Key.startsWith("books/") || s3Key.startsWith("covers/"));

    if (!isValidPath) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid S3 key format",
        statusCode: 400,
      });
    }

    // Check if file exists
    const exists = await fileExistsInS3(s3Key);
    if (!exists) {
      return res.status(404).json({
        error: "Not Found",
        message: "File not found in storage",
        statusCode: 404,
      });
    }

    // Get file from S3
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: appConfig.s3.bucket,
      Key: s3Key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve file from storage",
        statusCode: 500,
      });
    }

    // Determine content type from file extension
    const ext = s3Key.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      // Books
      pdf: "application/pdf",
      epub: "application/epub+zip",
      // Cover images
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const contentType = contentTypes[ext || ""] || "application/octet-stream";

    // Set response headers
    res.setHeader("Content-Type", contentType);
    if (response.ContentLength) {
      res.setHeader("Content-Length", response.ContentLength);
    }
    // Cache for 1 hour (files don't change once uploaded)
    res.setHeader("Cache-Control", "private, max-age=3600");

    // Stream the response
    const stream = response.Body as NodeJS.ReadableStream;
    stream.pipe(res);
  } catch (error) {
    console.error("[API] Error streaming file:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to stream file",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
