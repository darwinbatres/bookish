/**
 * Images Repository
 * CRUD operations for images in PostgreSQL
 * Created: December 2024
 */

import { getPool } from "../pool";
import { removeItemFromAllFolders } from "./media-folders";
import type {
  DBImage,
  ImageFormat,
  CreateImageInput,
  UpdateImageInput,
  ImageMetadata,
  PaginationParams,
  PaginatedResponse,
} from "@/types";

// Internal DB row representation (snake_case from PostgreSQL)
interface DBImageRow {
  id: string;
  title: string;
  description: string | null;
  format: string;
  width: number | null;
  height: number | null;
  s3_key: string;
  file_size: string | number; // BIGINT can come as string
  original_filename: string | null;
  thumbnail_url: string | null;
  taken_at: Date | null;
  camera_model: string | null;
  album: string | null;
  tags: string[] | null;
  is_favorite: boolean;
  view_count: number;
  last_viewed_at: Date | null;
  folder_count?: string;
  added_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

// Mapper function
function mapDBRowToImage(row: DBImageRow): DBImage {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    format: row.format as ImageFormat,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    s3Key: row.s3_key,
    fileSize:
      typeof row.file_size === "string"
        ? parseInt(row.file_size, 10)
        : row.file_size,
    originalFilename: row.original_filename ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    takenAt: row.taken_at?.toISOString(),
    cameraModel: row.camera_model ?? undefined,
    album: row.album ?? undefined,
    tags: row.tags ?? undefined,
    isFavorite: row.is_favorite ?? false,
    viewCount: row.view_count ?? 0,
    lastViewedAt: row.last_viewed_at?.toISOString(),
    folderCount: row.folder_count ? parseInt(row.folder_count, 10) : undefined,
    addedAt: row.added_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Repository Functions

export async function getAllImages(): Promise<DBImage[]> {
  const pool = getPool();
  const result = await pool.query<DBImageRow>(
    `SELECT 
      i.*,
      (SELECT COUNT(*) FROM media_folder_items mfi WHERE mfi.item_id = i.id AND mfi.item_type = 'image')::text as folder_count
    FROM images i
    ORDER BY i.updated_at DESC`
  );
  return result.rows.map(mapDBRowToImage);
}

/**
 * Extended pagination params with filters
 */
interface ExtendedPaginationParams extends PaginationParams {
  folderId?: string;
  favoritesOnly?: boolean;
  album?: string;
  tag?: string;
}

/**
 * Get images with pagination and search support
 */
export async function getImagesWithPagination(
  params: ExtendedPaginationParams = {}
): Promise<PaginatedResponse<DBImage>> {
  const pool = getPool();
  const {
    page = 1,
    limit = 20,
    search,
    sortBy = "updatedAt",
    sortOrder = "desc",
    folderId,
    favoritesOnly,
    album,
    tag,
  } = params;

  const offset = (page - 1) * limit;

  // Map sort fields to database columns
  const sortFieldMap: Record<string, string> = {
    title: "i.title",
    updatedAt: "i.updated_at",
    createdAt: "i.created_at",
    addedAt: "i.added_at",
    takenAt: "i.taken_at",
    fileSize: "i.file_size",
  };
  const sortColumn = sortFieldMap[sortBy] || "i.updated_at";
  const order = sortOrder === "asc" ? "ASC" : "DESC";

  // Build the query with optional filters
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (search) {
    whereClauses.push(
      `(i.title ILIKE $${paramIndex} OR i.description ILIKE $${paramIndex} OR i.album ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (favoritesOnly) {
    whereClauses.push(`i.is_favorite = true`);
  }

  if (album) {
    whereClauses.push(`i.album = $${paramIndex}`);
    queryParams.push(album);
    paramIndex++;
  }

  if (tag) {
    whereClauses.push(`$${paramIndex} = ANY(i.tags)`);
    queryParams.push(tag);
    paramIndex++;
  }

  let joinClause = "";
  if (folderId) {
    joinClause = `INNER JOIN media_folder_items mfi ON mfi.item_id = i.id AND mfi.item_type = 'image' AND mfi.folder_id = $${paramIndex}`;
    queryParams.push(folderId);
    paramIndex++;
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countQuery = `
    SELECT COUNT(DISTINCT i.id) as count
    FROM images i
    ${joinClause}
    ${whereClause}
  `;
  const countResult = await pool.query<CountRow>(countQuery, queryParams);
  const totalCount = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalCount / limit);

  // Get paginated results
  const dataQuery = `
    SELECT 
      i.*,
      (SELECT COUNT(*) FROM media_folder_items mfi2 WHERE mfi2.item_id = i.id AND mfi2.item_type = 'image')::text as folder_count
    FROM images i
    ${joinClause}
    ${whereClause}
    GROUP BY i.id
    ORDER BY ${sortColumn} ${order} NULLS LAST
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const result = await pool.query<DBImageRow>(dataQuery, [
    ...queryParams,
    limit,
    offset,
  ]);

  return {
    data: result.rows.map(mapDBRowToImage),
    pagination: {
      page,
      limit,
      totalItems: totalCount,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/**
 * Get a single image by ID
 */
export async function getImageById(id: string): Promise<DBImage | null> {
  const pool = getPool();
  const result = await pool.query<DBImageRow>(
    `SELECT 
      i.*,
      (SELECT COUNT(*) FROM media_folder_items mfi WHERE mfi.item_id = i.id AND mfi.item_type = 'image')::text as folder_count
    FROM images i
    WHERE i.id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToImage(result.rows[0]);
}

/**
 * Create a new image
 */
export async function createImage(input: CreateImageInput): Promise<DBImage> {
  const pool = getPool();
  const result = await pool.query<DBImageRow>(
    `INSERT INTO images (
      title, description, format, width, height, s3_key, file_size, 
      original_filename, thumbnail_url, taken_at, camera_model, album, tags
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      input.title,
      input.description ?? null,
      input.format,
      input.width ?? null,
      input.height ?? null,
      input.s3Key,
      input.fileSize,
      input.originalFilename ?? null,
      input.thumbnailUrl ?? null,
      input.takenAt ?? null,
      input.cameraModel ?? null,
      input.album ?? null,
      input.tags ?? null,
    ]
  );
  return mapDBRowToImage(result.rows[0]);
}

/**
 * Update an image
 */
export async function updateImage(
  id: string,
  input: UpdateImageInput
): Promise<DBImage | null> {
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
  if (input.thumbnailUrl !== undefined) {
    updates.push(`thumbnail_url = $${paramIndex++}`);
    values.push(input.thumbnailUrl);
  }
  if (input.album !== undefined) {
    updates.push(`album = $${paramIndex++}`);
    values.push(input.album);
  }
  if (input.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`);
    values.push(input.tags);
  }
  if (input.isFavorite !== undefined) {
    updates.push(`is_favorite = $${paramIndex++}`);
    values.push(input.isFavorite);
  }

  if (updates.length === 0) return getImageById(id);

  values.push(id);

  const result = await pool.query<DBImageRow>(
    `UPDATE images SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapDBRowToImage(result.rows[0]);
}

/**
 * Delete an image by ID
 */
export async function deleteImage(id: string): Promise<boolean> {
  const pool = getPool();

  // First remove from all folders
  await removeItemFromAllFolders("image", id);

  const result = await pool.query(
    `DELETE FROM images WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Toggle favorite status
 */
export async function toggleImageFavorite(id: string): Promise<DBImage | null> {
  const pool = getPool();
  const result = await pool.query<DBImageRow>(
    `UPDATE images SET is_favorite = NOT is_favorite WHERE id = $1 RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToImage(result.rows[0]);
}

/**
 * Increment view count and update last viewed timestamp
 */
export async function recordImageView(id: string): Promise<DBImage | null> {
  const pool = getPool();
  const result = await pool.query<DBImageRow>(
    `UPDATE images 
     SET view_count = view_count + 1, last_viewed_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToImage(result.rows[0]);
}

/**
 * Get unique albums and tags for autocomplete
 */
export async function getImageMetadata(): Promise<ImageMetadata> {
  const pool = getPool();

  const [albumsResult, tagsResult] = await Promise.all([
    pool.query<{ album: string }>(
      `SELECT DISTINCT album FROM images WHERE album IS NOT NULL AND album != '' ORDER BY album`
    ),
    pool.query<{ tag: string }>(
      `SELECT DISTINCT unnest(tags) as tag FROM images WHERE tags IS NOT NULL ORDER BY tag`
    ),
  ]);

  return {
    albums: albumsResult.rows.map((r) => r.album),
    tags: tagsResult.rows.map((r) => r.tag),
  };
}
