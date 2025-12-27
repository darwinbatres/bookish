/**
 * Video Sessions Repository
 * CRUD operations for video watching sessions (analytics and resume)
 * Created: December 2024
 */

import { getPool } from "../pool";
import type { DBVideoSession } from "@/types";

interface DBVideoSessionRow {
  id: string;
  video_id: string;
  started_at: Date;
  ended_at: Date | null;
  start_position: number;
  end_position: number | null;
  duration_seconds: number | null;
}

function mapDBRowToVideoSession(row: DBVideoSessionRow): DBVideoSession {
  return {
    id: row.id,
    videoId: row.video_id,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at?.toISOString(),
    startPosition: row.start_position,
    endPosition: row.end_position ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
  };
}

export async function getVideoSessions(
  videoId: string
): Promise<DBVideoSession[]> {
  const pool = getPool();
  const result = await pool.query<DBVideoSessionRow>(
    `SELECT * FROM video_sessions WHERE video_id = $1 ORDER BY started_at DESC`,
    [videoId]
  );
  return result.rows.map(mapDBRowToVideoSession);
}

export async function getActiveVideoSession(
  videoId: string
): Promise<DBVideoSession | null> {
  const pool = getPool();
  const result = await pool.query<DBVideoSessionRow>(
    `SELECT * FROM video_sessions 
     WHERE video_id = $1 AND ended_at IS NULL 
     ORDER BY started_at DESC 
     LIMIT 1`,
    [videoId]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToVideoSession(result.rows[0]);
}

export async function startVideoSession(
  videoId: string,
  startPosition: number
): Promise<DBVideoSession> {
  const pool = getPool();

  // End any existing active sessions for this video first
  await pool.query(
    `UPDATE video_sessions 
     SET ended_at = NOW(), 
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
     WHERE video_id = $1 AND ended_at IS NULL`,
    [videoId]
  );

  const result = await pool.query<DBVideoSessionRow>(
    `INSERT INTO video_sessions (video_id, start_position)
     VALUES ($1, $2)
     RETURNING *`,
    [videoId, startPosition]
  );
  return mapDBRowToVideoSession(result.rows[0]);
}

export async function endVideoSession(
  sessionId: string,
  endPosition: number,
  durationSeconds: number
): Promise<DBVideoSession | null> {
  const pool = getPool();
  const result = await pool.query<DBVideoSessionRow>(
    `UPDATE video_sessions 
     SET ended_at = NOW(), end_position = $2, duration_seconds = $3 
     WHERE id = $1 
     RETURNING *`,
    [sessionId, endPosition, durationSeconds]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToVideoSession(result.rows[0]);
}

export async function getVideoSessionById(
  id: string
): Promise<DBVideoSession | null> {
  const pool = getPool();
  const result = await pool.query<DBVideoSessionRow>(
    `SELECT * FROM video_sessions WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToVideoSession(result.rows[0]);
}

export async function getTotalVideoSessions(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM video_sessions`
  );
  return parseInt(result.rows[0].count, 10);
}

export async function getTotalVideoSessionDuration(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(duration_seconds), 0) as total FROM video_sessions WHERE ended_at IS NOT NULL`
  );
  return parseInt(result.rows[0].total, 10);
}
