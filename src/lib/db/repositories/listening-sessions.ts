import { getPool } from "../pool";
import type { DBListeningSession } from "@/types";

interface DBListeningSessionRow {
  id: string;
  track_id: string;
  started_at: Date;
  ended_at: Date | null;
  start_position: number;
  end_position: number | null;
  duration_seconds: number | null;
}

function mapDBRowToListeningSession(row: DBListeningSessionRow): DBListeningSession {
  return {
    id: row.id,
    trackId: row.track_id,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at?.toISOString(),
    startPosition: row.start_position,
    endPosition: row.end_position ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
  };
}

export async function getListeningSessions(trackId: string): Promise<DBListeningSession[]> {
  const pool = getPool();
  const result = await pool.query<DBListeningSessionRow>(
    `SELECT * FROM listening_sessions WHERE track_id = $1 ORDER BY started_at DESC`,
    [trackId]
  );
  return result.rows.map(mapDBRowToListeningSession);
}

export async function getActiveListeningSession(
  trackId: string
): Promise<DBListeningSession | null> {
  const pool = getPool();
  const result = await pool.query<DBListeningSessionRow>(
    `SELECT * FROM listening_sessions 
     WHERE track_id = $1 AND ended_at IS NULL 
     ORDER BY started_at DESC 
     LIMIT 1`,
    [trackId]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToListeningSession(result.rows[0]);
}

export async function startListeningSession(
  trackId: string,
  startPosition: number
): Promise<DBListeningSession> {
  const pool = getPool();
  
  // End any existing active sessions for this track first
  await pool.query(
    `UPDATE listening_sessions 
     SET ended_at = NOW(), 
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
     WHERE track_id = $1 AND ended_at IS NULL`,
    [trackId]
  );

  const result = await pool.query<DBListeningSessionRow>(
    `INSERT INTO listening_sessions (track_id, start_position)
     VALUES ($1, $2)
     RETURNING *`,
    [trackId, startPosition]
  );
  return mapDBRowToListeningSession(result.rows[0]);
}

export async function endListeningSession(
  sessionId: string,
  endPosition: number,
  durationSeconds: number
): Promise<DBListeningSession | null> {
  const pool = getPool();
  const result = await pool.query<DBListeningSessionRow>(
    `UPDATE listening_sessions 
     SET ended_at = NOW(), end_position = $2, duration_seconds = $3 
     WHERE id = $1 
     RETURNING *`,
    [sessionId, endPosition, durationSeconds]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToListeningSession(result.rows[0]);
}

export async function getSessionById(id: string): Promise<DBListeningSession | null> {
  const pool = getPool();
  const result = await pool.query<DBListeningSessionRow>(
    `SELECT * FROM listening_sessions WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToListeningSession(result.rows[0]);
}

export async function getTotalListeningTimeForTrack(trackId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(duration_seconds), 0) as total 
     FROM listening_sessions 
     WHERE track_id = $1 AND ended_at IS NOT NULL`,
    [trackId]
  );
  return parseInt(result.rows[0].total, 10);
}

export async function getRecentListeningSessions(
  limit: number = 10
): Promise<DBListeningSession[]> {
  const pool = getPool();
  const result = await pool.query<DBListeningSessionRow>(
    `SELECT * FROM listening_sessions 
     WHERE ended_at IS NOT NULL 
     ORDER BY ended_at DESC 
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(mapDBRowToListeningSession);
}

export async function getListeningSessionsInRange(
  startDate: Date,
  endDate: Date
): Promise<DBListeningSession[]> {
  const pool = getPool();
  const result = await pool.query<DBListeningSessionRow>(
    `SELECT * FROM listening_sessions 
     WHERE started_at >= $1 AND started_at <= $2 
     ORDER BY started_at DESC`,
    [startDate, endDate]
  );
  return result.rows.map(mapDBRowToListeningSession);
}

export async function getTotalListeningTimeInRange(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(duration_seconds), 0) as total 
     FROM listening_sessions 
     WHERE started_at >= $1 AND started_at <= $2 AND ended_at IS NOT NULL`,
    [startDate, endDate]
  );
  return parseInt(result.rows[0].total, 10);
}

export async function deleteListeningSession(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM listening_sessions WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function cleanupOldSessions(daysToKeep: number = 90): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM listening_sessions 
     WHERE ended_at IS NOT NULL 
     AND ended_at < NOW() - INTERVAL '1 day' * $1`,
    [daysToKeep]
  );
  return result.rowCount ?? 0;
}
