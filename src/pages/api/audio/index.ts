import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  getAllAudioTracks,
  getAudioTracksWithPagination,
  createAudioTrack,
} from "@/lib/db";
import type {
  DBAudioTrack,
  PaginatedResponse,
  ApiError,
  AudioFormat,
} from "@/types";

// Zod schema for creating audio tracks (industry best practice)
const createAudioTrackSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(500, "Title must be 500 characters or less")
    .transform((s) => s.trim()),
  artist: z
    .string()
    .max(500, "Artist must be 500 characters or less")
    .optional()
    .transform((s) => s?.trim()),
  album: z
    .string()
    .max(500, "Album must be 500 characters or less")
    .optional()
    .transform((s) => s?.trim()),
  format: z.enum(["mp3", "wav", "ogg", "m4a", "flac", "aac", "webm"]),
  durationSeconds: z.number().int().min(0).default(0),
  fileSize: z.number().int().min(0).default(0),
  s3Key: z
    .string()
    .min(1, "s3Key is required")
    .max(500)
    .refine(
      (key) => key.startsWith("audio/") && !key.includes(".."),
      "Invalid s3Key format"
    ),
  originalFilename: z.string().max(500).optional(),
  coverUrl: z.string().url().max(1000).optional(),
});

type ResponseData =
  | DBAudioTrack[]
  | PaginatedResponse<DBAudioTrack>
  | DBAudioTrack
  | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === "GET") {
    try {
      const {
        paginated,
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        playlistId,
        favoritesOnly,
      } = req.query;

      // Return paginated results if requested
      if (paginated === "true") {
        const result = await getAudioTracksWithPagination({
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          search: search as string,
          sortBy: sortBy as
            | "title"
            | "createdAt"
            | "updatedAt"
            | "author"
            | undefined,
          sortOrder: sortOrder as "asc" | "desc",
          playlistId: playlistId as string,
          favoritesOnly: favoritesOnly === "true",
        });
        return res.status(200).json(result);
      }

      // Return all tracks (for backward compatibility)
      const tracks = await getAllAudioTracks();
      return res.status(200).json(tracks);
    } catch (error) {
      console.error("[API] Error fetching audio tracks:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch audio tracks",
        statusCode: 500,
      });
    }
  }

  if (req.method === "POST") {
    try {
      // Validate request body with Zod schema
      const parseResult = createAudioTrackSchema.safeParse(req.body);

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

      const track = await createAudioTrack({
        title: validatedData.title,
        artist: validatedData.artist,
        album: validatedData.album,
        format: validatedData.format as AudioFormat,
        durationSeconds: validatedData.durationSeconds,
        fileSize: validatedData.fileSize,
        s3Key: validatedData.s3Key,
        originalFilename: validatedData.originalFilename,
        coverUrl: validatedData.coverUrl,
      });

      return res.status(201).json(track);
    } catch (error) {
      console.error("[API] Error creating audio track:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create audio track",
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
