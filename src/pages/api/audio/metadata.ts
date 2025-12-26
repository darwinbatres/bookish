import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import { getUniqueAlbums, getUniqueArtists } from "@/lib/db";
import type { ApiError } from "@/types";

interface MetadataResponse {
  albums: string[];
  artists: string[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MetadataResponse | ApiError>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET method is allowed",
      statusCode: 405,
    });
  }

  try {
    const [albums, artists] = await Promise.all([
      getUniqueAlbums(),
      getUniqueArtists(),
    ]);

    return res.status(200).json({ albums, artists });
  } catch (error) {
    console.error("[API] Error fetching audio metadata:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch audio metadata",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
