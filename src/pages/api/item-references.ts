import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import { getFoldersContainingItem } from "@/lib/db/repositories/media-folders";
import { getPlaylistsContainingTrack } from "@/lib/db/repositories/playlists";
import type { ApiError, DBMediaFolder, DBPlaylist } from "@/types";

export interface ItemReferencesResponse {
  folders: DBMediaFolder[];
  playlists: DBPlaylist[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ItemReferencesResponse | ApiError>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET requests are allowed",
      statusCode: 405,
    });
  }

  const { itemType, itemId } = req.query;

  if (
    !itemType ||
    typeof itemType !== "string" ||
    !["book", "audio", "video"].includes(itemType)
  ) {
    return res.status(400).json({
      error: "Bad Request",
      message: "itemType must be 'book', 'audio', or 'video'",
      statusCode: 400,
    });
  }

  if (!itemId || typeof itemId !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "itemId is required",
      statusCode: 400,
    });
  }

  try {
    // Get folders containing this item
    const folders = await getFoldersContainingItem(
      itemType as "book" | "audio" | "video",
      itemId
    );

    // Get playlists containing this item (only for audio)
    let playlists: DBPlaylist[] = [];
    if (itemType === "audio") {
      playlists = await getPlaylistsContainingTrack(itemId);
    }

    return res.status(200).json({ folders, playlists });
  } catch (error) {
    console.error("[API] Item references error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch item references",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
