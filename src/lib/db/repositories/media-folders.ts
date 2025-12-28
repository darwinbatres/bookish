/**
 * Media Folders Repository
 * CRUD operations for media folders and their items
 * Created: December 2024
 */

import { getPool } from "../pool";
import type {
  DBMediaFolder,
  DBMediaFolderItem,
  DBMediaFolderItemWithDetails,
  MediaItemType,
  PaginatedResponse,
} from "@/types";

// ============================================================================
// DB Row Types
// ============================================================================

interface DBMediaFolderRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  cover_url: string | null;
  item_count?: string;
  book_count?: string;
  audio_count?: string;
  video_count?: string;
  created_at: Date;
  updated_at: Date;
}

interface DBMediaFolderItemRow {
  id: string;
  folder_id: string;
  item_type: string;
  item_id: string;
  sort_order: number;
  notes: string | null;
  added_at: Date;
  // Joined fields
  item_title?: string;
  item_author?: string;
  item_cover_url?: string;
  item_duration?: number;
  item_progress?: number;
  item_total?: number;
  item_format?: string;
  item_is_favorite?: boolean;
  item_folder_count?: string;
  item_s3_key?: string;
  item_bookmarks_count?: string;
  folder_name?: string;
}

// ============================================================================
// Mappers
// ============================================================================

