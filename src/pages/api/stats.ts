import type { NextApiRequest, NextApiResponse } from "next";
import {
  getStorageStats,
  type StorageStats,
} from "@/lib/db/repositories/stats";
import { withAuth } from "@/lib/api";
import type { ApiError } from "@/types";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StorageStats | ApiError>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET requests are allowed",
      statusCode: 405,
    });
  }

  try {
    const stats = await getStorageStats();

    // Set cache headers - stats can be cached briefly
    res.setHeader("Cache-Control", "private, max-age=10");

    return res.status(200).json(stats);
  } catch (error) {
    console.error("[API] Stats error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch storage stats",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
