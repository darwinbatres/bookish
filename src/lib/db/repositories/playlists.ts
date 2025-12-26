import { getPool } from "../pool";
import type { DBPlaylist } from "@/types";

interface DBPlaylistRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  track_count?: string;
  total_duration?: string;
  created_at: Date;
  updated_at: Date;
}

function mapDBRowToPlaylist(row: DBPlaylistRow): DBPlaylist {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    trackCount: row.track_count ? parseInt(row.track_count, 10) : undefined,
    totalDuration: row.total_duration ? parseInt(row.total_duration, 10) : undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getAllPlaylists(): Promise<DBPlaylist[]> {
  const pool = getPool();
  const result = await pool.query<DBPlaylistRow>(
    `SELECT 
      p.*,
      COUNT(pi.id)::text as track_count,
      COALESCE(SUM(a.duration_seconds), 0)::text as total_duration
    FROM playlists p
    LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
    LEFT JOIN audio_tracks a ON a.id = pi.track_id
    GROUP BY p.id
    ORDER BY p.sort_order ASC, p.name ASC`
  );
  return result.rows.map(mapDBRowToPlaylist);
}

export async function getPlaylistById(id: string): Promise<DBPlaylist | null> {
  const pool = getPool();
  const result = await pool.query<DBPlaylistRow>(
    `SELECT 
      p.*,
      COUNT(pi.id)::text as track_count,
      COALESCE(SUM(a.duration_seconds), 0)::text as total_duration
    FROM playlists p
    LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
    LEFT JOIN audio_tracks a ON a.id = pi.track_id
    WHERE p.id = $1
    GROUP BY p.id`,
    [id]
  );
  return result.rows[0] ? mapDBRowToPlaylist(result.rows[0]) : null;
}

interface CreatePlaylistInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export async function createPlaylist(
  input: CreatePlaylistInput
): Promise<DBPlaylist> {
  const pool = getPool();
  
  // Get next sort order
  const sortResult = await pool.query<{ max: number | null }>(
    "SELECT MAX(sort_order) as max FROM playlists"
  );
  const nextSortOrder = (sortResult.rows[0]?.max ?? -1) + 1;

  const result = await pool.query<DBPlaylistRow>(
    `INSERT INTO playlists (name, description, color, icon, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.name,
      input.description || null,
      input.color || "#6366f1",
      input.icon || "music",
      nextSortOrder,
    ]
  );
  return mapDBRowToPlaylist(result.rows[0]);
}

interface UpdatePlaylistInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export async function updatePlaylist(
  id: string,
  input: UpdatePlaylistInput
): Promise<DBPlaylist | null> {
  const pool = getPool();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  if (input.color !== undefined) {
    updates.push(`color = $${paramIndex++}`);
    values.push(input.color);
  }
  if (input.icon !== undefined) {
    updates.push(`icon = $${paramIndex++}`);
    values.push(input.icon);
  }
  if (input.sortOrder !== undefined) {
    updates.push(`sort_order = $${paramIndex++}`);
    values.push(input.sortOrder);
  }

  if (updates.length === 0) return getPlaylistById(id);

  values.push(id);

  const result = await pool.query<DBPlaylistRow>(
    `UPDATE playlists SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapDBRowToPlaylist(result.rows[0]);
}

export async function deletePlaylist(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM playlists WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function searchPlaylists(query: string): Promise<DBPlaylist[]> {
  const pool = getPool();
  const searchPattern = `%${query}%`;
  const result = await pool.query<DBPlaylistRow>(
    `SELECT 
      p.*,
      COUNT(pi.id)::text as track_count,
      COALESCE(SUM(a.duration_seconds), 0)::text as total_duration
    FROM playlists p
    LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
    LEFT JOIN audio_tracks a ON a.id = pi.track_id
    WHERE p.name ILIKE $1 OR p.description ILIKE $1
    GROUP BY p.id
    ORDER BY p.sort_order ASC, p.name ASC`,
    [searchPattern]
  );
  return result.rows.map(mapDBRowToPlaylist);
}

export async function getPlaylistCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM playlists`
  );
  return parseInt(result.rows[0].count, 10);
}
