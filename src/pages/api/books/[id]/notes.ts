import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  getNotesByBookId,
  getNotesByPage,
  createNote,
  updateNote,
  deleteNote,
} from "@/lib/db";
import { withAuth } from "@/lib/api";
import type { DBNote, ApiError, PaginatedResponse } from "@/types";

const createNoteSchema = z.object({
  page: z.number().positive("Page must be a positive number"),
  content: z.string().min(1, "Content is required"),
});

const updateNoteSchema = z.object({
  id: z.string().uuid("Invalid note ID"),
  content: z.string().min(1, "Content is required"),
});

const deleteNoteSchema = z.object({
  id: z.string().uuid("Invalid note ID"),
});

const querySchema = z.object({
  page: z.coerce.number().positive().optional(),
  // Pagination params for paginated mode
  notesPage: z.coerce.number().positive().optional(),
  limit: z.coerce.number().positive().max(100).optional(),
  paginated: z.coerce.boolean().optional(),
});

type NotesResponse =
  | DBNote[]
  | DBNote
  | PaginatedResponse<DBNote>
  | { success: boolean }
  | ApiError;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NotesResponse>
) {
  const { id: bookId } = req.query;

  if (typeof bookId !== "string" || !bookId) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid book ID",
      statusCode: 400,
    });
  }

  try {
    switch (req.method) {
      case "GET": {
        const query = querySchema.parse(req.query);

        // If page specified, get notes for that specific book page
        if (query.page) {
          const notes = await getNotesByPage(bookId, query.page);
          return res.status(200).json(notes);
        }

        // If pagination requested, return paginated response
        if (query.paginated) {
          const result = await getNotesByBookId(bookId, {
            page: query.notesPage || 1,
            limit: query.limit || 50,
          });
          return res.status(200).json(result);
        }

        // Otherwise, get all notes for the book (backwards compatible)
        const notes = await getNotesByBookId(bookId);
        return res.status(200).json(notes as DBNote[]);
      }

      case "POST": {
        const result = createNoteSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const note = await createNote(
          bookId,
          result.data.page,
          result.data.content
        );
        return res.status(201).json(note);
      }

      case "PATCH":
      case "PUT": {
        const result = updateNoteSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const updated = await updateNote(result.data.id, result.data.content);
        if (!updated) {
          return res.status(404).json({
            error: "Not Found",
            message: "Note not found",
            statusCode: 404,
          });
        }
        return res.status(200).json(updated);
      }

      case "DELETE": {
        const result = deleteNoteSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: "Bad Request",
            message: result.error.issues.map((e) => e.message).join(", "),
            statusCode: 400,
          });
        }

        const deleted = await deleteNote(result.data.id);
        if (!deleted) {
          return res.status(404).json({
            error: "Not Found",
            message: "Note not found",
            statusCode: 404,
          });
        }
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({
          error: "Method Not Allowed",
          message:
            "Only GET, POST, PATCH, PUT, and DELETE requests are allowed",
          statusCode: 405,
        });
    }
  } catch (error) {
    console.error("[API] Notes error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
      statusCode: 500,
    });
  }
}

export default withAuth(handler);
