import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import {
  getAudioTrackById,
  updateAudioTrack,
  deleteAudioTrack,
  addListeningTime,
} from "@/lib/db";
import { deleteFromS3 } from "@/lib/s3";
import type { DBAudioTrack, ApiError } from "@/types";

type ResponseData = DBAudioTrack | { success: boolean } | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Track ID is required",
      statusCode: 400,
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid track ID format",
      statusCode: 400,
    });
  }

  if (req.method === "GET") {
    try {
      const track = await getAudioTrackById(id);
      if (!track) {
        return res.status(404).json({
          error: "Not Found",
          message: "Audio track not found",
          statusCode: 404,
        });
      }
      return res.status(200).json(track);
    } catch (error) {
      console.error("[API] Error fetching audio track:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch audio track",
        statusCode: 500,
      });
    }
  }

  if (req.method === "PATCH") {
    try {
      const {
        title,
        artist,
        album,
        currentPosition,
        durationSeconds,
        coverUrl,
        completed,
        isFavorite,
        addTime,
      } = req.body;

      // Special case: add listening time
      if (addTime && typeof addTime === "number" && addTime > 0) {
        const track = await addListeningTime(id, addTime);
        if (!track) {
          return res.status(404).json({
            error: "Not Found",
            message: "Audio track not found",
            statusCode: 404,
          });
        }
        return res.status(200).json(track);
      }

      const track = await updateAudioTrack(id, {
        title,
        artist,
        album,
        currentPosition,
        durationSeconds,
        coverUrl,
        completed,
        isFavorite,
      });

      if (!track) {
        return res.status(404).json({
          error: "Not Found",
          message: "Audio track not found",
          statusCode: 404,
        });
      }

      return res.status(200).json(track);
    } catch (error) {
      console.error("[API] Error updating audio track:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update audio track",
        statusCode: 500,
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const s3Key = await deleteAudioTrack(id);
      if (!s3Key) {
        return res.status(404).json({
          error: "Not Found",
          message: "Audio track not found",
          statusCode: 404,
        });
      }

      // Delete from S3
      try {
        await deleteFromS3(s3Key);
      } catch (s3Error) {
        console.error("[API] Warning: Failed to delete audio file from S3:", s3Error);
        // Continue anyway - the DB record is already deleted
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error deleting audio track:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete audio track",
        statusCode: 500,
      });
    }
  }

  return res.status(405).json({
    error: "Method Not Allowed",
    message: "Only GET, PATCH, and DELETE methods are allowed",
    statusCode: 405,
  });
}

export default withAuth(handler);
