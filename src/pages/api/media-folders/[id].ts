/**
 * Media Folders API - Single Folder Operations
 * GET /api/media-folders/[id] - Get a single folder with items
 * PATCH /api/media-folders/[id] - Update a folder
 * DELETE /api/media-folders/[id] - Delete a folder
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  getMediaFolderById,
  updateMediaFolder,
  deleteMediaFolder,
} from "@/lib/db";
import type { DBMediaFolder, ApiError } from "@/types";

// Zod schema for updating media folders
const updateMediaFolderSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .transform((s) => s.trim())
    .optional(),
  description: z
    .string()
    .max(5000)
    .transform((s) => s?.trim())
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
  coverUrl: z.string().max(1000).optional(),
});

type ResponseData = DBMediaFolder | { success: boolean } | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Folder ID is required",
      statusCode: 400,
    });
  }

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid folder ID format",
      statusCode: 400,
    });
  }

  // GET - Fetch single folder
  if (req.method === "GET") {
    try {
      const folder = await getMediaFolderById(id);
      if (!folder) {
        return res.status(404).json({
          error: "Not Found",
          message: "Folder not found",
          statusCode: 404,
        });
      }
      return res.status(200).json(folder);
    } catch (error) {
      console.error("[API] Error fetching media folder:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch folder",
        statusCode: 500,
      });
    }
  }

  // PATCH - Update folder
  if (req.method === "PATCH") {
    try {
      const parseResult = updateMediaFolderSchema.safeParse(req.body);

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

      const folder = await updateMediaFolder(id, parseResult.data);
      if (!folder) {
        return res.status(404).json({
          error: "Not Found",
          message: "Folder not found",
          statusCode: 404,
        });
      }

      return res.status(200).json(folder);
    } catch (error) {
      console.error("[API] Error updating media folder:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update folder",
        statusCode: 500,
      });
    }
  }

  // DELETE - Delete folder
  if (req.method === "DELETE") {
    try {
      const deleted = await deleteMediaFolder(id);

      if (!deleted) {
        return res.status(404).json({
          error: "Not Found",
          message: "Folder not found",
          statusCode: 404,
        });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error deleting media folder:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete folder",
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
