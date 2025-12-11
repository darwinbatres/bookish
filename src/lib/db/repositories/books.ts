import { getPool } from "../pool";
import type {
  DBBook,
  BookFormat,
  PaginationParams,
  PaginatedResponse,
} from "@/types";

// Internal DB row representation (snake_case from PostgreSQL)
interface DBBookRow {
  id: string;
  title: string;
  author: string | null;
  format: string;
  file_size: string | number; // BIGINT can come as string
  total_pages: number | null;
  current_page: number;
  s3_key: string;
  cover_url: string | null;
  total_reading_time: number;
  completed_at: Date | null;
  is_favorite: boolean;
  collection_id: string | null;
  collection_name?: string | null;
  notes_count?: string; // COUNT returns bigint as string
  bookmarks_count?: string;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

interface CreateBookInput {
  title: string;
  author?: string;
  format: BookFormat;
  fileSize: number;
  totalPages?: number;
  s3Key: string;
  coverUrl?: string;
  collectionId?: string;
}

interface UpdateBookInput {
  title?: string;
  author?: string;
  currentPage?: number;
  totalPages?: number;
  coverUrl?: string;
  collectionId?: string | null;
  completed?: boolean;
  isFavorite?: boolean;
}

// Mapper
function mapDBRowToBook(row: DBBookRow): DBBook {
  return {
    id: row.id,
    title: row.title,
    author: row.author ?? undefined,
    format: row.format as BookFormat,
    fileSize:
      typeof row.file_size === "string"
        ? parseInt(row.file_size, 10)
        : row.file_size,
    totalPages: row.total_pages ?? undefined,
    currentPage: row.current_page,
    s3Key: row.s3_key,
    coverUrl: row.cover_url ?? undefined,
    totalReadingTime: row.total_reading_time ?? 0,
    completedAt: row.completed_at?.toISOString(),
    isFavorite: row.is_favorite ?? false,
    collectionId: row.collection_id ?? undefined,
    collectionName: row.collection_name ?? undefined,
    notesCount: row.notes_count ? parseInt(row.notes_count, 10) : undefined,
    bookmarksCount: row.bookmarks_count
      ? parseInt(row.bookmarks_count, 10)
      : undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Repository Functions

export async function getAllBooks(): Promise<DBBook[]> {
  const pool = getPool();
  const result = await pool.query<DBBookRow>(
    `SELECT 
      b.*,
      c.name as collection_name,
      COUNT(DISTINCT n.id)::text as notes_count,
      COUNT(DISTINCT bm.id)::text as bookmarks_count
    FROM books b
    LEFT JOIN collections c ON b.collection_id = c.id
    LEFT JOIN notes n ON n.book_id = b.id
    LEFT JOIN bookmarks bm ON bm.book_id = b.id
    GROUP BY b.id, c.name
    ORDER BY b.updated_at DESC`
  );
  return result.rows.map(mapDBRowToBook);
}

/**
 * Extended pagination params with collection filter
 */
interface ExtendedPaginationParams extends PaginationParams {
  collectionId?: string;
  favoritesOnly?: boolean;
}

/**
 * Get books with pagination and search support
 */
export async function getBooksWithPagination(
  params: ExtendedPaginationParams = {}
): Promise<PaginatedResponse<DBBook>> {
  const pool = getPool();
  const {
    page = 1,
    limit = 20,
    search,
    sortBy = "updatedAt",
    sortOrder = "desc",
    collectionId,
    favoritesOnly,
  } = params;

  const offset = (page - 1) * limit;

  // Map sort fields to database columns
  const sortFieldMap: Record<string, string> = {
    title: "b.title",
    updatedAt: "b.updated_at",
    createdAt: "b.created_at",
    author: "b.author",
  };
  const sortColumn = sortFieldMap[sortBy] || "b.updated_at";
  const order = sortOrder === "asc" ? "ASC" : "DESC";

  // Build the query with optional search and collection filter
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    whereClauses.push(
      `(b.title ILIKE $${paramIndex} OR b.author ILIKE $${paramIndex})`
    );
    queryParams.push(searchPattern);
    paramIndex++;
  }

  if (collectionId) {
    whereClauses.push(`b.collection_id = $${paramIndex}`);
    queryParams.push(collectionId);
    paramIndex++;
  }

  if (favoritesOnly) {
    whereClauses.push(`b.is_favorite = true`);
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM books b ${whereClause}`;
  const countResult = await pool.query<CountRow>(countQuery, queryParams);
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Get paginated results with efficient JOINs (no N+1 subqueries)
  const dataQuery = `
    SELECT 
      b.*,
      c.name as collection_name,
      COUNT(DISTINCT n.id)::text as notes_count,
      COUNT(DISTINCT bm.id)::text as bookmarks_count
    FROM books b
    LEFT JOIN collections c ON b.collection_id = c.id
    LEFT JOIN notes n ON n.book_id = b.id
    LEFT JOIN bookmarks bm ON bm.book_id = b.id
    ${whereClause}
    GROUP BY b.id, c.name
    ORDER BY ${sortColumn} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataParams = [...queryParams, limit, offset];
  const dataResult = await pool.query<DBBookRow>(dataQuery, dataParams);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: dataResult.rows.map(mapDBRowToBook),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/**
 * Search books across title, author, and notes content
 */
export async function searchBooksAdvanced(
  query: string,
  params: ExtendedPaginationParams = {}
): Promise<PaginatedResponse<DBBook>> {
  const pool = getPool();
  const {
    page = 1,
    limit = 20,
    sortBy = "updatedAt",
    sortOrder = "desc",
    collectionId,
    favoritesOnly,
  } = params;

  const offset = (page - 1) * limit;
  const searchPattern = `%${query.trim()}%`;

  // Map sort fields to database columns
  const sortFieldMap: Record<string, string> = {
    title: "b.title",
    updatedAt: "b.updated_at",
    createdAt: "b.created_at",
    author: "b.author",
  };
  const sortColumn = sortFieldMap[sortBy] || "b.updated_at";
  const order = sortOrder === "asc" ? "ASC" : "DESC";

  // Build where clauses
  const whereClauses: string[] = [
    `(b.title ILIKE $1 OR b.author ILIKE $1 OR b.id IN (SELECT DISTINCT book_id FROM notes WHERE content ILIKE $1))`,
  ];
  const queryParams: (string | number)[] = [searchPattern];
  let paramIndex = 2;

  if (collectionId) {
    whereClauses.push(`b.collection_id = $${paramIndex}`);
    queryParams.push(collectionId);
    paramIndex++;
  }

  if (favoritesOnly) {
    whereClauses.push(`b.is_favorite = true`);
  }

  const whereClause = `WHERE ${whereClauses.join(" AND ")}`;

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM books b ${whereClause}`;
  const countResult = await pool.query<CountRow>(countQuery, queryParams);
  const totalItems = parseInt(countResult.rows[0].count, 10);

  // Get paginated results with efficient JOINs (no N+1 subqueries)
  const dataQuery = `
    SELECT 
      b.*,
      c.name as collection_name,
      COUNT(DISTINCT n.id)::text as notes_count,
      COUNT(DISTINCT bm.id)::text as bookmarks_count
    FROM books b
    LEFT JOIN collections c ON b.collection_id = c.id
    LEFT JOIN notes n ON n.book_id = b.id
    LEFT JOIN bookmarks bm ON bm.book_id = b.id
    ${whereClause}
    GROUP BY b.id, c.name
    ORDER BY ${sortColumn} ${order}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataParams = [...queryParams, limit, offset];
  const dataResult = await pool.query<DBBookRow>(dataQuery, dataParams);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: dataResult.rows.map(mapDBRowToBook),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function getBookById(id: string): Promise<DBBook | null> {
  const pool = getPool();
  const result = await pool.query<DBBookRow>(
    `SELECT * FROM books WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToBook(result.rows[0]);
}

export async function getBookByS3Key(s3Key: string): Promise<DBBook | null> {
  const pool = getPool();
  const result = await pool.query<DBBookRow>(
    `SELECT * FROM books WHERE s3_key = $1`,
    [s3Key]
  );
  if (result.rows.length === 0) return null;
  return mapDBRowToBook(result.rows[0]);
}

export async function createBook(input: CreateBookInput): Promise<DBBook> {
  const pool = getPool();
  const result = await pool.query<DBBookRow>(
    `INSERT INTO books (title, author, format, file_size, total_pages, s3_key, cover_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.title,
      input.author ?? null,
      input.format,
      input.fileSize,
      input.totalPages ?? 0,
      input.s3Key,
      input.coverUrl ?? null,
    ]
  );
  return mapDBRowToBook(result.rows[0]);
}

export async function updateBook(
  id: string,
  input: UpdateBookInput
): Promise<DBBook | null> {
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
    values.push(input.author);
  }
  if (input.currentPage !== undefined) {
    updates.push(`current_page = $${paramIndex++}`);
    values.push(input.currentPage);
  }
  if (input.totalPages !== undefined) {
    updates.push(`total_pages = $${paramIndex++}`);
    values.push(input.totalPages);
  }
  if (input.coverUrl !== undefined) {
    updates.push(`cover_url = $${paramIndex++}`);
    values.push(input.coverUrl);
  }
  if (input.collectionId !== undefined) {
    updates.push(`collection_id = $${paramIndex++}`);
    values.push(input.collectionId);
  }
  if (input.completed === true) {
    updates.push(`completed_at = NOW()`);
  }
  if (input.isFavorite !== undefined) {
    updates.push(`is_favorite = $${paramIndex++}`);
    values.push(input.isFavorite);
  }

  if (updates.length === 0) return getBookById(id);

  values.push(id);

  const result = await pool.query<DBBookRow>(
    `UPDATE books SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return mapDBRowToBook(result.rows[0]);
}

export async function updateReadingProgress(
  id: string,
  currentPage: number
): Promise<DBBook | null> {
  return updateBook(id, { currentPage });
}

export async function deleteBook(id: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ s3_key: string }>(
    `DELETE FROM books WHERE id = $1 RETURNING s3_key`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].s3_key;
}

export async function searchBooks(query: string): Promise<DBBook[]> {
  const pool = getPool();
  const searchPattern = `%${query}%`;
  const result = await pool.query<DBBookRow>(
    `SELECT * FROM books 
     WHERE title ILIKE $1 OR author ILIKE $1
     ORDER BY updated_at DESC`,
    [searchPattern]
  );
  return result.rows.map(mapDBRowToBook);
}

export async function getBookCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM books`
  );
  return parseInt(result.rows[0].count, 10);
}
