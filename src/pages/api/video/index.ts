/**
 * Video API - List and Create
 * GET /api/video - List all videos (supports pagination)
 * POST /api/video - Create a new video record
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  getAllVideoTracks,
  getVideoTracksWithPagination,
  createVideoTrack,
} from "@/lib/db";
import type {
  DBVideoTrack,
  PaginatedResponse,
  ApiError,
  VideoFormat,
} from "@/types";

// Zod schema for creating video tracks
const createVideoTrackSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(500, "Title must be 500 characters or less")
    .transform((s) => s.trim()),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or less")
    .optional()
    .transform((s) => s?.trim()),
  format: z.enum(["mp4", "webm", "mkv", "mov", "avi", "m4v"]),
  durationSeconds: z.number().int().min(0).default(0),
  fileSize: z.number().int().min(0).default(0),
  s3Key: z
    .string()
    .min(1, "s3Key is required")
    .max(500)
    .refine(
      (key) => key.startsWith("video/") && !key.includes(".."),
      "Invalid s3Key format"
    ),
  originalFilename: z.string().max(500).optional(),
  coverUrl: z.string().max(1000).optional(),
});

type ResponseData =
  | DBVideoTrack[]
  | PaginatedResponse<DBVideoTrack>
  | DBVideoTrack
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
        folderId,
        favoritesOnly,
      } = req.query;

      // Return paginated results if requested
      if (paginated === "true") {
        const result = await getVideoTracksWithPagination({
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          search: search as string,
          sortBy: sortBy as "title" | "createdAt" | "updatedAt" | undefined,
          sortOrder: sortOrder as "asc" | "desc",
          folderId: folderId as string,
          favoritesOnly: favoritesOnly === "true",
        });
        return res.status(200).json(result);
      }

      // Return all tracks (for backward compatibility)
      const tracks = await getAllVideoTracks();
      return res.status(200).json(tracks);
    } catch (error) {
      console.error("[API] Error fetching video tracks:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch video tracks",
        statusCode: 500,
      });
    }
  }

  if (req.method === "POST") {
    try {
      // Validate request body with Zod schema
      const parseResult = createVideoTrackSchema.safeParse(req.body);

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

      const track = await createVideoTrack({
        title: validatedData.title,
        description: validatedData.description,
        format: validatedData.format as VideoFormat,
        durationSeconds: validatedData.durationSeconds,
        fileSize: validatedData.fileSize,
        s3Key: validatedData.s3Key,
        originalFilename: validatedData.originalFilename,
        coverUrl: validatedData.coverUrl,
      });

      return res.status(201).json(track);
    } catch (error) {
      console.error("[API] Error creating video track:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create video track",
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
