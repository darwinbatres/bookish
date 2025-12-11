import type { NextApiRequest, NextApiResponse } from "next";
import {
  startSession,
  endSession,
  getActiveSession,
  markBookCompleted,
} from "@/lib/db/repositories";
import { withAuth } from "@/lib/api";
import type { DBReadingSession } from "@/types";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    DBReadingSession | { error: string } | { completed: boolean }
  >
) {
  const { id: bookId } = req.query;

  if (typeof bookId !== "string") {
    return res.status(400).json({ error: "Invalid book ID" });
  }

  try {
    // Start a new reading session
    if (req.method === "POST") {
      const { startPage } = req.body;

      if (typeof startPage !== "number") {
        return res.status(400).json({ error: "startPage is required" });
      }

      const session = await startSession(bookId, startPage);
      return res.status(201).json(session);
    }

    // End a reading session
    if (req.method === "PATCH") {
      const { sessionId, endPage, isCompleted } = req.body;

      if (typeof sessionId !== "string" || typeof endPage !== "number") {
        return res
          .status(400)
          .json({ error: "sessionId and endPage are required" });
      }

      const session = await endSession(sessionId, endPage);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Mark book as completed if 100%
      if (isCompleted) {
        await markBookCompleted(bookId);
        return res.status(200).json({ ...session, completed: true } as any);
      }

      return res.status(200).json(session);
    }

    // Get active session
    if (req.method === "GET") {
      const session = await getActiveSession(bookId);
      if (!session) {
        return res.status(404).json({ error: "No active session" });
      }
      return res.status(200).json(session);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("[API] Sessions error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withAuth(handler);
