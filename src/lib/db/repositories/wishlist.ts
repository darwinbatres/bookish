import { getPool } from "../pool";
import type { DBWishlistItem, WishlistPriority, PaginatedResponse } from "@/types";

// Internal DB row representation (snake_case from PostgreSQL)
interface DBWishlistRow {
  id: string;
  title: string;
  author: string | null;
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

export async function getWishlistItemsPaginated(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedResponse<DBWishlistItem>> {
  const pool = getPool();
  const { page = 1, limit = 20, search } = params;
  const offset = (page - 1) * limit;

  // Build where clause
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (search?.trim()) {
    whereClauses.push(`(title ILIKE $${paramIndex} OR author ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`);
    queryParams.push(`%${search.trim()}%`);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

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
  const dataResult = await pool.query<DBWishlistRow>(
    dataQuery,
    [...queryParams, limit, offset]
  );

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

export async function getWishlistItemById(id: string): Promise<DBWishlistItem | null> {
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
  notes?: string;
  priority?: WishlistPriority;
  url?: string;
}

export async function createWishlistItem(input: CreateWishlistItemInput): Promise<DBWishlistItem> {
  const pool = getPool();
  const result = await pool.query<DBWishlistRow>(
    `INSERT INTO wishlist (title, author, notes, priority, url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.title,
      input.author ?? null,
      input.notes ?? null,
      input.priority ?? 0,
      input.url ?? null,
    ]
  );
  return mapDBRowToWishlistItem(result.rows[0]);
}

export interface UpdateWishlistItemInput {
  title?: string;
  author?: string;
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
