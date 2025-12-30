/**
 * Image Stream API - Stream images from S3
 * GET /api/images/stream?s3Key=xxx - Stream an image
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { withAuth } from "@/lib/api";
import { getS3Client, isS3Configured } from "@/lib/s3";
import { config as appConfig } from "@/lib/config";
import type { ApiError } from "@/types";

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

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NodeJS.ReadableStream | ApiError>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET method is allowed",
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

  // Validate the key starts with expected prefixes
  if (!s3Key.startsWith("images/") && !s3Key.startsWith("image-thumbnails/")) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid image key",
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
    let contentType: string;

    try {
      const headResponse = await withTimeout(
        client.send(headCommand),
        S3_TIMEOUT_MS,
        "S3 metadata request timed out"
      );
      fileSize = headResponse.ContentLength || 0;
      contentType = headResponse.ContentType || "image/jpeg";

      // Reject empty files
      if (fileSize === 0) {
        return res.status(404).json({
          error: "Not Found",
          message: "Image is empty or corrupted",
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
        message: "Image not found",
        statusCode: 404,
      });
    }

    // Get the image (with timeout)
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
      return res.status(404).json({
        error: "Not Found",
        message: "Image not found",
        statusCode: 404,
      });
    }

    // Set response headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", fileSize);
    // Cache for 1 year (images rarely change)
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Mark streaming as started
    streamStarted = true;
    stream = response.Body as Readable;

    // Reset idle timer on each data chunk
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.error("[API] Image stream idle timeout for:", s3Key);
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
      console.error("[API] Image stream error:", error);
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          message: "Stream error while reading image",
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
    console.error("[API] Error streaming image:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to stream image",
        statusCode: 500,
      });
    }
  }
}

export default withAuth(handler);
