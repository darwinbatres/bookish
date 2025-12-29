/**
 * Images API - Single Image Operations
 * GET /api/images/[id] - Get a single image
 * PATCH /api/images/[id] - Update an image
 * DELETE /api/images/[id] - Delete an image
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { getImageById, updateImage, deleteImage, toggleImageFavorite } from "@/lib/db";
import { deleteFromS3 } from "@/lib/s3";
import type { DBImage, ApiError } from "@/types";

// Zod schema for updating images
const updateImageSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().max(1000).optional(),
  album: z.string().max(255).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  isFavorite: z.boolean().optional(),
});

type ResponseData = DBImage | { success: boolean } | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Image ID is required",
      statusCode: 400,
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid image ID format",
      statusCode: 400,
    });
  }

  // GET - Fetch single image
  if (req.method === "GET") {
    try {
      const image = await getImageById(id);
      if (!image) {
        return res.status(404).json({
          error: "Not Found",
          message: "Image not found",
          statusCode: 404,
        });
      }
      return res.status(200).json(image);
    } catch (error) {
      console.error("[API] Error fetching image:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch image",
        statusCode: 500,
      });
    }
  }

  // PATCH - Update image
  if (req.method === "PATCH") {
    try {
      // Handle favorite toggle shortcut
      if (req.body.toggleFavorite === true) {
        const image = await toggleImageFavorite(id);
        if (!image) {
          return res.status(404).json({
            error: "Not Found",
            message: "Image not found",
            statusCode: 404,
          });
        }
        return res.status(200).json(image);
      }

      const parseResult = updateImageSchema.safeParse(req.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((i) => i.message).join(", ");
        return res.status(400).json({
          error: "Bad Request",
          message: errors,
          statusCode: 400,
        });
      }

      const image = await updateImage(id, parseResult.data);
      if (!image) {
        return res.status(404).json({
          error: "Not Found",
          message: "Image not found",
          statusCode: 404,
        });
      }

      return res.status(200).json(image);
    } catch (error) {
      console.error("[API] Error updating image:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to update image",
        statusCode: 500,
      });
    }
  }

  // DELETE - Delete image
  if (req.method === "DELETE") {
    try {
      // Get image first to retrieve S3 key
      const image = await getImageById(id);
      if (!image) {
        return res.status(404).json({
          error: "Not Found",
          message: "Image not found",
          statusCode: 404,
        });
      }

      // Delete from S3
      if (image.s3Key) {
        try {
          await deleteFromS3(image.s3Key);
        } catch (s3Error) {
          console.error("[API] Error deleting image from S3:", s3Error);
          // Continue with DB deletion even if S3 fails
        }
      }

      // Delete thumbnail from S3 if it's an S3 key
      if (image.thumbnailUrl && image.thumbnailUrl.startsWith("images/")) {
        try {
          await deleteFromS3(image.thumbnailUrl);
        } catch (s3Error) {
          console.error("[API] Error deleting thumbnail from S3:", s3Error);
        }
      }

      const deleted = await deleteImage(id);
      if (!deleted) {
        return res.status(404).json({
          error: "Not Found",
          message: "Image not found",
          statusCode: 404,
        });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Error deleting image:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to delete image",
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
