/**
 * Media Folders API - List and Create
 * GET /api/media-folders - List all media folders
 * POST /api/media-folders - Create a new folder
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  getAllMediaFolders,
  getMediaFoldersWithPagination,
  createMediaFolder,
} from "@/lib/db";
import type { DBMediaFolder, PaginatedResponse, ApiError } from "@/types";

// Zod schema for creating media folders
const createMediaFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less")
    .transform((s) => s.trim()),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or less")
    .optional()
    .transform((s) => s?.trim()),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional()
    .default("#6366f1"),
  icon: z.string().max(50).optional().default("folder"),
  coverUrl: z.string().max(1000).optional(),
});

type ResponseData =
  | DBMediaFolder[]
  | PaginatedResponse<DBMediaFolder>
  | DBMediaFolder
  | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === "GET") {
    try {
      const { paginated, page, limit, search, sortBy, sortOrder } = req.query;

      // Return paginated results if requested
      if (paginated === "true") {
        const result = await getMediaFoldersWithPagination({
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          search: search as string,
          sortBy: sortBy as
            | "name"
            | "sortOrder"
            | "updatedAt"
            | "createdAt"
            | undefined,
          sortOrder: sortOrder as "asc" | "desc",
        });
        return res.status(200).json(result);
      }

      // Return all folders
      const folders = await getAllMediaFolders();
      return res.status(200).json(folders);
    } catch (error) {
      console.error("[API] Error fetching media folders:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch media folders",
        statusCode: 500,
      });
    }
  }

  if (req.method === "POST") {
    try {
      const parseResult = createMediaFolderSchema.safeParse(req.body);

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

      const folder = await createMediaFolder({
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        icon: validatedData.icon,
        coverUrl: validatedData.coverUrl,
      });

      return res.status(201).json(folder);
    } catch (error) {
      console.error("[API] Error creating media folder:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create media folder",
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
