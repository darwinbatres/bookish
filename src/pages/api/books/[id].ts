import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  getBookById,
  updateBook,
  deleteBook as deleteBookFromDB,
} from "@/lib/db";
import { deleteFromS3 } from "@/lib/s3";
import { withAuth } from "@/lib/api";
import type { DBBook, ApiError } from "@/types";

// Update schema
const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  currentPage: z.number().min(1).optional(),
  totalPages: z.number().positive().optional(),
  // coverUrl can be a full URL or S3 key (e.g., "covers/{bookId}/..."), or empty string to remove
  coverUrl: z.string().optional(),
  collectionId: z.string().uuid().nullable().optional(),
  completed: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DBBook | { success: boolean } | ApiError>
) {
  const { id } = req.query;

  // Validate ID
  if (typeof id !== "string" || !id) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid book ID",
      statusCode: 400,
    });
  }

  try {
    switch (req.method) {
      case "GET": {
        const book = await getBookById(id);
        if (!book) {
          return res.status(404).json({
            error: "Not Found",
            message: "Book not found",
            statusCode: 404,
          });
        }
        return res.status(200).json(book);
      }

      case "PATCH":
      case "PUT": {
        const result = updateBookSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const updated = await updateBook(id, result.data);
        if (!updated) {
          return res.status(404).json({
            error: "Not Found",
            message: "Book not found",
            statusCode: 404,
          });
        }
        return res.status(200).json(updated);
      }

      case "DELETE": {
        // Delete from DB (returns s3Key for cleanup)
        const s3Key = await deleteBookFromDB(id);
        if (!s3Key) {
          return res.status(404).json({
            error: "Not Found",
            message: "Book not found",
            statusCode: 404,
          });
        }

        // Delete file from S3 (non-blocking, log errors but don't fail)
        try {
          await deleteFromS3(s3Key);
        } catch (err) {
          console.error("[API] Failed to delete from S3:", err);
        }

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({
          error: "Method Not Allowed",
          message: "Only GET, PATCH, PUT, and DELETE requests are allowed",
          statusCode: 405,
        });
    }
  } catch (error) {
    console.error("[API] Book error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
