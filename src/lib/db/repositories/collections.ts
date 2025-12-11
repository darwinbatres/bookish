import { getPool } from "../pool";
import type { DBCollection } from "@/types";

interface DBCollectionRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  book_count?: string;
  created_at: Date;
  updated_at: Date;
}

function mapDBRowToCollection(row: DBCollectionRow): DBCollection {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    bookCount: row.book_count ? parseInt(row.book_count, 10) : undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getAllCollections(): Promise<DBCollection[]> {
  const pool = getPool();
  const result = await pool.query<DBCollectionRow>(
    `SELECT 
      c.*,
      (SELECT COUNT(*) FROM books b WHERE b.collection_id = c.id) as book_count
    FROM collections c
    ORDER BY c.sort_order ASC, c.name ASC`
  );
  return result.rows.map(mapDBRowToCollection);
}

export async function getCollectionById(id: string): Promise<DBCollection | null> {
  const pool = getPool();
  const result = await pool.query<DBCollectionRow>(
    `SELECT 
      c.*,
      (SELECT COUNT(*) FROM books b WHERE b.collection_id = c.id) as book_count
    FROM collections c
    WHERE c.id = $1`,
    [id]
  );
  return result.rows[0] ? mapDBRowToCollection(result.rows[0]) : null;
}

interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export async function createCollection(
  input: CreateCollectionInput
): Promise<DBCollection> {
  const pool = getPool();
  
  // Get next sort order
  const sortResult = await pool.query<{ max: number | null }>(
    "SELECT MAX(sort_order) as max FROM collections"
  );
  const nextSortOrder = (sortResult.rows[0]?.max ?? -1) + 1;

  const result = await pool.query<DBCollectionRow>(
    `INSERT INTO collections (name, description, color, icon, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.name,
      input.description || null,
      input.color || "#6366f1",
      input.icon || "folder",
      nextSortOrder,
    ]
  );
  return mapDBRowToCollection(result.rows[0]);
}

interface UpdateCollectionInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export async function updateCollection(
  id: string,
  input: UpdateCollectionInput
): Promise<DBCollection | null> {
  const pool = getPool();
  
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description || null);
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

  if (updates.length === 0) {
    return getCollectionById(id);
  }

  values.push(id);
  const result = await pool.query<DBCollectionRow>(
    `UPDATE collections SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  return result.rows[0] ? mapDBRowToCollection(result.rows[0]) : null;
}

export async function deleteCollection(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "DELETE FROM collections WHERE id = $1",
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addBookToCollection(
  bookId: string,
  collectionId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE books SET collection_id = $1 WHERE id = $2",
    [collectionId, bookId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function removeBookFromCollection(bookId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE books SET collection_id = NULL WHERE id = $1",
    [bookId]
  );
  return (result.rowCount ?? 0) > 0;
}
