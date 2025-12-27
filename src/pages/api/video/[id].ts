/**
 * Video API - Single Video Operations
 * GET /api/video/[id] - Get a single video
 * PATCH /api/video/[id] - Update a video
 * DELETE /api/video/[id] - Delete a video
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  getVideoTrackById,
  updateVideoTrack,
  deleteVideoTrack,
} from "@/lib/db";
import { deleteFromS3 } from "@/lib/s3";
import type { DBVideoTrack, ApiError } from "@/types";

// Zod schema for updating video tracks
const updateVideoTrackSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(500)
    .transform((s) => s.trim())
    .optional(),
  description: z
    .string()
    .max(5000)
    .transform((s) => s?.trim())
    .optional(),
  currentPosition: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  coverUrl: z.string().max(1000).optional(),
  isFavorite: z.boolean().optional(),
  completed: z.boolean().optional(),
});

type ResponseData = DBVideoTrack | { success: boolean } | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Video ID is required",
      statusCode: 400,
    });
  }

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid video ID format",
      statusCode: 400,
    });
  }

  // GET - Fetch single video
  if (req.method === "GET") {
    try {
      const video = await getVideoTrackById(id);
      if (!video) {
        return res.status(404).json({
          error: "Not Found",
          message: "Video not found",
          statusCode: 404,
        });
      }
      return res.status(200).json(video);
    } catch (error) {
      console.error("[API] Error fetching video:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch video",
        statusCode: 500,
      });
    }
  }

  // PATCH - Update video
  if (req.method === "PATCH") {
    try {
      const parseResult = updateVideoTrackSchema.safeParse(req.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues
          .map((i) => i.message)
          .join(", ");
        return res.status(400).json({
          error: "Bad Request",
          message: errors,
          statusCode: 400,
        });
      }

      const video = await updateVideoTrack(id, parseResult.data);
      if (!video) {
        return res.status(404).json({
          error: "Not Found",
          message: "Video not found",
          statusCode: 404,
        });
      }

      return res.status(200).json(video);
    } catch (error) {
      console.error("[API] Error updating video:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update video",
        statusCode: 500,
      });
    }
  }

  // DELETE - Delete video
  if (req.method === "DELETE") {
    try {
      // Get the video first to get the S3 key
      const video = await getVideoTrackById(id);
      if (!video) {
        return res.status(404).json({
          error: "Not Found",
          message: "Video not found",
          statusCode: 404,
        });
      }

      // Delete from database
      const s3Key = await deleteVideoTrack(id);

      // Delete from S3 if we have a key
      if (s3Key) {
        try {
          await deleteFromS3(s3Key);
        } catch (s3Error) {
          console.error("[API] Failed to delete video from S3:", s3Error);
          // Continue anyway - the DB record is already deleted
        }

        // Also try to delete cover if it's stored in S3
        if (video.coverUrl?.startsWith("covers/")) {
          try {
            await deleteFromS3(video.coverUrl);
          } catch {
            // Ignore cover deletion errors
          }
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error deleting video:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete video",
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
