import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import { getPlaylistById, updatePlaylist, deletePlaylist } from "@/lib/db";
import type { DBPlaylist, ApiError } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ResponseData = DBPlaylist | { success: boolean } | ApiError;

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

  if (req.method === "GET") {
    try {
      const playlist = await getPlaylistById(id);
      
      if (!playlist) {
        return res.status(404).json({
          error: "Not Found",
          message: "Playlist not found",
          statusCode: 404,
        });
      }

      return res.status(200).json(playlist);
    } catch (error) {
      console.error("[API] Error fetching playlist:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch playlist",
        statusCode: 500,
      });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { name, description, color, icon } = req.body;

      const existing = await getPlaylistById(id);
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "Playlist not found",
          statusCode: 404,
        });
      }

      const updated = await updatePlaylist(id, {
        name: name?.trim(),
        description: description?.trim(),
        color,
        icon,
      });

      if (!updated) {
        return res.status(500).json({
          error: "Internal Server Error",
          message: "Failed to update playlist",
          statusCode: 500,
        });
      }

      return res.status(200).json(updated);
    } catch (error) {
      console.error("[API] Error updating playlist:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update playlist",
        statusCode: 500,
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const existing = await getPlaylistById(id);
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "Playlist not found",
          statusCode: 404,
        });
      }

      await deletePlaylist(id);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error deleting playlist:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete playlist",
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
