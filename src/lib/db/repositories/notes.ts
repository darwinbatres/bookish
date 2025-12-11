import { getPool } from "../pool";
import type { DBNote, PaginatedResponse } from "@/types";

// Internal DB row representation (snake_case from PostgreSQL)
interface DBNoteRow {
  id: string;
  book_id: string;
  page: number;
  content: string;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

interface NotesPaginationParams {
  page?: number;
  limit?: number;
}

function mapDBRowToNote(row: DBNoteRow): DBNote {
  return {
    id: row.id,
    bookId: row.book_id,
    page: row.page,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Get notes for a book with optional pagination
 * @param bookId - The book ID
 * @param params - Optional pagination params. If not provided, returns all notes (for backwards compatibility)
 */
export async function getNotesByBookId(
  bookId: string,
  params?: NotesPaginationParams
): Promise<DBNote[] | PaginatedResponse<DBNote>> {
  const pool = getPool();

  // If no pagination params, return all notes (backwards compatible)
  if (!params || (params.page === undefined && params.limit === undefined)) {
    const result = await pool.query<DBNoteRow>(
      `SELECT * FROM notes WHERE book_id = $1 ORDER BY page ASC, created_at DESC`,
      [bookId]
    );
    return result.rows.map(mapDBRowToNote);
  }

  // Paginated query
  const { page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await pool.query<CountRow>(
    `SELECT COUNT(*) as count FROM notes WHERE book_id = $1`,
    [bookId]
  );
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Get paginated results
  const result = await pool.query<DBNoteRow>(
    `SELECT * FROM notes WHERE book_id = $1 ORDER BY page ASC, created_at DESC LIMIT $2 OFFSET $3`,
    [bookId, limit, offset]
  );

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: result.rows.map(mapDBRowToNote),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function getNotesByPage(
  bookId: string,
  page: number
): Promise<DBNote[]> {
  const pool = getPool();
  const result = await pool.query<DBNoteRow>(
    `SELECT * FROM notes WHERE book_id = $1 AND page = $2 ORDER BY created_at DESC`,
    [bookId, page]
  );
  return result.rows.map(mapDBRowToNote);
}

export async function createNote(
  bookId: string,
  page: number,
  content: string
): Promise<DBNote> {
  const pool = getPool();
  const result = await pool.query<DBNoteRow>(
    `INSERT INTO notes (book_id, page, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [bookId, page, content]
  );
  return mapDBRowToNote(result.rows[0]);
}

export async function updateNote(
  id: string,
  content: string
): Promise<DBNote | null> {
  const pool = getPool();
  const result = await pool.query<DBNoteRow>(
    `UPDATE notes SET content = $1 WHERE id = $2 RETURNING *`,
    [content, id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToNote(result.rows[0]);
}

export async function deleteNote(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(`DELETE FROM notes WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getNoteCount(bookId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notes WHERE book_id = $1`,
    [bookId]
  );
  return parseInt(result.rows[0].count, 10);
}
