/**
 * Images API - List and Create
 * GET /api/images - List images with pagination
 * POST /api/images - Create image record
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { getImagesWithPagination, createImage } from "@/lib/db";
import type {
  DBImage,
  PaginatedResponse,
  ApiError,
  ImageFormat,
} from "@/types";

// Valid image formats
const validFormats: ImageFormat[] = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
  "heic",
];

// Zod schema for creating images
const createImageSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  format: z.enum(validFormats as [ImageFormat, ...ImageFormat[]]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  s3Key: z.string().min(1).max(500),
  fileSize: z.number().int().positive(),
  originalFilename: z.string().max(500).optional(),
  thumbnailUrl: z.string().max(1000).optional(),
  takenAt: z.string().datetime().optional(),
  cameraModel: z.string().max(255).optional(),
  album: z.string().max(255).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

type ResponseData = PaginatedResponse<DBImage> | DBImage | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // GET - List images with pagination
  if (req.method === "GET") {
    try {
      const {
        page = "1",
        limit = "20",
        search,
        sortBy = "updatedAt",
        sortOrder = "desc",
        favoritesOnly,
        album,
        tag,
      } = req.query;

      const result = await getImagesWithPagination({
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 100),
        search: search as string | undefined,
        sortBy: sortBy as
          | "title"
          | "updatedAt"
          | "createdAt"
          | "author"
          | undefined,
        sortOrder: sortOrder as "asc" | "desc",
        favoritesOnly: favoritesOnly === "true",
        album: album as string | undefined,
        tag: tag as string | undefined,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("[API] Error fetching images:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch images",
        statusCode: 500,
      });
    }
  }

  // POST - Create image record
  if (req.method === "POST") {
    try {
      const parseResult = createImageSchema.safeParse(req.body);

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

      const image = await createImage(parseResult.data);
      return res.status(201).json(image);
    } catch (error) {
      console.error("[API] Error creating image:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to create image",
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
