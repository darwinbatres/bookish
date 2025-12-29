/**
 * Image Stream API - Stream images from S3
 * GET /api/images/stream?s3Key=xxx - Stream an image
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import { withAuth } from "@/lib/api";
import { streamFromS3 } from "@/lib/s3";
import type { ApiError } from "@/types";

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

  try {
    const s3Response = await streamFromS3(s3Key);

    if (!s3Response.Body) {
      return res.status(404).json({
        error: "Not Found",
        message: "Image not found",
        statusCode: 404,
      });
    }

    // Set content type
    const contentType = s3Response.ContentType || "image/jpeg";
    res.setHeader("Content-Type", contentType);

    // Set content length if available
    if (s3Response.ContentLength) {
      res.setHeader("Content-Length", s3Response.ContentLength);
    }

    // Set cache headers for better performance (images rarely change)
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Stream the file
    const nodeStream = s3Response.Body as Readable;
    nodeStream.pipe(res);
  } catch (error) {
    console.error("[API] Error streaming image:", error);

    if ((error as { name?: string }).name === "NoSuchKey") {
      return res.status(404).json({
        error: "Not Found",
        message: "Image not found",
        statusCode: 404,
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to stream image",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
