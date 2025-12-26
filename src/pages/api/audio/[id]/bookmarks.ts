import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import {
  getAudioBookmarks,
  createAudioBookmark,
  deleteAudioBookmarkByPosition,
} from "@/lib/db";
import type { DBAudioBookmark, ApiError } from "@/types";

type ResponseData = DBAudioBookmark[] | DBAudioBookmark | { success: boolean } | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id: trackId } = req.query;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Track ID is required",
      statusCode: 400,
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(trackId)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid track ID format",
      statusCode: 400,
    });
  }

  // GET: Get all bookmarks for a track
  if (req.method === "GET") {
    try {
      const bookmarks = await getAudioBookmarks(trackId);
      return res.status(200).json(bookmarks);
    } catch (error) {
      console.error("[API] Error fetching audio bookmarks:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch audio bookmarks",
        statusCode: 500,
      });
    }
  }

  // POST: Create a bookmark
  if (req.method === "POST") {
    try {
      const { positionSeconds, label } = req.body;

      if (typeof positionSeconds !== "number" || positionSeconds < 0) {
        return res.status(400).json({
          error: "Bad Request",
          message: "positionSeconds is required and must be a non-negative number",
          statusCode: 400,
        });
      }

      const bookmark = await createAudioBookmark(trackId, positionSeconds, label);
      return res.status(201).json(bookmark);
    } catch (error) {
      console.error("[API] Error creating audio bookmark:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create audio bookmark",
        statusCode: 500,
      });
    }
  }

  // DELETE: Remove a bookmark by position
  if (req.method === "DELETE") {
    try {
      const { positionSeconds } = req.body;

      if (typeof positionSeconds !== "number") {
        return res.status(400).json({
          error: "Bad Request",
          message: "positionSeconds is required",
          statusCode: 400,
        });
      }

      const deleted = await deleteAudioBookmarkByPosition(trackId, positionSeconds);
      if (!deleted) {
        return res.status(404).json({
          error: "Not Found",
          message: "Bookmark not found at that position",
          statusCode: 404,
        });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error deleting audio bookmark:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete audio bookmark",
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
