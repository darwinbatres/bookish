import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  getWishlistItemById,
  updateWishlistItem,
  deleteWishlistItem,
} from "@/lib/db";
import { withAuth } from "@/lib/api";
import type { DBWishlistItem, ApiError } from "@/types";

// Request validation for updating a wishlist item
const updateWishlistSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  notes: z.string().optional(),
  priority: z.number().int().min(0).max(2).optional(),
  url: z.string().url().optional().or(z.literal("")),
});

type WishlistItemResponse = DBWishlistItem | { success: boolean };

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WishlistItemResponse | ApiError>
) {
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid item ID",
      statusCode: 400,
    });
  }

  try {
    switch (req.method) {
      case "GET": {
        const item = await getWishlistItemById(id);
        if (!item) {
          return res.status(404).json({
            error: "Not Found",
            message: "Wishlist item not found",
            statusCode: 404,
          });
        }
        return res.status(200).json(item);
      }

      case "PATCH": {
        const result = updateWishlistSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const item = await updateWishlistItem(id, {
          ...result.data,
          url: result.data.url === "" ? undefined : result.data.url,
          priority: result.data.priority as 0 | 1 | 2 | undefined,
        });

        if (!item) {
          return res.status(404).json({
            error: "Not Found",
            message: "Wishlist item not found",
            statusCode: 404,
          });
        }

        return res.status(200).json(item);
      }

      case "DELETE": {
        const success = await deleteWishlistItem(id);
        if (!success) {
          return res.status(404).json({
            error: "Not Found",
            message: "Wishlist item not found",
            statusCode: 404,
          });
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({
          error: "Method Not Allowed",
          message: `Method ${req.method} not allowed`,
          statusCode: 405,
        });
    }
  } catch (error) {
    console.error("[API] Wishlist item error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
