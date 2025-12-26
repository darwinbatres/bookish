import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import { streamFromS3 } from "@/lib/s3";
import { getAudioTrackById } from "@/lib/db";
import type { ApiError } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Buffer | ApiError>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET method is allowed",
      statusCode: 405,
    });
  }

  const { id } = req.query;

  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid track ID format",
      statusCode: 400,
    });
  }

  try {
    const track = await getAudioTrackById(id);
    
    if (!track) {
      return res.status(404).json({
        error: "Not Found",
        message: "Audio track not found",
        statusCode: 404,
      });
    }

    const s3Response = await streamFromS3(track.s3Key);

    if (!s3Response.Body) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to retrieve audio file",
        statusCode: 500,
      });
    }

    // Build a safe filename
    const extension = track.format || "mp3";
    const safeTitle = track.title
      .replace(/[^a-zA-Z0-9\s.-]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 100);
    const filename = `${safeTitle}.${extension}`;

    // Set headers for download (not streaming)
    res.setHeader("Content-Type", s3Response.ContentType || "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    
    if (s3Response.ContentLength) {
      res.setHeader("Content-Length", s3Response.ContentLength);
    }

    // Stream the file
    const stream = s3Response.Body as NodeJS.ReadableStream;
    stream.pipe(res);
  } catch (error) {
    console.error("[API] Error downloading audio:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to download audio file",
      statusCode: 500,
    });
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
};

export default withAuth(handler);
