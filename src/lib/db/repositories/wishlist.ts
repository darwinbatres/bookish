import { getPool } from "../pool";
import type {
  DBWishlistItem,
  WishlistPriority,
  WishlistMediaType,
  PaginatedResponse,
} from "@/types";

// Internal DB row representation (snake_case from PostgreSQL)
interface DBWishlistRow {
  id: string;
  title: string;
  author: string | null;
  media_type: string;
  notes: string | null;
  priority: number;
  url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

// Mapper
function mapDBRowToWishlistItem(row: DBWishlistRow): DBWishlistItem {
  return {
    id: row.id,
    title: row.title,
    author: row.author ?? undefined,
    mediaType: (row.media_type || "book") as WishlistMediaType,
    notes: row.notes ?? undefined,
    priority: row.priority as WishlistPriority,
    url: row.url ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Repository Functions

export async function getAllWishlistItems(): Promise<DBWishlistItem[]> {
  const pool = getPool();
  const result = await pool.query<DBWishlistRow>(
    `SELECT * FROM wishlist ORDER BY priority DESC, created_at DESC`
  );
  return result.rows.map(mapDBRowToWishlistItem);
}

export async function getWishlistItemsPaginated(
  params: {
    page?: number;
    limit?: number;
    search?: string;
    mediaType?: WishlistMediaType;
  } = {}
): Promise<PaginatedResponse<DBWishlistItem>> {
  const pool = getPool();
  const { page = 1, limit = 20, search, mediaType } = params;
  const offset = (page - 1) * limit;

  // Build where clause
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (search?.trim()) {
    whereClauses.push(
      `(title ILIKE $${paramIndex} OR author ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`
    );
    queryParams.push(`%${search.trim()}%`);
    paramIndex++;
  }

  if (mediaType) {
    whereClauses.push(`media_type = $${paramIndex}`);
    queryParams.push(mediaType);
    paramIndex++;
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM wishlist ${whereClause}`;
  const countResult = await pool.query<CountRow>(countQuery, queryParams);
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Get paginated data
  const dataQuery = `
    SELECT * FROM wishlist
    ${whereClause}
    ORDER BY priority DESC, created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await pool.query<DBWishlistRow>(dataQuery, [
    ...queryParams,
    limit,
    offset,
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: dataResult.rows.map(mapDBRowToWishlistItem),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function getWishlistItemById(
  id: string
): Promise<DBWishlistItem | null> {
  const pool = getPool();
  const result = await pool.query<DBWishlistRow>(
    `SELECT * FROM wishlist WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToWishlistItem(result.rows[0]);
}

export interface CreateWishlistItemInput {
  title: string;
  author?: string;
  mediaType?: WishlistMediaType;
  notes?: string;
  priority?: WishlistPriority;
  url?: string;
}

export async function createWishlistItem(
  input: CreateWishlistItemInput
): Promise<DBWishlistItem> {
  const pool = getPool();
  const result = await pool.query<DBWishlistRow>(
    `INSERT INTO wishlist (title, author, media_type, notes, priority, url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.title,
      input.author ?? null,
      input.mediaType ?? "book",
      input.notes ?? null,
      input.priority ?? 1,
      input.url ?? null,
    ]
  );
  return mapDBRowToWishlistItem(result.rows[0]);
}

export interface UpdateWishlistItemInput {
  title?: string;
  author?: string;
  mediaType?: WishlistMediaType;
  notes?: string;
  priority?: WishlistPriority;
  url?: string;
}

export async function updateWishlistItem(
  id: string,
  input: UpdateWishlistItemInput
): Promise<DBWishlistItem | null> {
  const pool = getPool();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }
  if (input.author !== undefined) {
    updates.push(`author = $${paramIndex++}`);
    values.push(input.author || null);
  }
  if (input.mediaType !== undefined) {
    updates.push(`media_type = $${paramIndex++}`);
    values.push(input.mediaType);
  }
  if (input.notes !== undefined) {
    updates.push(`notes = $${paramIndex++}`);
    values.push(input.notes || null);
  }
  if (input.priority !== undefined) {
    updates.push(`priority = $${paramIndex++}`);
    values.push(input.priority);
  }
  if (input.url !== undefined) {
    updates.push(`url = $${paramIndex++}`);
    values.push(input.url || null);
  }

  if (updates.length === 0) return getWishlistItemById(id);

  values.push(id);

  const result = await pool.query<DBWishlistRow>(
    `UPDATE wishlist SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapDBRowToWishlistItem(result.rows[0]);
}

export async function deleteWishlistItem(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM wishlist WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getWishlistCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM wishlist`
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Search for existing media matching a title (for duplicate detection)
 * Searches across: books, audio_tracks, video_tracks, AND wishlist
 */
export interface DuplicateMatch {
  id: string;
  title: string;
  type: "book" | "audio" | "video" | "wishlist";
  author?: string;
}

export async function searchForDuplicates(
  title: string
): Promise<DuplicateMatch[]> {
  const pool = getPool();
  const searchTerm = `%${title.trim().toLowerCase()}%`;

  // Search across all media types AND existing wishlist items
  const result = await pool.query<{
    id: string;
    title: string;
    type: string;
    author: string | null;
  }>(
    `
    -- Books in library
    SELECT id, title, 'book' as type, author
    FROM books WHERE LOWER(title) LIKE $1
    
    UNION ALL
    
    -- Audio tracks in library
    SELECT id, title, 'audio' as type, artist as author
    FROM audio_tracks WHERE LOWER(title) LIKE $1
    
    UNION ALL
    
    -- Video tracks in library
    SELECT id, title, 'video' as type, NULL as author
    FROM video_tracks WHERE LOWER(title) LIKE $1
    
    UNION ALL
    
    -- Existing wishlist items
    SELECT id, title, 'wishlist' as type, author
    FROM wishlist WHERE LOWER(title) LIKE $1
    
    ORDER BY title
    LIMIT 15
  `,
    [searchTerm]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type as DuplicateMatch["type"],
    author: row.author ?? undefined,
  }));
}
