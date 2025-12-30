/**
 * Media Folder Items API
 * GET /api/media-folders/[id]/items - Get folder contents
 * POST /api/media-folders/[id]/items - Add item to folder
 * PATCH /api/media-folders/[id]/items - Update item (notes/order)
 * DELETE /api/media-folders/[id]/items - Remove item from folder
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  getFolderItems,
  getFolderItemsWithPagination,
  addItemToFolder,
  updateFolderItem,
  removeItemFromFolder,
  removeItemFromFolderByRef,
  reorderFolderItems,
} from "@/lib/db";
import type {
  DBMediaFolderItem,
  DBMediaFolderItemWithDetails,
  PaginatedResponse,
  ApiError,
} from "@/types";

const addItemSchema = z.object({
  itemType: z.enum(["book", "audio", "video", "image"]),
  itemId: z.string().uuid(),
  notes: z.string().max(5000).optional(),
});

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  notes: z.string().max(5000).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const removeItemSchema = z.object({
  itemId: z.string().uuid(),
  itemType: z.enum(["book", "audio", "video", "image"]).optional(),
});

const reorderItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()),
});

type ResponseData =
  | DBMediaFolderItemWithDetails[]
  | PaginatedResponse<DBMediaFolderItemWithDetails>
  | DBMediaFolderItem
  | { success: boolean }
  | ApiError;

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

  // GET - Get folder items (supports pagination and search)
  if (req.method === "GET") {
    try {
      const { page, limit, itemType, paginate, search } = req.query;

      // If paginate=true or page/limit provided, return paginated response
      if (paginate === "true" || page || limit) {
        const paginatedItems = await getFolderItemsWithPagination(id, {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          itemType: itemType as "book" | "audio" | "video" | "image" | undefined,
          search: typeof search === "string" ? search : undefined,
        });
        return res.status(200).json(paginatedItems);
      }

      // Default: return all items (backwards compatible)
      const items = await getFolderItems(id);
      return res.status(200).json(items);
    } catch (error) {
      console.error("[API] Error fetching folder items:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch folder items",
        statusCode: 500,
      });
    }
  }

  // POST - Add item to folder
  if (req.method === "POST") {
    try {
      const parseResult = addItemSchema.safeParse(req.body);

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

      const { itemType, itemId, notes } = parseResult.data;
      const item = await addItemToFolder(id, itemType, itemId, notes);
      return res.status(201).json(item);
    } catch (error) {
      console.error("[API] Error adding item to folder:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to add item to folder",
        statusCode: 500,
      });
    }
  }

  // PATCH - Update item or reorder items
  if (req.method === "PATCH") {
    try {
      // Check if this is a reorder request
      const reorderResult = reorderItemsSchema.safeParse(req.body);
      if (reorderResult.success) {
        await reorderFolderItems(id, reorderResult.data.itemIds);
        return res.status(200).json({ success: true });
      }

      // Otherwise, it's an update request
      const parseResult = updateItemSchema.safeParse(req.body);

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

      const { itemId, notes, sortOrder } = parseResult.data;
      const item = await updateFolderItem(itemId, { notes, sortOrder });

      if (!item) {
        return res.status(404).json({
          error: "Not Found",
          message: "Item not found",
          statusCode: 404,
        });
      }

      return res.status(200).json(item);
    } catch (error) {
      console.error("[API] Error updating folder item:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update folder item",
        statusCode: 500,
      });
    }
  }

  // DELETE - Remove item from folder
  if (req.method === "DELETE") {
    try {
      const parseResult = removeItemSchema.safeParse(req.body);

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

      const { itemId, itemType } = parseResult.data;
      let deleted: boolean;

      if (itemType) {
        // Remove by folder+type+itemId reference
        deleted = await removeItemFromFolderByRef(id, itemType, itemId);
      } else {
        // Remove by folder item ID
        deleted = await removeItemFromFolder(itemId);
      }

      if (!deleted) {
        return res.status(404).json({
          error: "Not Found",
          message: "Item not found in folder",
          statusCode: 404,
        });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error removing item from folder:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to remove item from folder",
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
