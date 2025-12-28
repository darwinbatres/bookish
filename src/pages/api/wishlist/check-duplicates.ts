import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { searchForDuplicates, DuplicateMatch } from "@/lib/db";
import { withAuth } from "@/lib/api";
import type { ApiError } from "@/types";

// Query validation
const querySchema = z.object({
  title: z.string().min(1, "Title is required"),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DuplicateMatch[] | ApiError>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: `Method ${req.method} not allowed`,
      statusCode: 405,
    });
  }

  try {
    const queryResult = querySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: "Bad Request",
        message: queryResult.error.issues.map((e) => e.message).join(", "),
        statusCode: 400,
      });
    }

    const { title } = queryResult.data;
    const matches = await searchForDuplicates(title);

    return res.status(200).json(matches);
  } catch (error) {
    console.error("[API] Wishlist check-duplicates error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
