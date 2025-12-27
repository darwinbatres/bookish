/**
 * Video Bookmarks API
 * GET /api/video/[id]/bookmarks - Get bookmarks for a video
 * POST /api/video/[id]/bookmarks - Add a bookmark
 * DELETE /api/video/[id]/bookmarks - Remove a bookmark
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  getVideoBookmarks,
  createVideoBookmark,
  deleteVideoBookmarkByPosition,
} from "@/lib/db";
import type { DBVideoBookmark, ApiError } from "@/types";

const createBookmarkSchema = z.object({
  positionSeconds: z.number().int().min(0),
  label: z.string().max(255).optional(),
});

const deleteBookmarkSchema = z.object({
  positionSeconds: z.number().int().min(0),
});

type ResponseData =
  | DBVideoBookmark[]
  | DBVideoBookmark
  | { success: boolean }
  | ApiError;

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

  // GET - List bookmarks
  if (req.method === "GET") {
    try {
      const bookmarks = await getVideoBookmarks(id);
      return res.status(200).json(bookmarks);
    } catch (error) {
      console.error("[API] Error fetching video bookmarks:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch bookmarks",
        statusCode: 500,
      });
    }
  }

  // POST - Create bookmark
  if (req.method === "POST") {
    try {
      const parseResult = createBookmarkSchema.safeParse(req.body);

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

      const { positionSeconds, label } = parseResult.data;
      const bookmark = await createVideoBookmark(id, positionSeconds, label);
      return res.status(201).json(bookmark);
    } catch (error) {
      console.error("[API] Error creating video bookmark:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create bookmark",
        statusCode: 500,
      });
    }
  }

  // DELETE - Remove bookmark
  if (req.method === "DELETE") {
    try {
      const parseResult = deleteBookmarkSchema.safeParse(req.body);

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

      const { positionSeconds } = parseResult.data;
      const deleted = await deleteVideoBookmarkByPosition(id, positionSeconds);

      if (!deleted) {
        return res.status(404).json({
          error: "Not Found",
          message: "Bookmark not found",
          statusCode: 404,
        });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error deleting video bookmark:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete bookmark",
        statusCode: 500,
      });
    }
  }

  return res.status(405).json({
    error: "Method Not Allowed",
    message: "Only GET, POST, and DELETE methods are allowed",
    statusCode: 405,
  });
}

export default withAuth(handler);
