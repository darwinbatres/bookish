import { getPool } from "../pool";
import type { DBAudioBookmark } from "@/types";

interface DBAudioBookmarkRow {
  id: string;
  track_id: string;
  position_seconds: number;
  label: string | null;
  created_at: Date;
}

function mapDBRowToAudioBookmark(row: DBAudioBookmarkRow): DBAudioBookmark {
  return {
    id: row.id,
    trackId: row.track_id,
    positionSeconds: row.position_seconds,
    label: row.label ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getAudioBookmarks(trackId: string): Promise<DBAudioBookmark[]> {
  const pool = getPool();
  const result = await pool.query<DBAudioBookmarkRow>(
    `SELECT * FROM audio_bookmarks WHERE track_id = $1 ORDER BY position_seconds ASC`,
    [trackId]
  );
  return result.rows.map(mapDBRowToAudioBookmark);
}

export async function getAudioBookmarkById(id: string): Promise<DBAudioBookmark | null> {
  const pool = getPool();
  const result = await pool.query<DBAudioBookmarkRow>(
    `SELECT * FROM audio_bookmarks WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToAudioBookmark(result.rows[0]);
}

export async function createAudioBookmark(
  trackId: string,
  positionSeconds: number,
  label?: string
): Promise<DBAudioBookmark> {
  const pool = getPool();
  const result = await pool.query<DBAudioBookmarkRow>(
    `INSERT INTO audio_bookmarks (track_id, position_seconds, label)
     VALUES ($1, $2, $3)
     ON CONFLICT (track_id, position_seconds) 
     DO UPDATE SET label = COALESCE($3, audio_bookmarks.label)
     RETURNING *`,
    [trackId, positionSeconds, label ?? null]
  );
  return mapDBRowToAudioBookmark(result.rows[0]);
}

export async function updateAudioBookmark(
  id: string,
  label: string
): Promise<DBAudioBookmark | null> {
  const pool = getPool();
  const result = await pool.query<DBAudioBookmarkRow>(
    `UPDATE audio_bookmarks SET label = $2 WHERE id = $1 RETURNING *`,
    [id, label]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToAudioBookmark(result.rows[0]);
}

export async function deleteAudioBookmark(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM audio_bookmarks WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function deleteAudioBookmarkByPosition(
  trackId: string,
  positionSeconds: number
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM audio_bookmarks WHERE track_id = $1 AND position_seconds = $2 RETURNING id`,
    [trackId, positionSeconds]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getAudioBookmarkCount(trackId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audio_bookmarks WHERE track_id = $1`,
    [trackId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function hasBookmarkAtPosition(
  trackId: string,
  positionSeconds: number
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM audio_bookmarks WHERE track_id = $1 AND position_seconds = $2
    ) as exists`,
    [trackId, positionSeconds]
  );
  return result.rows[0].exists;
}
