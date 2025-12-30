import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getS3Client, isS3Configured } from "@/lib/s3";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { withAuth } from "@/lib/api";
import { config as appConfig } from "@/lib/config";
import type { ApiError } from "@/types";
import type { Readable } from "stream";

// Next.js API config: disable response size limit for streaming large files
export const config = {
  api: {
    responseLimit: false,
  },
};

// Timeout for S3 operations (30 seconds - well under Cloudflare's 100s limit)
const S3_TIMEOUT_MS = 30000;

// Stream idle timeout (if no data flows for this long, abort)
const STREAM_IDLE_TIMEOUT_MS = 15000;

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

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
  // Allow books/*, covers/*, audio/*, audio-covers/*, video/*, video-covers/*, images/*, and folder-covers/* paths
  const isValidPath =
    !s3Key.includes("..") &&
    (s3Key.startsWith("books/") ||
      s3Key.startsWith("covers/") ||
      s3Key.startsWith("audio/") ||
      s3Key.startsWith("audio-covers/") ||
      s3Key.startsWith("video/") ||
      s3Key.startsWith("video-covers/") ||
      s3Key.startsWith("images/") ||
      s3Key.startsWith("folder-covers/"));

  if (!isValidPath) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid S3 key format",
      statusCode: 400,
    });
  }

  // Track if we've started streaming (for cleanup)
  let streamStarted = false;
  let stream: Readable | null = null;
  let idleTimer: NodeJS.Timeout | null = null;

  // Cleanup function
  const cleanup = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (stream) {
      stream.destroy();
      stream = null;
    }
  };

  // Handle client disconnect
  req.on("close", () => {
    if (streamStarted) {
      cleanup();
    }
  });

  try {
    const client = getS3Client();

    // First check if file exists and get metadata (with timeout)
    const headCommand = new HeadObjectCommand({
      Bucket: appConfig.s3.bucket,
      Key: s3Key,
    });

    let fileSize: number;
    let contentType: string | undefined;

    try {
      const headResponse = await withTimeout(
        client.send(headCommand),
        S3_TIMEOUT_MS,
        "S3 metadata request timed out"
      );
      fileSize = headResponse.ContentLength || 0;
      contentType = headResponse.ContentType;

      // Reject empty files
      if (fileSize === 0) {
        return res.status(404).json({
          error: "Not Found",
          message: "File is empty or corrupted",
          statusCode: 404,
        });
      }
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes("timed out")) {
        console.error("[API] S3 HEAD request timed out for:", s3Key);
        return res.status(504).json({
          error: "Gateway Timeout",
          message: "Storage service is slow or unavailable",
          statusCode: 504,
        });
      }
      // NoSuchKey or other S3 errors
      console.error("[API] S3 HEAD error for", s3Key, ":", err.message);
      return res.status(404).json({
        error: "Not Found",
        message: "File not found in storage",
        statusCode: 404,
      });
    }

    // Get file from S3 (with timeout)
    const command = new GetObjectCommand({
      Bucket: appConfig.s3.bucket,
      Key: s3Key,
    });

    let response;
    try {
      response = await withTimeout(
        client.send(command),
        S3_TIMEOUT_MS,
        "S3 download request timed out"
      );
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes("timed out")) {
        console.error("[API] S3 GET request timed out for:", s3Key);
        return res.status(504).json({
          error: "Gateway Timeout",
          message: "Storage service is slow or unavailable",
          statusCode: 504,
        });
      }
      throw error;
    }

    if (!response.Body) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve file from storage",
        statusCode: 500,
      });
    }

    // Determine content type from file extension if not provided by S3
    if (!contentType) {
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
        avif: "image/avif",
        svg: "image/svg+xml",
      };
      contentType = contentTypes[ext || ""] || "application/octet-stream";
    }

    // Set response headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", fileSize);
    // Cache for 1 hour (files don't change once uploaded)
    res.setHeader("Cache-Control", "private, max-age=3600");

    // Mark streaming as started
    streamStarted = true;
    stream = response.Body as Readable;

    // Reset idle timer on each data chunk
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.error("[API] Stream idle timeout for:", s3Key);
        cleanup();
        if (!res.writableEnded) {
          res.end();
        }
      }, STREAM_IDLE_TIMEOUT_MS);
    };

    // Start idle timer
    resetIdleTimer();

    // Handle data flow
    stream.on("data", () => {
      resetIdleTimer();
    });

    // Handle stream completion
    stream.on("end", () => {
      cleanup();
    });

    // Handle stream errors
    stream.on("error", (error) => {
      console.error("[API] Stream error for", s3Key, ":", error);
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          message: "Stream error while reading file",
          statusCode: 500,
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    });

    // Pipe the stream to response
    stream.pipe(res);

  } catch (error) {
    cleanup();
    console.error("[API] Error streaming file:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to stream file",
        statusCode: 500,
      });
    }
  }
}

export default withAuth(handler);
