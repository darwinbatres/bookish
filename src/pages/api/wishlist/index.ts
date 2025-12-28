import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  getAllWishlistItems,
  getWishlistItemsPaginated,
  createWishlistItem,
} from "@/lib/db";
import { withAuth } from "@/lib/api";
import type {
  DBWishlistItem,
  ApiError,
  PaginatedResponse,
  WishlistMediaType,
} from "@/types";

// Valid media types for wishlist
const mediaTypeSchema = z.enum(["book", "audio", "video"]);

// Request validation for creating a wishlist item
const createWishlistSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  mediaType: mediaTypeSchema.optional().default("book"),
  notes: z.string().optional(),
  priority: z.number().int().min(0).max(2).optional().default(0),
  url: z.string().url().optional().or(z.literal("")),
});

// Query params for GET with pagination
const querySchema = z.object({
  search: z.string().optional(),
  mediaType: mediaTypeSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  paginated: z.coerce.boolean().optional().default(false),
});

type WishlistResponse =
  | DBWishlistItem[]
  | DBWishlistItem
  | PaginatedResponse<DBWishlistItem>;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WishlistResponse | ApiError>
) {
  try {
    switch (req.method) {
      case "GET": {
        const queryResult = querySchema.safeParse(req.query);
        if (!queryResult.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: queryResult.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const { search, page, limit, paginated, mediaType } = queryResult.data;

        if (paginated) {
          const result = await getWishlistItemsPaginated({
            page,
            limit,
            search,
            mediaType: mediaType as WishlistMediaType | undefined,
          });
          return res.status(200).json(result);
        }

        const items = await getAllWishlistItems();
        return res.status(200).json(items);
      }

      case "POST": {
        const result = createWishlistSchema.safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const item = await createWishlistItem({
          ...result.data,
          url: result.data.url || undefined,
          priority: result.data.priority as 0 | 1 | 2,
          mediaType: result.data.mediaType as WishlistMediaType,
        });

        return res.status(201).json(item);
      }

      default:
        return res.status(405).json({
          error: "Method Not Allowed",
          message: `Method ${req.method} not allowed`,
          statusCode: 405,
        });
    }
  } catch (error) {
    console.error("[API] Wishlist error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
