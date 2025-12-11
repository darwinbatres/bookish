import { getPool } from "../pool";
import type { DBBookmark } from "@/types";

// Internal DB row representation (snake_case from PostgreSQL)
interface DBBookmarkRow {
  id: string;
  book_id: string;
  page: number;
  label: string | null;
  created_at: Date;
}

function mapDBRowToBookmark(row: DBBookmarkRow): DBBookmark {
  return {
    id: row.id,
    bookId: row.book_id,
    page: row.page,
    label: row.label ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getBookmarksByBookId(
  bookId: string
): Promise<DBBookmark[]> {
  const pool = getPool();
  const result = await pool.query<DBBookmarkRow>(
    `SELECT * FROM bookmarks WHERE book_id = $1 ORDER BY page ASC`,
    [bookId]
  );
  return result.rows.map(mapDBRowToBookmark);
}

export async function addBookmark(
  bookId: string,
  page: number,
  label?: string
): Promise<DBBookmark> {
  const pool = getPool();
  const result = await pool.query<DBBookmarkRow>(
    `INSERT INTO bookmarks (book_id, page, label)
     VALUES ($1, $2, $3)
     ON CONFLICT (book_id, page) DO UPDATE SET label = EXCLUDED.label
     RETURNING *`,
    [bookId, page, label ?? null]
  );
  return mapDBRowToBookmark(result.rows[0]);
}

export async function removeBookmark(
  bookId: string,
  page: number
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM bookmarks WHERE book_id = $1 AND page = $2`,
    [bookId, page]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function removeBookmarkById(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(`DELETE FROM bookmarks WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function isPageBookmarked(
  bookId: string,
  page: number
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM bookmarks WHERE book_id = $1 AND page = $2) as exists`,
    [bookId, page]
  );
  return result.rows[0].exists;
}
