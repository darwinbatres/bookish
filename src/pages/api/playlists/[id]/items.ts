import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import {
  getPlaylistById,
  getPlaylistItems,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistItems,
  getAudioTrackById,
} from "@/lib/db";
import type { DBPlaylistItem, ApiError } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ResponseData = DBPlaylistItem[] | DBPlaylistItem | { success: boolean } | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id } = req.query;

  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid playlist ID format",
      statusCode: 400,
    });
  }

  // Verify playlist exists
  const playlist = await getPlaylistById(id);
  if (!playlist) {
    return res.status(404).json({
      error: "Not Found",
      message: "Playlist not found",
      statusCode: 404,
    });
  }

  if (req.method === "GET") {
    try {
      const items = await getPlaylistItems(id);
      return res.status(200).json(items);
    } catch (error) {
      console.error("[API] Error fetching playlist items:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch playlist items",
        statusCode: 500,
      });
    }
  }

  if (req.method === "POST") {
    try {
      const { trackId, position } = req.body;

      if (!trackId || typeof trackId !== "string" || !UUID_REGEX.test(trackId)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Valid trackId is required",
          statusCode: 400,
        });
      }

      // Verify track exists
      const track = await getAudioTrackById(trackId);
      if (!track) {
        return res.status(404).json({
          error: "Not Found",
          message: "Audio track not found",
          statusCode: 404,
        });
      }

      const item = await addTrackToPlaylist(id, trackId, position);
      return res.status(201).json(item);
    } catch (error) {
      console.error("[API] Error adding track to playlist:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to add track to playlist",
        statusCode: 500,
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { trackId } = req.body;

      if (!trackId || typeof trackId !== "string" || !UUID_REGEX.test(trackId)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Valid trackId is required",
          statusCode: 400,
        });
      }

      await removeTrackFromPlaylist(id, trackId);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error removing track from playlist:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to remove track from playlist",
        statusCode: 500,
      });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { order } = req.body;

      if (!Array.isArray(order) || !order.every((id) => UUID_REGEX.test(id))) {
        return res.status(400).json({
          error: "Bad Request",
          message: "order must be an array of valid track IDs",
          statusCode: 400,
        });
      }

      await reorderPlaylistItems(id, order);
      const items = await getPlaylistItems(id);
      return res.status(200).json(items);
    } catch (error) {
      console.error("[API] Error reordering playlist:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to reorder playlist",
        statusCode: 500,
      });
    }
  }

  return res.status(405).json({
    error: "Method Not Allowed",
    message: "Only GET, POST, PATCH, and DELETE methods are allowed",
    statusCode: 405,
  });
}

export default withAuth(handler);
