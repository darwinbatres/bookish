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
  // Only allow audio/* paths, and block directory traversal
  const isValidAudioPath =
    !s3Key.includes("..") &&
    !s3Key.includes("//") &&
    s3Key.startsWith("audio/") &&
    /^audio\/[a-f0-9-]+\/[^/]+$/.test(s3Key);

  if (!isValidAudioPath) {
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
      console.log("[API] Client disconnected, cleaning up audio stream");
      cleanup();
    }
  });

  try {
    const client = getS3Client();

    // First, get the file metadata to know the size (with timeout)
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
      contentType = headResponse.ContentType || "audio/mpeg";

      // Validate file size - reject empty or suspiciously small files
      if (fileSize === 0) {
        return res.status(404).json({
          error: "Not Found",
          message: "Audio file is empty or corrupted",
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
      console.error("[API] S3 HEAD error:", err.message);
      return res.status(404).json({
        error: "Not Found",
        message: "Audio file not found",
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

    // Get the object with timeout
    let response;
    try {
      response = await withTimeout(
        client.send(getCommand),
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
        message: "Failed to stream audio file - no body returned",
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

    // Mark streaming as started
    streamStarted = true;
    stream = response.Body as Readable;

    // Reset idle timer on each data chunk
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.error("[API] Audio stream idle timeout for:", s3Key);
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
      console.error("[API] Audio stream error:", error);
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          message: "Stream error while reading audio file",
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
    console.error("[API] Audio stream error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to stream audio file",
        statusCode: 500,
      });
    }
  }
}

export default withAuth(handler);
