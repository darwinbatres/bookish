/**
 * Search Items Across All Folders API
 * GET /api/media-folders/search-items - Search folder items globally
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import { searchItemsAcrossAllFolders } from "@/lib/db";
import type { DBMediaFolderItemWithDetails, PaginatedResponse, ApiError } from "@/types";

type ResponseData = PaginatedResponse<DBMediaFolderItemWithDetails> | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET method is allowed",
      statusCode: 405,
    });
  }

  try {
    const { search, page, limit, itemType } = req.query;

    // Search is required for this endpoint
    if (!search || typeof search !== "string" || !search.trim()) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Search query is required",
        statusCode: 400,
      });
    }

    const result = await searchItemsAcrossAllFolders({
      search: search.trim(),
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      itemType: itemType as "book" | "audio" | "video" | undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[API] Error searching folder items:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to search folder items",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