function mapDBRowToMediaFolder(row: DBMediaFolderRow): DBMediaFolder {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    coverUrl: row.cover_url ?? undefined,
    itemCount: row.item_count ? parseInt(row.item_count, 10) : undefined,
    bookCount: row.book_count ? parseInt(row.book_count, 10) : undefined,
    audioCount: row.audio_count ? parseInt(row.audio_count, 10) : undefined,
    videoCount: row.video_count ? parseInt(row.video_count, 10) : undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapDBRowToMediaFolderItem(
  row: DBMediaFolderItemRow
): DBMediaFolderItem {
  return {
    id: row.id,
    folderId: row.folder_id,
    itemType: row.item_type as MediaItemType,
    itemId: row.item_id,
    sortOrder: row.sort_order,
    notes: row.notes ?? undefined,
    addedAt: row.added_at.toISOString(),
  };
}

function mapDBRowToMediaFolderItemWithDetails(
  row: DBMediaFolderItemRow
): DBMediaFolderItemWithDetails {
  return {
    ...mapDBRowToMediaFolderItem(row),
    itemTitle: row.item_title ?? undefined,
    itemAuthor: row.item_author ?? undefined,
    itemCoverUrl: row.item_cover_url ?? undefined,
    itemDuration: row.item_duration ?? undefined,
    itemProgress: row.item_progress ?? undefined,
    itemTotal: row.item_total ?? undefined,
    itemFormat: row.item_format ?? undefined,
    itemIsFavorite: row.item_is_favorite ?? false,
    itemFolderCount: row.item_folder_count
      ? parseInt(row.item_folder_count, 10)
      : undefined,
    itemS3Key: row.item_s3_key ?? undefined,
    itemBookmarksCount: row.item_bookmarks_count
      ? parseInt(row.item_bookmarks_count, 10)
      : undefined,
    folderName: row.folder_name ?? undefined,
  };
}

// ============================================================================
// Folder CRUD
// ============================================================================

interface MediaFolderPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "name" | "sortOrder" | "updatedAt" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export async function getAllMediaFolders(): Promise<DBMediaFolder[]> {
  const pool = getPool();
  const result = await pool.query<DBMediaFolderRow>(
    `SELECT 
      mf.*,
      COUNT(mfi.id)::text as item_count,
      COUNT(CASE WHEN mfi.item_type = 'book' THEN 1 END)::text as book_count,
      COUNT(CASE WHEN mfi.item_type = 'audio' THEN 1 END)::text as audio_count,
      COUNT(CASE WHEN mfi.item_type = 'video' THEN 1 END)::text as video_count
    FROM media_folders mf
    LEFT JOIN media_folder_items mfi ON mfi.folder_id = mf.id
    GROUP BY mf.id
    ORDER BY mf.sort_order, mf.name`
  );
  return result.rows.map(mapDBRowToMediaFolder);
}

export async function getMediaFoldersWithPagination(
  params: MediaFolderPaginationParams = {}
): Promise<PaginatedResponse<DBMediaFolder>> {
  const pool = getPool();
  const {
    page = 1,
    limit = 20,
    search,
    sortBy = "sortOrder",
    sortOrder = "asc",
  } = params;

  const offset = (page - 1) * limit;

  const sortFieldMap: Record<string, string> = {
    name: "mf.name",
    sortOrder: "mf.sort_order",
    updatedAt: "mf.updated_at",
    createdAt: "mf.created_at",
  };
  const sortColumn = sortFieldMap[sortBy] || "mf.sort_order";
  const order = sortOrder === "desc" ? "DESC" : "ASC";

  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    whereClauses.push(
      `(mf.name ILIKE $${paramIndex} OR COALESCE(mf.description, '') ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search.trim()}%`);
    paramIndex++;
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Count
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM media_folders mf ${whereClause}`,
    queryParams
  );
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Data
  const dataQuery = `
    SELECT 
      mf.*,
      COUNT(mfi.id)::text as item_count,
      COUNT(CASE WHEN mfi.item_type = 'book' THEN 1 END)::text as book_count,
      COUNT(CASE WHEN mfi.item_type = 'audio' THEN 1 END)::text as audio_count,
      COUNT(CASE WHEN mfi.item_type = 'video' THEN 1 END)::text as video_count
    FROM media_folders mf
    LEFT JOIN media_folder_items mfi ON mfi.folder_id = mf.id
    ${whereClause}
    GROUP BY mf.id
    ORDER BY ${sortColumn} ${order}, mf.name
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await pool.query<DBMediaFolderRow>(dataQuery, [
    ...queryParams,
    limit,
    offset,
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: dataResult.rows.map(mapDBRowToMediaFolder),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function getMediaFolderById(
  id: string
): Promise<DBMediaFolder | null> {
  const pool = getPool();
  const result = await pool.query<DBMediaFolderRow>(
    `SELECT 
      mf.*,
      COUNT(mfi.id)::text as item_count,
      COUNT(CASE WHEN mfi.item_type = 'book' THEN 1 END)::text as book_count,
      COUNT(CASE WHEN mfi.item_type = 'audio' THEN 1 END)::text as audio_count,
      COUNT(CASE WHEN mfi.item_type = 'video' THEN 1 END)::text as video_count
    FROM media_folders mf
    LEFT JOIN media_folder_items mfi ON mfi.folder_id = mf.id
    WHERE mf.id = $1
    GROUP BY mf.id`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToMediaFolder(result.rows[0]);
}

interface CreateMediaFolderInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  coverUrl?: string;
}

export async function createMediaFolder(
  input: CreateMediaFolderInput
): Promise<DBMediaFolder> {
  const pool = getPool();

  // Get max sort order
  const sortResult = await pool.query<{ max: string }>(
    `SELECT COALESCE(MAX(sort_order), 0) as max FROM media_folders`
  );
  const nextSortOrder = parseInt(sortResult.rows[0].max, 10) + 1;

  const result = await pool.query<DBMediaFolderRow>(
    `INSERT INTO media_folders (name, description, color, icon, cover_url, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.name,
      input.description ?? null,
      input.color ?? "#6366f1",
      input.icon ?? "folder",
      input.coverUrl ?? null,
      nextSortOrder,
    ]
  );
  return mapDBRowToMediaFolder(result.rows[0]);
}

interface UpdateMediaFolderInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
  coverUrl?: string;
}

export async function updateMediaFolder(
  id: string,
  input: UpdateMediaFolderInput
): Promise<DBMediaFolder | null> {
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
  if (input.coverUrl !== undefined) {
    updates.push(`cover_url = $${paramIndex++}`);
    values.push(input.coverUrl);
  }

  if (updates.length === 0) return getMediaFolderById(id);

  values.push(id);

  const result = await pool.query<DBMediaFolderRow>(
    `UPDATE media_folders SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapDBRowToMediaFolder(result.rows[0]);
}

export async function deleteMediaFolder(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM media_folders WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// ============================================================================
// Folder Items CRUD
// ============================================================================

interface FolderItemsPaginationParams {
  page?: number;
  limit?: number;
  itemType?: "book" | "audio" | "video";
  search?: string;
}

export async function getFolderItems(
  folderId: string
): Promise<DBMediaFolderItemWithDetails[]> {
  const pool = getPool();

  // Complex query that joins with books, audio_tracks, and video_tracks
  // Includes favorite status, folder count, S3 key, and bookmarks count for consistency with library views
  const result = await pool.query<DBMediaFolderItemRow>(
    `SELECT 
      mfi.*,
      COALESCE(b.title, a.title, v.title) as item_title,
      COALESCE(b.author, a.artist) as item_author,
      COALESCE(b.cover_url, a.cover_url, v.cover_url) as item_cover_url,
      COALESCE(a.duration_seconds, v.duration_seconds) as item_duration,
      COALESCE(b.current_page, a.current_position, v.current_position) as item_progress,
      COALESCE(b.total_pages, a.duration_seconds, v.duration_seconds) as item_total,
      COALESCE(b.format, a.format, v.format) as item_format,
      COALESCE(b.is_favorite, a.is_favorite, v.is_favorite) as item_is_favorite,
      COALESCE(b.s3_key, a.s3_key, v.s3_key) as item_s3_key,
      (SELECT COUNT(*) FROM media_folder_items mfi2 WHERE mfi2.item_id = mfi.item_id AND mfi2.item_type = mfi.item_type)::text as item_folder_count,
      (CASE 
        WHEN mfi.item_type = 'audio' THEN (SELECT COUNT(*) FROM audio_bookmarks ab WHERE ab.track_id = mfi.item_id)
        WHEN mfi.item_type = 'video' THEN (SELECT COUNT(*) FROM video_bookmarks vb WHERE vb.video_id = mfi.item_id)
        ELSE 0
      END)::text as item_bookmarks_count
    FROM media_folder_items mfi
    LEFT JOIN books b ON mfi.item_type = 'book' AND mfi.item_id = b.id
    LEFT JOIN audio_tracks a ON mfi.item_type = 'audio' AND mfi.item_id = a.id
    LEFT JOIN video_tracks v ON mfi.item_type = 'video' AND mfi.item_id = v.id
    WHERE mfi.folder_id = $1
    ORDER BY mfi.sort_order, mfi.added_at`,
    [folderId]
  );

  return result.rows.map(mapDBRowToMediaFolderItemWithDetails);
}

export async function getFolderItemsWithPagination(
  folderId: string,
  params: FolderItemsPaginationParams = {}
): Promise<PaginatedResponse<DBMediaFolderItemWithDetails>> {
  const pool = getPool();
  const { page = 1, limit = 20, itemType, search } = params;
  const offset = (page - 1) * limit;

  // Build WHERE clause - requires JOINs for search
  const whereClauses: string[] = ["mfi.folder_id = $1"];
  const queryParams: (string | number)[] = [folderId];
  let paramIndex = 2;

  if (itemType) {
    whereClauses.push(`mfi.item_type = $${paramIndex}`);
    queryParams.push(itemType);
    paramIndex++;
  }

  // Search across item title, author, format, and folder item notes
  // Uses ILIKE for case-insensitive search - efficient with trigram indexes
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereClauses.push(`(
      COALESCE(b.title, a.title, v.title) ILIKE $${paramIndex}
      OR COALESCE(b.author, a.artist, '') ILIKE $${paramIndex}
      OR COALESCE(b.format, a.format, v.format, '') ILIKE $${paramIndex}
      OR COALESCE(mfi.notes, '') ILIKE $${paramIndex}
      OR COALESCE(a.album, '') ILIKE $${paramIndex}
    )`);
    queryParams.push(searchTerm);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  // Count query - needs JOINs for search filtering
  const countQuery = `
    SELECT COUNT(*) as count 
    FROM media_folder_items mfi
    LEFT JOIN books b ON mfi.item_type = 'book' AND mfi.item_id = b.id
    LEFT JOIN audio_tracks a ON mfi.item_type = 'audio' AND mfi.item_id = a.id
    LEFT JOIN video_tracks v ON mfi.item_type = 'video' AND mfi.item_id = v.id
    WHERE ${whereClause}
  `;
  const countResult = await pool.query<{ count: string }>(
    countQuery,
    queryParams
  );
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Data query - includes favorite status, folder count, S3 key, and bookmarks count for consistency
  const result = await pool.query<DBMediaFolderItemRow>(
    `SELECT 
      mfi.*,
      COALESCE(b.title, a.title, v.title) as item_title,
      COALESCE(b.author, a.artist) as item_author,
      COALESCE(b.cover_url, a.cover_url, v.cover_url) as item_cover_url,
      COALESCE(a.duration_seconds, v.duration_seconds) as item_duration,
      COALESCE(b.current_page, a.current_position, v.current_position) as item_progress,
      COALESCE(b.total_pages, a.duration_seconds, v.duration_seconds) as item_total,
      COALESCE(b.format, a.format, v.format) as item_format,
      COALESCE(b.is_favorite, a.is_favorite, v.is_favorite) as item_is_favorite,
      COALESCE(b.s3_key, a.s3_key, v.s3_key) as item_s3_key,
      (SELECT COUNT(*) FROM media_folder_items mfi2 WHERE mfi2.item_id = mfi.item_id AND mfi2.item_type = mfi.item_type)::text as item_folder_count,
      (CASE 
        WHEN mfi.item_type = 'audio' THEN (SELECT COUNT(*) FROM audio_bookmarks ab WHERE ab.track_id = mfi.item_id)
        WHEN mfi.item_type = 'video' THEN (SELECT COUNT(*) FROM video_bookmarks vb WHERE vb.video_id = mfi.item_id)
        ELSE 0
      END)::text as item_bookmarks_count
    FROM media_folder_items mfi
    LEFT JOIN books b ON mfi.item_type = 'book' AND mfi.item_id = b.id
    LEFT JOIN audio_tracks a ON mfi.item_type = 'audio' AND mfi.item_id = a.id
    LEFT JOIN video_tracks v ON mfi.item_type = 'video' AND mfi.item_id = v.id
    WHERE ${whereClause}
    ORDER BY mfi.sort_order, mfi.added_at
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...queryParams, limit, offset]
  );

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: result.rows.map(mapDBRowToMediaFolderItemWithDetails),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function addItemToFolder(
  folderId: string,
  itemType: MediaItemType,
  itemId: string,
  notes?: string
): Promise<DBMediaFolderItem> {
  const pool = getPool();

  // Get max sort order for this folder
  const sortResult = await pool.query<{ max: string }>(
    `SELECT COALESCE(MAX(sort_order), 0) as max FROM media_folder_items WHERE folder_id = $1`,
    [folderId]
  );
  const nextSortOrder = parseInt(sortResult.rows[0].max, 10) + 1;

  const result = await pool.query<DBMediaFolderItemRow>(
    `INSERT INTO media_folder_items (folder_id, item_type, item_id, notes, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (folder_id, item_type, item_id) DO UPDATE SET notes = COALESCE($4, media_folder_items.notes)
     RETURNING *`,
    [folderId, itemType, itemId, notes ?? null, nextSortOrder]
  );

  return mapDBRowToMediaFolderItem(result.rows[0]);
}

export async function updateFolderItem(
  itemId: string,
  input: { notes?: string; sortOrder?: number }
): Promise<DBMediaFolderItem | null> {
  const pool = getPool();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.notes !== undefined) {
    updates.push(`notes = $${paramIndex++}`);
    values.push(input.notes);
  }
  if (input.sortOrder !== undefined) {
    updates.push(`sort_order = $${paramIndex++}`);
    values.push(input.sortOrder);
  }

  if (updates.length === 0) return null;

  values.push(itemId);

  const result = await pool.query<DBMediaFolderItemRow>(
    `UPDATE media_folder_items SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapDBRowToMediaFolderItem(result.rows[0]);
}

export async function removeItemFromFolder(itemId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM media_folder_items WHERE id = $1 RETURNING id`,
    [itemId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function removeItemFromFolderByRef(
  folderId: string,
  itemType: MediaItemType,
  itemId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM media_folder_items 
     WHERE folder_id = $1 AND item_type = $2 AND item_id = $3 
     RETURNING id`,
    [folderId, itemType, itemId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function reorderFolderItems(
  folderId: string,
  itemIds: string[]
): Promise<void> {
  const pool = getPool();

  // Update sort_order for each item
  const updates = itemIds.map((id, index) =>
    pool.query(
      `UPDATE media_folder_items SET sort_order = $1 WHERE id = $2 AND folder_id = $3`,
      [index, id, folderId]
    )
  );

  await Promise.all(updates);
}

export async function getMediaFolderCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM media_folders`
  );
  return parseInt(result.rows[0].count, 10);
}

export async function getMediaFolderItemCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM media_folder_items`
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get folders that contain a specific item
 */
export async function getFoldersContainingItem(
  itemType: MediaItemType,
  itemId: string
): Promise<DBMediaFolder[]> {
  const pool = getPool();
  const result = await pool.query<DBMediaFolderRow>(
    `SELECT mf.*
     FROM media_folders mf
     INNER JOIN media_folder_items mfi ON mfi.folder_id = mf.id
     WHERE mfi.item_type = $1 AND mfi.item_id = $2
     ORDER BY mf.name`,
    [itemType, itemId]
  );
  return result.rows.map(mapDBRowToMediaFolder);
}

/**
 * Remove all folder references for a specific item
 * Called when the item itself is deleted from its category
 */
export async function removeItemFromAllFolders(
  itemType: MediaItemType,
  itemId: string
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM media_folder_items 
     WHERE item_type = $1 AND item_id = $2`,
    [itemType, itemId]
  );
  return result.rowCount ?? 0;
}

/**
 * Search items across all folders
 * Returns paginated results with folder name included
 */
interface GlobalItemsSearchParams {
  page?: number;
  limit?: number;
  itemType?: "book" | "audio" | "video";
  search: string; // Required for global search
}

export async function searchItemsAcrossAllFolders(
  params: GlobalItemsSearchParams
): Promise<PaginatedResponse<DBMediaFolderItemWithDetails>> {
  const pool = getPool();
  const { page = 1, limit = 20, itemType, search } = params;
  const offset = (page - 1) * limit;

  // Build WHERE clause
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  // Search is required for this function
  // Also search by folder name/description so items in matching folders appear
  const searchTerm = `%${search.trim()}%`;
  whereClauses.push(`(
    COALESCE(b.title, a.title, v.title) ILIKE $${paramIndex}
    OR COALESCE(b.author, a.artist, '') ILIKE $${paramIndex}
    OR COALESCE(b.format, a.format, v.format, '') ILIKE $${paramIndex}
    OR COALESCE(mfi.notes, '') ILIKE $${paramIndex}
    OR COALESCE(a.album, '') ILIKE $${paramIndex}
    OR mf.name ILIKE $${paramIndex}
    OR COALESCE(mf.description, '') ILIKE $${paramIndex}
  )`);
  queryParams.push(searchTerm);
  paramIndex++;

  if (itemType) {
    whereClauses.push(`mfi.item_type = $${paramIndex}`);
    queryParams.push(itemType);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  // Count query
  const countQuery = `
    SELECT COUNT(*) as count 
    FROM media_folder_items mfi
    INNER JOIN media_folders mf ON mfi.folder_id = mf.id
    LEFT JOIN books b ON mfi.item_type = 'book' AND mfi.item_id = b.id
    LEFT JOIN audio_tracks a ON mfi.item_type = 'audio' AND mfi.item_id = a.id
    LEFT JOIN video_tracks v ON mfi.item_type = 'video' AND mfi.item_id = v.id
    WHERE ${whereClause}
  `;
  const countResult = await pool.query<{ count: string }>(
    countQuery,
    queryParams
  );
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Data query - includes folder name
  const dataQuery = `
    SELECT 
      mfi.*,
      mf.name as folder_name,
      COALESCE(b.title, a.title, v.title) as item_title,
      COALESCE(b.author, a.artist) as item_author,
      COALESCE(b.cover_url, a.cover_url, v.cover_url) as item_cover_url,
      COALESCE(a.duration_seconds, v.duration_seconds) as item_duration,
      COALESCE(b.current_page, a.current_position, v.current_position) as item_progress,
      COALESCE(b.total_pages, a.duration_seconds, v.duration_seconds) as item_total,
      COALESCE(b.format, a.format, v.format) as item_format,
      COALESCE(b.is_favorite, a.is_favorite, v.is_favorite) as item_is_favorite,
      COALESCE(b.s3_key, a.s3_key, v.s3_key) as item_s3_key,
      (SELECT COUNT(*) FROM media_folder_items mfi2 WHERE mfi2.item_id = mfi.item_id AND mfi2.item_type = mfi.item_type)::text as item_folder_count,
      (CASE 
        WHEN mfi.item_type = 'audio' THEN (SELECT COUNT(*) FROM audio_bookmarks ab WHERE ab.track_id = mfi.item_id)
        WHEN mfi.item_type = 'video' THEN (SELECT COUNT(*) FROM video_bookmarks vb WHERE vb.video_id = mfi.item_id)
        ELSE 0
      END)::text as item_bookmarks_count
    FROM media_folder_items mfi
    INNER JOIN media_folders mf ON mfi.folder_id = mf.id
    LEFT JOIN books b ON mfi.item_type = 'book' AND mfi.item_id = b.id
    LEFT JOIN audio_tracks a ON mfi.item_type = 'audio' AND mfi.item_id = a.id
    LEFT JOIN video_tracks v ON mfi.item_type = 'video' AND mfi.item_id = v.id
    WHERE ${whereClause}
    ORDER BY COALESCE(b.title, a.title, v.title)
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const result = await pool.query<DBMediaFolderItemRow>(dataQuery, [
    ...queryParams,
    limit,
    offset,
  ]);

  const totalPages = Math.ceil(totalItems / limit);
  return {
    data: result.rows.map(mapDBRowToMediaFolderItemWithDetails),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}
