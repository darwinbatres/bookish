import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api";
import {
  getActiveListeningSession,
  startListeningSession,
  endListeningSession,
  addListeningTime,
} from "@/lib/db";
import type { DBListeningSession, ApiError } from "@/types";

type ResponseData = DBListeningSession | { id: string } | null | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id: trackId } = req.query;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Track ID is required",
      statusCode: 400,
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(trackId)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid track ID format",
      statusCode: 400,
    });
  }

  // GET: Get active session
  if (req.method === "GET") {
    try {
      const session = await getActiveListeningSession(trackId);
      return res.status(200).json(session);
    } catch (error) {
      console.error("[API] Error fetching listening session:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch listening session",
        statusCode: 500,
      });
    }
  }

  // POST: Start a new session
  if (req.method === "POST") {
    try {
      const { startPosition } = req.body;
      const position = typeof startPosition === "number" ? startPosition : 0;
      
      const session = await startListeningSession(trackId, position);
      return res.status(201).json({ id: session.id });
    } catch (error) {
      console.error("[API] Error starting listening session:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to start listening session",
        statusCode: 500,
      });
    }
  }

  // PATCH: End a session
  if (req.method === "PATCH") {
    try {
      const { sessionId, endPosition, durationSeconds } = req.body;

      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({
          error: "Bad Request",
          message: "sessionId is required",
          statusCode: 400,
        });
      }

      if (typeof endPosition !== "number" || typeof durationSeconds !== "number") {
        return res.status(400).json({
          error: "Bad Request",
          message: "endPosition and durationSeconds are required",
          statusCode: 400,
        });
      }

      // End the session
      const session = await endListeningSession(sessionId, endPosition, durationSeconds);
      
      if (!session) {
        return res.status(404).json({
          error: "Not Found",
          message: "Session not found",
          statusCode: 404,
        });
      }

      // Also update total listening time on the track
      if (durationSeconds > 0) {
        await addListeningTime(trackId, durationSeconds);
      }

      return res.status(200).json(session);
    } catch (error) {
      console.error("[API] Error ending listening session:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to end listening session",
        statusCode: 500,
      });
    }
  }

  return res.status(405).json({
    error: "Method Not Allowed",
    message: "Only GET, POST, and PATCH methods are allowed",
    statusCode: 405,
  });
}

export default withAuth(handler);
