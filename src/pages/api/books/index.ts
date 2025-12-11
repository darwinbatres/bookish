import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  getAllBooks,
  createBook,
  getBooksWithPagination,
  searchBooksAdvanced,
} from "@/lib/db";
import { withAuth } from "@/lib/api";
import type { DBBook, ApiError, BookFormat, PaginatedResponse } from "@/types";

// Request validation for creating a book
const createBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  format: z.enum(["pdf", "epub", "mobi"]),
  fileSize: z.number().positive("File size must be positive"),
  totalPages: z.number().positive().optional(),
  s3Key: z.string().min(1, "S3 key is required"),
  coverUrl: z.string().url().optional(),
});

// Query params for GET with pagination
const querySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z
    .enum(["title", "updatedAt", "createdAt", "author"])
    .optional()
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  paginated: z.coerce.boolean().optional().default(false),
  collectionId: z.string().uuid().optional(),
  favoritesOnly: z.coerce.boolean().optional().default(false),
});

type BooksResponse = DBBook[] | DBBook | PaginatedResponse<DBBook>;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BooksResponse | ApiError>
) {
  try {
    switch (req.method) {
      case "GET": {
        // Parse query params
        const queryResult = querySchema.safeParse(req.query);
        if (!queryResult.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: queryResult.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const {
          search,
          page,
          limit,
          sortBy,
          sortOrder,
          paginated,
          collectionId,
          favoritesOnly,
        } = queryResult.data;

        // If pagination requested, use paginated response
        if (paginated) {
          if (search && search.trim()) {
            const result = await searchBooksAdvanced(search, {
              page,
              limit,
              sortBy,
              sortOrder,
              collectionId,
              favoritesOnly,
            });
            return res.status(200).json(result);
          }
          const result = await getBooksWithPagination({
            page,
            limit,
            search,
            sortBy,
            sortOrder,
            collectionId,
            favoritesOnly,
          });
          return res.status(200).json(result);
        }

        // Legacy non-paginated response for backwards compatibility
        const books = await getAllBooks();
        return res.status(200).json(books);
      }

      case "POST": {
        // Validate request body
        const result = createBookSchema.safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const book = await createBook({
          title: result.data.title,
          author: result.data.author,
          format: result.data.format as BookFormat,
          fileSize: result.data.fileSize,
          totalPages: result.data.totalPages,
          s3Key: result.data.s3Key,
          coverUrl: result.data.coverUrl,
        });

        return res.status(201).json(book);
      }

      default:
        return res.status(405).json({
          error: "Method Not Allowed",
          message: "Only GET and POST requests are allowed",
          statusCode: 405,
        });
    }
  } catch (error) {
    console.error("[API] Books error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
