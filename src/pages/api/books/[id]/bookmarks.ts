import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getBookmarksByBookId, addBookmark, removeBookmark } from "@/lib/db";
import { withAuth } from "@/lib/api";
import type { DBBookmark, ApiError } from "@/types";

const addBookmarkSchema = z.object({
  page: z.number().positive("Page must be a positive number"),
  label: z.string().optional(),
});

const removeBookmarkSchema = z.object({
  page: z.number().positive("Page must be a positive number"),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    DBBookmark[] | DBBookmark | { success: boolean } | ApiError
  >
) {
  const { id: bookId } = req.query;

  if (typeof bookId !== "string" || !bookId) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid book ID",
      statusCode: 400,
    });
  }

  try {
    switch (req.method) {
      case "GET": {
        const bookmarks = await getBookmarksByBookId(bookId);
        return res.status(200).json(bookmarks);
      }

      case "POST": {
        const result = addBookmarkSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const bookmark = await addBookmark(
          bookId,
          result.data.page,
          result.data.label
        );
        return res.status(201).json(bookmark);
      }

      case "DELETE": {
        const result = removeBookmarkSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const removed = await removeBookmark(bookId, result.data.page);
        if (!removed) {
          return res.status(404).json({
            error: "Not Found",
            message: "Bookmark not found",
            statusCode: 404,
          });
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({
          error: "Method Not Allowed",
          message: "Only GET, POST, and DELETE requests are allowed",
          statusCode: 405,
        });
    }
  } catch (error) {
    console.error("[API] Bookmarks error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
