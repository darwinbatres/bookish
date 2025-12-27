/**
 * Video Bookmarks Repository
 * CRUD operations for video timestamp bookmarks
 * Created: December 2024
 */

import { getPool } from "../pool";
import type { DBVideoBookmark } from "@/types";

interface DBVideoBookmarkRow {
  id: string;
  video_id: string;
  position_seconds: number;
  label: string | null;
  created_at: Date;
}

function mapDBRowToVideoBookmark(row: DBVideoBookmarkRow): DBVideoBookmark {
  return {
    id: row.id,
    videoId: row.video_id,
    positionSeconds: row.position_seconds,
    label: row.label ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getVideoBookmarks(
  videoId: string
): Promise<DBVideoBookmark[]> {
  const pool = getPool();
  const result = await pool.query<DBVideoBookmarkRow>(
    `SELECT * FROM video_bookmarks WHERE video_id = $1 ORDER BY position_seconds ASC`,
    [videoId]
  );
  return result.rows.map(mapDBRowToVideoBookmark);
}

export async function getVideoBookmarkById(
  id: string
): Promise<DBVideoBookmark | null> {
  const pool = getPool();
  const result = await pool.query<DBVideoBookmarkRow>(
    `SELECT * FROM video_bookmarks WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToVideoBookmark(result.rows[0]);
}

export async function createVideoBookmark(
  videoId: string,
  positionSeconds: number,
  label?: string
): Promise<DBVideoBookmark> {
  const pool = getPool();
  const result = await pool.query<DBVideoBookmarkRow>(
    `INSERT INTO video_bookmarks (video_id, position_seconds, label)
     VALUES ($1, $2, $3)
     ON CONFLICT (video_id, position_seconds) 
     DO UPDATE SET label = COALESCE($3, video_bookmarks.label)
     RETURNING *`,
    [videoId, positionSeconds, label ?? null]
  );
  return mapDBRowToVideoBookmark(result.rows[0]);
}

export async function updateVideoBookmark(
  id: string,
  label: string
): Promise<DBVideoBookmark | null> {
  const pool = getPool();
  const result = await pool.query<DBVideoBookmarkRow>(
    `UPDATE video_bookmarks SET label = $2 WHERE id = $1 RETURNING *`,
    [id, label]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToVideoBookmark(result.rows[0]);
}

export async function deleteVideoBookmark(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM video_bookmarks WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function deleteVideoBookmarkByPosition(
  videoId: string,
  positionSeconds: number
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM video_bookmarks WHERE video_id = $1 AND position_seconds = $2 RETURNING id`,
    [videoId, positionSeconds]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getVideoBookmarkCount(videoId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM video_bookmarks WHERE video_id = $1`,
    [videoId]
  );
  return parseInt(result.rows[0].count, 10);
}
