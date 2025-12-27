/**
 * Video Sessions API
 * GET /api/video/[id]/sessions - Get active session
 * POST /api/video/[id]/sessions - Start a session
 * PATCH /api/video/[id]/sessions - End a session
 * Created: December 2024
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  getActiveVideoSession,
  startVideoSession,
  endVideoSession,
  addWatchingTime,
} from "@/lib/db";
import type { DBVideoSession, ApiError } from "@/types";

const startSessionSchema = z.object({
  startPosition: z.number().int().min(0).default(0),
});

const endSessionSchema = z.object({
  sessionId: z.string().uuid(),
  endPosition: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
});

type ResponseData = DBVideoSession | null | { success: boolean } | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Video ID is required",
      statusCode: 400,
    });
  }

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid video ID format",
      statusCode: 400,
    });
  }

  // GET - Get active session
  if (req.method === "GET") {
    try {
      const session = await getActiveVideoSession(id);
      return res.status(200).json(session);
    } catch (error) {
      console.error("[API] Error fetching video session:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch session",
        statusCode: 500,
      });
    }
  }

  // POST - Start session
  if (req.method === "POST") {
    try {
      const parseResult = startSessionSchema.safeParse(req.body);

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

      const { startPosition } = parseResult.data;
      const session = await startVideoSession(id, startPosition);
      return res.status(201).json(session);
    } catch (error) {
      console.error("[API] Error starting video session:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to start session",
        statusCode: 500,
      });
    }
  }

  // PATCH - End session
  if (req.method === "PATCH") {
    try {
      const parseResult = endSessionSchema.safeParse(req.body);

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

      const { sessionId, endPosition, durationSeconds } = parseResult.data;

      // End the session
      const session = await endVideoSession(
        sessionId,
        endPosition,
        durationSeconds
      );

      // Add to total watching time
      if (durationSeconds > 0) {
        await addWatchingTime(id, durationSeconds);
      }

      return res.status(200).json(session);
    } catch (error) {
      console.error("[API] Error ending video session:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to end session",
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
