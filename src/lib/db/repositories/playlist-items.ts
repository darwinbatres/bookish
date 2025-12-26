import { getPool } from "../pool";
import type { DBPlaylistItem, DBAudioTrack, AudioFormat } from "@/types";

interface DBPlaylistItemRow {
  id: string;
  playlist_id: string;
  track_id: string;
  sort_order: number;
  added_at: Date;
  // Track fields when joined
  track_title?: string;
  track_artist?: string | null;
  track_album?: string | null;
  track_format?: string;
  track_duration_seconds?: number;
  track_current_position?: number;
  track_s3_key?: string;
  track_file_size?: string | number;
  track_cover_url?: string | null;
  track_total_listening_time?: number;
  track_completed_at?: Date | null;
  track_is_favorite?: boolean;
  track_added_at?: Date;
  track_last_played_at?: Date | null;
  track_created_at?: Date;
  track_updated_at?: Date;
}

function mapDBRowToPlaylistItem(row: DBPlaylistItemRow): DBPlaylistItem {
  const item: DBPlaylistItem = {
    id: row.id,
    playlistId: row.playlist_id,
    trackId: row.track_id,
    sortOrder: row.sort_order,
    addedAt: row.added_at.toISOString(),
  };

  // Include track data if joined
  if (row.track_title) {
    item.track = {
      id: row.track_id,
      title: row.track_title,
      artist: row.track_artist ?? undefined,
      album: row.track_album ?? undefined,
      format: (row.track_format as AudioFormat) ?? "mp3",
      durationSeconds: row.track_duration_seconds ?? 0,
      currentPosition: row.track_current_position ?? 0,
      s3Key: row.track_s3_key ?? "",
      fileSize: typeof row.track_file_size === "string" 
        ? parseInt(row.track_file_size, 10) 
        : (row.track_file_size ?? 0),
      coverUrl: row.track_cover_url ?? undefined,
      totalListeningTime: row.track_total_listening_time ?? 0,
      completedAt: row.track_completed_at?.toISOString(),
      isFavorite: row.track_is_favorite ?? false,
      addedAt: row.track_added_at?.toISOString() ?? new Date().toISOString(),
      lastPlayedAt: row.track_last_played_at?.toISOString(),
      createdAt: row.track_created_at?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.track_updated_at?.toISOString() ?? new Date().toISOString(),
    };
  }

  return item;
}

export async function getPlaylistItems(playlistId: string): Promise<DBPlaylistItem[]> {
  const pool = getPool();
  const result = await pool.query<DBPlaylistItemRow>(
    `SELECT 
      pi.*,
      a.title as track_title,
      a.artist as track_artist,
      a.album as track_album,
      a.format as track_format,
      a.duration_seconds as track_duration_seconds,
      a.current_position as track_current_position,
      a.s3_key as track_s3_key,
      a.file_size as track_file_size,
      a.cover_url as track_cover_url,
      a.total_listening_time as track_total_listening_time,
      a.completed_at as track_completed_at,
      a.is_favorite as track_is_favorite,
      a.added_at as track_added_at,
      a.last_played_at as track_last_played_at,
      a.created_at as track_created_at,
      a.updated_at as track_updated_at
    FROM playlist_items pi
    LEFT JOIN audio_tracks a ON a.id = pi.track_id
    WHERE pi.playlist_id = $1
    ORDER BY pi.sort_order ASC`,
    [playlistId]
  );
  return result.rows.map(mapDBRowToPlaylistItem);
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
  sortOrder?: number
): Promise<DBPlaylistItem> {
  const pool = getPool();

  // If no sort order provided, get the next one
  let order = sortOrder;
  if (order === undefined) {
    const maxResult = await pool.query<{ max: number | null }>(
      `SELECT MAX(sort_order) as max FROM playlist_items WHERE playlist_id = $1`,
      [playlistId]
    );
    order = (maxResult.rows[0]?.max ?? -1) + 1;
  }

  const result = await pool.query<DBPlaylistItemRow>(
    `INSERT INTO playlist_items (playlist_id, track_id, sort_order)
     VALUES ($1, $2, $3)
     ON CONFLICT (playlist_id, track_id) DO UPDATE SET sort_order = $3
     RETURNING *`,
    [playlistId, trackId, order]
  );

  return mapDBRowToPlaylistItem(result.rows[0]);
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM playlist_items WHERE playlist_id = $1 AND track_id = $2 RETURNING id`,
    [playlistId, trackId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function reorderPlaylistItems(
  playlistId: string,
  items: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of items) {
      await client.query(
        `UPDATE playlist_items SET sort_order = $1 WHERE id = $2 AND playlist_id = $3`,
        [item.sortOrder, item.id, playlistId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function clearPlaylist(playlistId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM playlist_items WHERE playlist_id = $1`,
    [playlistId]
  );
  return result.rowCount ?? 0;
}

export async function getPlaylistItemCount(playlistId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = $1`,
    [playlistId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function isTrackInPlaylist(
  playlistId: string,
  trackId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM playlist_items WHERE playlist_id = $1 AND track_id = $2
    ) as exists`,
    [playlistId, trackId]
  );
  return result.rows[0].exists;
}
