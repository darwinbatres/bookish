import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { getAllPlaylists, createPlaylist } from "@/lib/db";
import type { DBPlaylist, ApiError } from "@/types";

// Zod schema for playlist creation with proper validation
const createPlaylistSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less")
    .transform((s) => s.trim()),
  description: z
    .string()
    .max(1000, "Description must be 1000 characters or less")
    .optional()
    .transform((s) => s?.trim()),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional()
    .default("#6366f1"),
  icon: z.string().max(50).optional().default("music"),
});

type ResponseData = DBPlaylist[] | DBPlaylist | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === "GET") {
    try {
      const playlists = await getAllPlaylists();
      return res.status(200).json(playlists);
    } catch (error) {
      console.error("[API] Error fetching playlists:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch playlists",
        statusCode: 500,
      });
    }
  }

  if (req.method === "POST") {
    try {
      // Validate with Zod schema
      const parseResult = createPlaylistSchema.safeParse(req.body);

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

      const validatedData = parseResult.data;

      const playlist = await createPlaylist({
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        icon: validatedData.icon,
      });

      return res.status(201).json(playlist);
    } catch (error) {
      console.error("[API] Error creating playlist:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create playlist",
        statusCode: 500,
      });
    }
  }

  return res.status(405).json({
    error: "Method Not Allowed",
    message: "Only GET and POST methods are allowed",
    statusCode: 405,
  });
}

export default withAuth(handler);
