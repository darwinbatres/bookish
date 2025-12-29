/**
 * Image Metadata API - Get albums and tags for autocomplete
 * GET /api/images/metadata - Get unique albums and tags
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import { getImageMetadata } from "@/lib/db";
import type { ImageMetadata, ApiError } from "@/types";

type ResponseData = ImageMetadata | ApiError;

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
    const metadata = await getImageMetadata();
    return res.status(200).json(metadata);
  } catch (error) {
    console.error("[API] Error fetching image metadata:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch image metadata",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
