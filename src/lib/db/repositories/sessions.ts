import { getPool } from "../pool";
import type { DBReadingSession } from "@/types";

interface DBSessionRow {
  id: string;
  book_id: string;
  started_at: Date;
  ended_at: Date | null;
  start_page: number;
  end_page: number | null;
  duration_seconds: number | null;
}

function mapDBRowToSession(row: DBSessionRow): DBReadingSession {
  return {
    id: row.id,
    bookId: row.book_id,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at?.toISOString(),
    startPage: row.start_page,
    endPage: row.end_page ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
  };
}

/**
 * Start a new reading session
 */
export async function startSession(
  bookId: string,
  startPage: number
): Promise<DBReadingSession> {
  const pool = getPool();
  const result = await pool.query<DBSessionRow>(
    `INSERT INTO reading_sessions (book_id, start_page)
     VALUES ($1, $2)
     RETURNING *`,
    [bookId, startPage]
  );
  return mapDBRowToSession(result.rows[0]);
}

/**
 * End a reading session and update book's total reading time
 */
export async function endSession(
  sessionId: string,
  endPage: number
): Promise<DBReadingSession | null> {
  const pool = getPool();
  
  // End the session and calculate duration
  const result = await pool.query<DBSessionRow>(
    `UPDATE reading_sessions 
     SET ended_at = NOW(),
         end_page = $2,
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
     WHERE id = $1
     RETURNING *`,
    [sessionId, endPage]
  );

  if (!result.rows[0]) return null;

  const session = mapDBRowToSession(result.rows[0]);

  // Update book's total reading time
  if (session.durationSeconds) {
    await pool.query(
      `UPDATE books 
       SET total_reading_time = total_reading_time + $1,
           last_opened_at = NOW()
       WHERE id = $2`,
      [session.durationSeconds, session.bookId]
    );
  }

  return session;
}

/**
 * Get reading stats for a book
 */
export async function getBookReadingStats(bookId: string): Promise<{
  totalSessions: number;
  totalReadingTime: number;
  averageSessionLength: number;
  lastReadAt: string | null;
}> {
  const pool = getPool();
  const result = await pool.query<{
    total_sessions: string;
    total_time: string | null;
    avg_session: string | null;
    last_read: Date | null;
  }>(
    `SELECT 
      COUNT(*) as total_sessions,
      SUM(duration_seconds) as total_time,
      AVG(duration_seconds) as avg_session,
      MAX(ended_at) as last_read
     FROM reading_sessions
     WHERE book_id = $1 AND ended_at IS NOT NULL`,
    [bookId]
  );

  const row = result.rows[0];
  return {
    totalSessions: parseInt(row.total_sessions, 10),
    totalReadingTime: parseInt(row.total_time || "0", 10),
    averageSessionLength: Math.round(parseFloat(row.avg_session || "0")),
    lastReadAt: row.last_read?.toISOString() ?? null,
  };
}

/**
 * Get active session for a book
 */
export async function getActiveSession(
  bookId: string
): Promise<DBReadingSession | null> {
  const pool = getPool();
  const result = await pool.query<DBSessionRow>(
    `SELECT * FROM reading_sessions
     WHERE book_id = $1 AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [bookId]
  );
  return result.rows[0] ? mapDBRowToSession(result.rows[0]) : null;
}

/**
 * Mark book as completed
 */
export async function markBookCompleted(bookId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE books SET completed_at = NOW() WHERE id = $1 AND completed_at IS NULL`,
    [bookId]
  );
  return (result.rowCount ?? 0) > 0;
}
