/**
 * Video Stream API
 * GET /api/video/stream - Stream video file from S3 with Range support
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, isS3Configured } from "@/lib/s3";
import { config as appConfig } from "@/lib/config";
import { withAuth } from "@/lib/api";
import type { Readable } from "stream";

// Disable body parser and set no response limit for streaming
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

/**
 * Parse HTTP Range header
 * Format: "bytes=start-end" or "bytes=start-"
 */
function parseRange(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  // Validate range
  if (start >= fileSize) return null;
  if (end >= fileSize) end = fileSize - 1;
  if (start > end) return null;

  return { start, end };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET requests are allowed",
      statusCode: 405,
    });
  }

  const { s3Key } = req.query;

  if (!s3Key || typeof s3Key !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "s3Key query parameter is required",
      statusCode: 400,
    });
  }

  // Security: Validate S3 key format to prevent path traversal attacks
  // Only allow video/* paths, and block directory traversal
  const isValidVideoPath =
    !s3Key.includes("..") &&
    !s3Key.includes("//") &&
    s3Key.startsWith("video/") &&
    /^video\/[a-f0-9-]+\/[^/]+$/.test(s3Key);

  if (!isValidVideoPath) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid S3 key format",
      statusCode: 400,
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
    const client = getS3Client();

    // First, get the file metadata to know the size
    const headCommand = new HeadObjectCommand({
      Bucket: appConfig.s3.bucket,
      Key: s3Key,
    });

    let fileSize: number;
    let contentType: string;

    try {
      const headResponse = await client.send(headCommand);
      fileSize = headResponse.ContentLength || 0;
      contentType = headResponse.ContentType || "video/mp4";
    } catch {
      return res.status(404).json({
        error: "Not Found",
        message: "Video file not found",
        statusCode: 404,
      });
    }

    // Parse Range header if present
    const rangeHeader = req.headers.range;
    let range: { start: number; end: number } | null = null;

    if (rangeHeader) {
      range = parseRange(rangeHeader, fileSize);
      if (!range) {
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).json({
          error: "Range Not Satisfiable",
          message: "Invalid range request",
          statusCode: 416,
        });
      }
    }

    // Build the S3 GetObject command with optional range
    const getCommand = new GetObjectCommand({
      Bucket: appConfig.s3.bucket,
      Key: s3Key,
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    });

    const response = await client.send(getCommand);

    if (!response.Body) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to stream video file",
        statusCode: 500,
      });
    }

    // Set response headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=86400"); // 24 hours

    if (range) {
      // Partial content response
      const contentLength = range.end - range.start + 1;
      res.setHeader("Content-Length", contentLength);
      res.setHeader(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${fileSize}`
      );
      res.status(206);
    } else {
      // Full content response
      res.setHeader("Content-Length", fileSize);
      res.status(200);
    }

    // Stream the response
    const stream = response.Body as Readable;
    stream.pipe(res);

    // Handle stream errors
    stream.on("error", (error) => {
      console.error("[API] Video stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          message: "Failed to stream video file",
          statusCode: 500,
        });
      }
    });
  } catch (error) {
    console.error("[API] Video stream error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to stream video file",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
