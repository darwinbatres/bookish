/**
 * Video Download API
 * GET /api/video/download - Download video file from S3 with proper filename
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, isS3Configured } from "@/lib/s3";
import { config as appConfig } from "@/lib/config";
import { withAuth } from "@/lib/api";
import type { Readable } from "stream";

// Disable body parser for streaming
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET requests are allowed",
      statusCode: 405,
    });
  }

  const { s3Key, filename } = req.query;

  if (!s3Key || typeof s3Key !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "s3Key query parameter is required",
      statusCode: 400,
    });
  }

  // Security: Validate S3 key format
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

    const getCommand = new GetObjectCommand({
      Bucket: appConfig.s3.bucket,
      Key: s3Key,
    });

    const response = await client.send(getCommand);

    if (!response.Body) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to download video file",
        statusCode: 500,
      });
    }

    // Determine filename for download
    const downloadFilename =
      typeof filename === "string" && filename
        ? filename
        : s3Key.split("/").pop() || "video.mp4";

    // Set response headers for download
    res.setHeader("Content-Type", response.ContentType || "video/mp4");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(downloadFilename)}"`
    );
    if (response.ContentLength) {
      res.setHeader("Content-Length", response.ContentLength);
    }

    // Stream the response
    const stream = response.Body as Readable;
    stream.pipe(res);

    stream.on("error", (error) => {
      console.error("[API] Video download stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          message: "Failed to download video file",
          statusCode: 500,
        });
      }
    });
  } catch (error) {
    console.error("[API] Video download error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to download video file",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
