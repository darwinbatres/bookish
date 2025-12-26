import { getPool } from "../pool";
import type {
  DBAudioTrack,
  AudioFormat,
  PaginationParams,
  PaginatedResponse,
} from "@/types";

// Internal DB row representation (snake_case from PostgreSQL)
interface DBAudioTrackRow {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  format: string;
  duration_seconds: number;
  current_position: number;
  s3_key: string;
  file_size: string | number; // BIGINT can come as string
  original_filename: string | null;
  cover_url: string | null;
  total_listening_time: number;
  completed_at: Date | null;
  is_favorite: boolean;
  bookmarks_count?: string;
  added_at: Date;
  last_played_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

interface CreateAudioTrackInput {
  title: string;
  artist?: string;
  album?: string;
  format: AudioFormat;
  durationSeconds: number;
  fileSize: number;
  s3Key: string;
  originalFilename?: string;
  coverUrl?: string;
}

interface UpdateAudioTrackInput {
  title?: string;
  artist?: string;
  album?: string;
  currentPosition?: number;
  durationSeconds?: number;
  coverUrl?: string;
  completed?: boolean;
  isFavorite?: boolean;
}

// Mapper function
function mapDBRowToAudioTrack(row: DBAudioTrackRow): DBAudioTrack {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist ?? undefined,
    album: row.album ?? undefined,
    format: row.format as AudioFormat,
    durationSeconds: row.duration_seconds ?? 0,
    currentPosition: row.current_position ?? 0,
    s3Key: row.s3_key,
    fileSize:
      typeof row.file_size === "string"
        ? parseInt(row.file_size, 10)
        : row.file_size,
    originalFilename: row.original_filename ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    totalListeningTime: row.total_listening_time ?? 0,
    completedAt: row.completed_at?.toISOString(),
    isFavorite: row.is_favorite ?? false,
    bookmarksCount: row.bookmarks_count
      ? parseInt(row.bookmarks_count, 10)
      : undefined,
    addedAt: row.added_at.toISOString(),
    lastPlayedAt: row.last_played_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Repository Functions

export async function getAllAudioTracks(): Promise<DBAudioTrack[]> {
  const pool = getPool();
  const result = await pool.query<DBAudioTrackRow>(
    `SELECT 
      a.*,
      COUNT(DISTINCT ab.id)::text as bookmarks_count
    FROM audio_tracks a
    LEFT JOIN audio_bookmarks ab ON ab.track_id = a.id
    GROUP BY a.id
    ORDER BY a.updated_at DESC`
  );
  return result.rows.map(mapDBRowToAudioTrack);
}

/**
 * Extended pagination params with playlist filter
 */
interface ExtendedPaginationParams extends PaginationParams {
  playlistId?: string;
  favoritesOnly?: boolean;
}

/**
 * Get audio tracks with pagination and search support
 */
export async function getAudioTracksWithPagination(
  params: ExtendedPaginationParams = {}
): Promise<PaginatedResponse<DBAudioTrack>> {
  const pool = getPool();
  const {
    page = 1,
    limit = 20,
    search,
    sortBy = "updatedAt",
    sortOrder = "desc",
    playlistId,
    favoritesOnly,
  } = params;

  const offset = (page - 1) * limit;

  // Map sort fields to database columns
  const sortFieldMap: Record<string, string> = {
    title: "a.title",
    updatedAt: "a.updated_at",
    createdAt: "a.created_at",
    artist: "a.artist",
    album: "a.album",
    lastPlayedAt: "a.last_played_at",
  };
  const sortColumn = sortFieldMap[sortBy] || "a.updated_at";
  const order = sortOrder === "asc" ? "ASC" : "DESC";

  // Build the query with optional search and playlist filter
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    whereClauses.push(
      `(a.title ILIKE $${paramIndex} OR a.artist ILIKE $${paramIndex} OR a.album ILIKE $${paramIndex})`
    );
    queryParams.push(searchPattern);
    paramIndex++;
  }

  if (playlistId) {
    whereClauses.push(
      `a.id IN (SELECT track_id FROM playlist_items WHERE playlist_id = $${paramIndex})`
    );
    queryParams.push(playlistId);
    paramIndex++;
  }

  if (favoritesOnly) {
    whereClauses.push(`a.is_favorite = true`);
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM audio_tracks a ${whereClause}`;
  const countResult = await pool.query<CountRow>(countQuery, queryParams);
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Get paginated results
  const dataQuery = `
    SELECT 
      a.*,
      COUNT(DISTINCT ab.id)::text as bookmarks_count
    FROM audio_tracks a
    LEFT JOIN audio_bookmarks ab ON ab.track_id = a.id
    ${whereClause}
    GROUP BY a.id
    ORDER BY ${sortColumn} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataParams = [...queryParams, limit, offset];
  const dataResult = await pool.query<DBAudioTrackRow>(dataQuery, dataParams);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: dataResult.rows.map(mapDBRowToAudioTrack),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function getAudioTrackById(
  id: string
): Promise<DBAudioTrack | null> {
  const pool = getPool();
  const result = await pool.query<DBAudioTrackRow>(
    `SELECT 
      a.*,
      COUNT(DISTINCT ab.id)::text as bookmarks_count
    FROM audio_tracks a
    LEFT JOIN audio_bookmarks ab ON ab.track_id = a.id
    WHERE a.id = $1
    GROUP BY a.id`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToAudioTrack(result.rows[0]);
}

export async function getAudioTrackByS3Key(
  s3Key: string
): Promise<DBAudioTrack | null> {
  const pool = getPool();
  const result = await pool.query<DBAudioTrackRow>(
    `SELECT * FROM audio_tracks WHERE s3_key = $1`,
    [s3Key]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToAudioTrack(result.rows[0]);
}

export async function createAudioTrack(
  input: CreateAudioTrackInput
): Promise<DBAudioTrack> {
  const pool = getPool();
  const result = await pool.query<DBAudioTrackRow>(
    `INSERT INTO audio_tracks (title, artist, album, format, duration_seconds, file_size, s3_key, original_filename, cover_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.title,
      input.artist ?? null,
      input.album ?? null,
      input.format,
      input.durationSeconds,
      input.fileSize,
      input.s3Key,
      input.originalFilename ?? null,
      input.coverUrl ?? null,
    ]
  );
  return mapDBRowToAudioTrack(result.rows[0]);
}

export async function updateAudioTrack(
  id: string,
  input: UpdateAudioTrackInput
): Promise<DBAudioTrack | null> {
  const pool = getPool();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }
  if (input.artist !== undefined) {
    updates.push(`artist = $${paramIndex++}`);
    values.push(input.artist);
  }
  if (input.album !== undefined) {
    updates.push(`album = $${paramIndex++}`);
    values.push(input.album);
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

  if (updates.length === 0) return getAudioTrackById(id);

  values.push(id);

  const result = await pool.query<DBAudioTrackRow>(
    `UPDATE audio_tracks SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapDBRowToAudioTrack(result.rows[0]);
}

export async function updateListeningProgress(
  id: string,
  currentPosition: number
): Promise<DBAudioTrack | null> {
  return updateAudioTrack(id, { currentPosition });
}

export async function addListeningTime(
  id: string,
  seconds: number
): Promise<DBAudioTrack | null> {
  const pool = getPool();
  const result = await pool.query<DBAudioTrackRow>(
    `UPDATE audio_tracks 
     SET total_listening_time = total_listening_time + $2,
         last_played_at = NOW()
     WHERE id = $1 
     RETURNING *`,
    [id, seconds]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToAudioTrack(result.rows[0]);
}

export async function deleteAudioTrack(id: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ s3_key: string }>(
    `DELETE FROM audio_tracks WHERE id = $1 RETURNING s3_key`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].s3_key;
}

export async function searchAudioTracks(
  query: string
): Promise<DBAudioTrack[]> {
  const pool = getPool();
  const searchPattern = `%${query}%`;
  const result = await pool.query<DBAudioTrackRow>(
    `SELECT * FROM audio_tracks 
     WHERE title ILIKE $1 OR artist ILIKE $1 OR album ILIKE $1
     ORDER BY updated_at DESC`,
    [searchPattern]
  );
  return result.rows.map(mapDBRowToAudioTrack);
}

export async function getAudioTrackCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audio_tracks`
  );
  return parseInt(result.rows[0].count, 10);
}

export async function getTotalListeningTime(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(total_listening_time), 0) as total FROM audio_tracks`
  );
  return parseInt(result.rows[0].total, 10);
}

export async function getFavoriteAudioTracks(): Promise<DBAudioTrack[]> {
  const pool = getPool();
  const result = await pool.query<DBAudioTrackRow>(
    `SELECT 
      a.*,
      COUNT(DISTINCT ab.id)::text as bookmarks_count
    FROM audio_tracks a
    LEFT JOIN audio_bookmarks ab ON ab.track_id = a.id
    WHERE a.is_favorite = true
    GROUP BY a.id
    ORDER BY a.updated_at DESC`
  );
  return result.rows.map(mapDBRowToAudioTrack);
}

/**
 * Get unique albums from existing tracks (for autocomplete)
 */
export async function getUniqueAlbums(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ album: string }>(
    `SELECT DISTINCT album FROM audio_tracks 
     WHERE album IS NOT NULL AND album != ''
     ORDER BY album`
  );
  return result.rows.map((row) => row.album);
}

/**
 * Get unique artists from existing tracks (for autocomplete)
 */
export async function getUniqueArtists(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ artist: string }>(
    `SELECT DISTINCT artist FROM audio_tracks 
     WHERE artist IS NOT NULL AND artist != ''
     ORDER BY artist`
  );
  return result.rows.map((row) => row.artist);
}
