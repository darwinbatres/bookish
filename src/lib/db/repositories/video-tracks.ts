/**
 * Video Tracks Repository
 * CRUD operations for video tracks in PostgreSQL
 * Created: December 2024
 */

import { getPool } from "../pool";
import { removeItemFromAllFolders } from "./media-folders";
import type {
  DBVideoTrack,
  VideoFormat,
  PaginationParams,
  PaginatedResponse,
} from "@/types";

// Internal DB row representation (snake_case from PostgreSQL)
interface DBVideoTrackRow {
  id: string;
  title: string;
  description: string | null;
  format: string;
  duration_seconds: number;
  current_position: number;
  s3_key: string;
  file_size: string | number; // BIGINT can come as string
  original_filename: string | null;
  cover_url: string | null;
  total_watching_time: number;
  completed_at: Date | null;
  is_favorite: boolean;
  bookmarks_count?: string;
  folder_count?: string;
  added_at: Date;
  last_played_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

interface CreateVideoTrackInput {
  title: string;
  description?: string;
  format: VideoFormat;
  durationSeconds?: number;
  fileSize: number;
  s3Key: string;
  originalFilename?: string;
  coverUrl?: string;
}

interface UpdateVideoTrackInput {
  title?: string;
  description?: string;
  currentPosition?: number;
  durationSeconds?: number;
  coverUrl?: string;
  completed?: boolean;
  isFavorite?: boolean;
}

// Mapper function
function mapDBRowToVideoTrack(row: DBVideoTrackRow): DBVideoTrack {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    format: row.format as VideoFormat,
    durationSeconds: row.duration_seconds ?? 0,
    currentPosition: row.current_position ?? 0,
    s3Key: row.s3_key,
    fileSize:
      typeof row.file_size === "string"
        ? parseInt(row.file_size, 10)
        : row.file_size,
    originalFilename: row.original_filename ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    totalWatchingTime: row.total_watching_time ?? 0,
    completedAt: row.completed_at?.toISOString(),
    isFavorite: row.is_favorite ?? false,
    bookmarksCount: row.bookmarks_count
      ? parseInt(row.bookmarks_count, 10)
      : undefined,
    folderCount: row.folder_count ? parseInt(row.folder_count, 10) : undefined,
    addedAt: row.added_at.toISOString(),
    lastPlayedAt: row.last_played_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Repository Functions

export async function getAllVideoTracks(): Promise<DBVideoTrack[]> {
  const pool = getPool();
  const result = await pool.query<DBVideoTrackRow>(
    `SELECT 
      v.*,
      COUNT(DISTINCT vb.id)::text as bookmarks_count,
      (SELECT COUNT(*) FROM media_folder_items mfi WHERE mfi.item_id = v.id AND mfi.item_type = 'video')::text as folder_count
    FROM video_tracks v
    LEFT JOIN video_bookmarks vb ON vb.video_id = v.id
    GROUP BY v.id
    ORDER BY v.updated_at DESC`
  );
  return result.rows.map(mapDBRowToVideoTrack);
}

/**
 * Extended pagination params with folder filter
 */
interface ExtendedPaginationParams extends PaginationParams {
  folderId?: string;
  favoritesOnly?: boolean;
}

/**
 * Get video tracks with pagination and search support
 */
export async function getVideoTracksWithPagination(
  params: ExtendedPaginationParams = {}
): Promise<PaginatedResponse<DBVideoTrack>> {
  const pool = getPool();
  const {
    page = 1,
    limit = 20,
    search,
    sortBy = "updatedAt",
    sortOrder = "desc",
    folderId,
    favoritesOnly,
  } = params;

  const offset = (page - 1) * limit;

  // Map sort fields to database columns
  const sortFieldMap: Record<string, string> = {
    title: "v.title",
    updatedAt: "v.updated_at",
    createdAt: "v.created_at",
    lastPlayedAt: "v.last_played_at",
  };
  const sortColumn = sortFieldMap[sortBy] || "v.updated_at";
  const order = sortOrder === "asc" ? "ASC" : "DESC";

  // Build the query with optional search and folder filter
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    whereClauses.push(
      `(v.title ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex})`
    );
    queryParams.push(searchPattern);
    paramIndex++;
  }

  if (folderId) {
    whereClauses.push(
      `v.id IN (SELECT item_id FROM media_folder_items WHERE folder_id = $${paramIndex} AND item_type = 'video')`
    );
    queryParams.push(folderId);
    paramIndex++;
  }

  if (favoritesOnly) {
    whereClauses.push(`v.is_favorite = true`);
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM video_tracks v ${whereClause}`;
  const countResult = await pool.query<CountRow>(countQuery, queryParams);
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Get paginated results
  const dataQuery = `
    SELECT 
      v.*,
      COUNT(DISTINCT vb.id)::text as bookmarks_count,
      (SELECT COUNT(*) FROM media_folder_items mfi WHERE mfi.item_id = v.id AND mfi.item_type = 'video')::text as folder_count
    FROM video_tracks v
    LEFT JOIN video_bookmarks vb ON vb.video_id = v.id
    ${whereClause}
    GROUP BY v.id
    ORDER BY ${sortColumn} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataParams = [...queryParams, limit, offset];
  const dataResult = await pool.query<DBVideoTrackRow>(dataQuery, dataParams);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: dataResult.rows.map(mapDBRowToVideoTrack),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function getVideoTrackById(
  id: string
): Promise<DBVideoTrack | null> {
  const pool = getPool();
  const result = await pool.query<DBVideoTrackRow>(
    `SELECT 
      v.*,
      COUNT(DISTINCT vb.id)::text as bookmarks_count,
      (SELECT COUNT(*) FROM media_folder_items mfi WHERE mfi.item_id = v.id AND mfi.item_type = 'video')::text as folder_count
    FROM video_tracks v
    LEFT JOIN video_bookmarks vb ON vb.video_id = v.id
    WHERE v.id = $1
    GROUP BY v.id`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToVideoTrack(result.rows[0]);
}

export async function getVideoTrackByS3Key(
  s3Key: string
): Promise<DBVideoTrack | null> {
  const pool = getPool();
  const result = await pool.query<DBVideoTrackRow>(
    `SELECT * FROM video_tracks WHERE s3_key = $1`,
    [s3Key]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToVideoTrack(result.rows[0]);
}

export async function createVideoTrack(
  input: CreateVideoTrackInput
): Promise<DBVideoTrack> {
  const pool = getPool();
  const result = await pool.query<DBVideoTrackRow>(
    `INSERT INTO video_tracks (title, description, format, duration_seconds, file_size, s3_key, original_filename, cover_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.title,
      input.description ?? null,
      input.format,
      input.durationSeconds ?? 0,
      input.fileSize,
      input.s3Key,
      input.originalFilename ?? null,
      input.coverUrl ?? null,
    ]
  );
  return mapDBRowToVideoTrack(result.rows[0]);
}

export async function updateVideoTrack(
  id: string,
  input: UpdateVideoTrackInput
): Promise<DBVideoTrack | null> {
  const pool = getPool();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  if (input.currentPosition !== undefined) {
    updates.push(`current_position = $${paramIndex++}`);
    values.push(input.currentPosition);
    // Also update last_played_at when position changes
    updates.push(`last_played_at = NOW()`);
  }
  if (input.durationSeconds !== undefined) {
    updates.push(`duration_seconds = $${paramIndex++}`);
    values.push(input.durationSeconds);
  }
  if (input.coverUrl !== undefined) {
    updates.push(`cover_url = $${paramIndex++}`);
    values.push(input.coverUrl);
  }
  if (input.completed === true) {
    updates.push(`completed_at = NOW()`);
  }
  if (input.isFavorite !== undefined) {
    updates.push(`is_favorite = $${paramIndex++}`);
    values.push(input.isFavorite);
  }

  if (updates.length === 0) return getVideoTrackById(id);

  values.push(id);

  const result = await pool.query<DBVideoTrackRow>(
    `UPDATE video_tracks SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapDBRowToVideoTrack(result.rows[0]);
}

export async function updateWatchingProgress(
  id: string,
  currentPosition: number
): Promise<DBVideoTrack | null> {
  return updateVideoTrack(id, { currentPosition });
}

export async function addWatchingTime(
  id: string,
  seconds: number
): Promise<DBVideoTrack | null> {
  const pool = getPool();
  const result = await pool.query<DBVideoTrackRow>(
    `UPDATE video_tracks 
     SET total_watching_time = total_watching_time + $2,
         last_played_at = NOW()
     WHERE id = $1 
     RETURNING *`,
    [id, seconds]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToVideoTrack(result.rows[0]);
}

export async function deleteVideoTrack(id: string): Promise<string | null> {
  const pool = getPool();

  // Remove from all folders first
  await removeItemFromAllFolders("video", id);

  const result = await pool.query<{ s3_key: string }>(
    `DELETE FROM video_tracks WHERE id = $1 RETURNING s3_key`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].s3_key;
}

export async function searchVideoTracks(
  query: string
): Promise<DBVideoTrack[]> {
  const pool = getPool();
  const searchPattern = `%${query}%`;
  const result = await pool.query<DBVideoTrackRow>(
    `SELECT * FROM video_tracks 
     WHERE title ILIKE $1 OR description ILIKE $1
     ORDER BY updated_at DESC`,
    [searchPattern]
  );
  return result.rows.map(mapDBRowToVideoTrack);
}

export async function getVideoTrackCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM video_tracks`
  );
  return parseInt(result.rows[0].count, 10);
}

export async function getTotalWatchingTime(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(total_watching_time), 0) as total FROM video_tracks`
  );
  return parseInt(result.rows[0].total, 10);
}

export async function getFavoriteVideoTracks(): Promise<DBVideoTrack[]> {
  const pool = getPool();
  const result = await pool.query<DBVideoTrackRow>(
    `SELECT 
      v.*,
      COUNT(DISTINCT vb.id)::text as bookmarks_count
    FROM video_tracks v
    LEFT JOIN video_bookmarks vb ON vb.video_id = v.id
    WHERE v.is_favorite = true
    GROUP BY v.id
    ORDER BY v.updated_at DESC`
  );
  return result.rows.map(mapDBRowToVideoTrack);
}
