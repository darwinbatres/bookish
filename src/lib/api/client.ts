import type {
  DBBook,
  DBBookmark,
  DBNote,
  BookFormat,
  PaginatedResponse,
} from "@/types";

const API_BASE = "/api";

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(response.status, error.message || "Request failed");
  }
  return response.json();
}

// Books API
export async function fetchBooks(search?: string): Promise<DBBook[]> {
  const url = search
    ? `${API_BASE}/books?search=${encodeURIComponent(search)}`
    : `${API_BASE}/books`;
  const response = await fetch(url);
  return handleResponse<DBBook[]>(response);
}

export interface FetchBooksPaginatedParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "title" | "updatedAt" | "createdAt" | "author";
  sortOrder?: "asc" | "desc";
  collectionId?: string;
  favoritesOnly?: boolean;
}

export async function fetchBooksPaginated(
  params: FetchBooksPaginatedParams = {}
): Promise<PaginatedResponse<DBBook>> {
  const searchParams = new URLSearchParams({
    paginated: "true",
    page: String(params.page || 1),
    limit: String(params.limit || 20),
    sortBy: params.sortBy || "updatedAt",
    sortOrder: params.sortOrder || "desc",
  });

  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  if (params.collectionId) {
    searchParams.set("collectionId", params.collectionId);
  }

  if (params.favoritesOnly) {
    searchParams.set("favoritesOnly", "true");
  }

  const response = await fetch(`${API_BASE}/books?${searchParams}`);
  return handleResponse<PaginatedResponse<DBBook>>(response);
}

export async function fetchBook(id: string): Promise<DBBook> {
  const response = await fetch(`${API_BASE}/books/${id}`);
  return handleResponse<DBBook>(response);
}

export interface CreateBookInput {
  title: string;
  author?: string;
  format: BookFormat;
  fileSize: number;
  totalPages?: number;
  s3Key: string;
  coverUrl?: string;
}

export async function createBook(input: CreateBookInput): Promise<DBBook> {
  const response = await fetch(`${API_BASE}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<DBBook>(response);
}

export interface UpdateBookInput {
  title?: string;
  author?: string;
  currentPage?: number;
  totalPages?: number;
  coverUrl?: string;
  isFavorite?: boolean;
}

export async function updateBook(
  id: string,
  input: UpdateBookInput
): Promise<DBBook> {
  const response = await fetch(`${API_BASE}/books/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<DBBook>(response);
}

export async function deleteBook(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/books/${id}`, { method: "DELETE" });
  await handleResponse<{ success: boolean }>(response);
}

// Bookmarks API
export async function fetchBookmarks(bookId: string): Promise<DBBookmark[]> {
  const response = await fetch(`${API_BASE}/books/${bookId}/bookmarks`);
  return handleResponse<DBBookmark[]>(response);
}

export async function addBookmark(
  bookId: string,
  page: number,
  label?: string
): Promise<DBBookmark> {
  const response = await fetch(`${API_BASE}/books/${bookId}/bookmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page, label }),
  });
  return handleResponse<DBBookmark>(response);
}

export async function removeBookmark(
  bookId: string,
  page: number
): Promise<void> {
  const response = await fetch(`${API_BASE}/books/${bookId}/bookmarks`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page }),
  });
  await handleResponse<{ success: boolean }>(response);
}

// Notes API
export async function fetchNotes(
  bookId: string,
  page?: number
): Promise<DBNote[]> {
  const url = page
    ? `${API_BASE}/books/${bookId}/notes?page=${page}`
    : `${API_BASE}/books/${bookId}/notes`;
  const response = await fetch(url);
  return handleResponse<DBNote[]>(response);
}

export async function createNote(
  bookId: string,
  page: number,
  content: string
): Promise<DBNote> {
  const response = await fetch(`${API_BASE}/books/${bookId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page, content }),
  });
  return handleResponse<DBNote>(response);
}

export async function updateNote(
  bookId: string,
  noteId: string,
  content: string
): Promise<DBNote> {
  const response = await fetch(`${API_BASE}/books/${bookId}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: noteId, content }),
  });
  return handleResponse<DBNote>(response);
}

export async function deleteNote(
  bookId: string,
  noteId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/books/${bookId}/notes`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: noteId }),
  });
  await handleResponse<{ success: boolean }>(response);
}

// S3 URLs
export interface UploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: number;
}

export async function getUploadUrl(
  bookId: string,
  filename: string,
  contentType: string,
  fileSize: number
): Promise<UploadUrlResponse> {
  const response = await fetch(`${API_BASE}/books/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId, filename, contentType, fileSize }),
  });
  return handleResponse<UploadUrlResponse>(response);
}

// Cover upload API
export async function getCoverUploadUrl(
  bookId: string,
  filename: string,
  contentType: string,
  fileSize: number
): Promise<UploadUrlResponse> {
  const response = await fetch(`${API_BASE}/books/cover-upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId, filename, contentType, fileSize }),
  });
  return handleResponse<UploadUrlResponse>(response);
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresAt: number;
}

export async function getDownloadUrl(
  s3Key: string
): Promise<DownloadUrlResponse> {
  const response = await fetch(`${API_BASE}/books/download-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ s3Key }),
  });
  return handleResponse<DownloadUrlResponse>(response);
}

// Stats API
export interface StorageStats {
  totalBooks: number;
  totalFavorites: number;
  totalWishlist: number;
  totalBookmarks: number;
  totalNotes: number;
  totalCollections: number;
  totalReadingSessions: number;
  totalReadingTime: number; // seconds
  completedBooks: number;
  booksWithCovers: number;
  totalStorageBytes: number;
  databaseSizeBytes: number; // PostgreSQL database size
  // Reading progress stats
  totalPages: number; // Total pages across all books
  pagesRead: number; // Sum of current_page across all books
  booksByFormat: { format: string; count: number; bytes: number }[];
  recentActivity: {
    booksAddedLast7Days: number;
    booksAddedLast30Days: number;
    notesAddedLast7Days: number;
    notesAddedLast30Days: number;
    bookmarksAddedLast7Days: number;
    bookmarksAddedLast30Days: number;
    wishlistAddedLast7Days: number;
    wishlistAddedLast30Days: number;
    collectionsAddedLast7Days: number;
    collectionsAddedLast30Days: number;
  };
}

export async function fetchStats(): Promise<StorageStats> {
  const response = await fetch(`${API_BASE}/stats`);
  return handleResponse<StorageStats>(response);
}

// Auth API
export interface AuthUser {
  username: string;
}

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; message?: string }> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
}

export async function checkAuth(): Promise<{
  authenticated: boolean;
  user?: AuthUser;
}> {
  const response = await fetch(`${API_BASE}/auth/me`);
  const data = await response.json();
  return {
    authenticated: data.authenticated,
    user: data.username ? { username: data.username } : undefined,
  };
}

// Collections API
import type { DBCollection, DBReadingSession } from "@/types";

export async function fetchCollections(): Promise<DBCollection[]> {
  const response = await fetch(`${API_BASE}/collections`);
  return handleResponse<DBCollection[]>(response);
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export async function createCollection(
  input: CreateCollectionInput
): Promise<DBCollection> {
  const response = await fetch(`${API_BASE}/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<DBCollection>(response);
}

export async function updateCollection(
  id: string,
  input: Partial<CreateCollectionInput>
): Promise<DBCollection> {
  const response = await fetch(`${API_BASE}/collections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<DBCollection>(response);
}

export async function deleteCollection(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/collections/${id}`, {
    method: "DELETE",
  });
  await handleResponse<{ success: boolean }>(response);
}

export async function addBookToCollection(
  bookId: string,
  collectionId: string | null
): Promise<DBBook> {
  const response = await fetch(`${API_BASE}/books/${bookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectionId }),
  });
  return handleResponse<DBBook>(response);
}

// Reading Sessions API
export async function startReadingSession(
  bookId: string,
  startPage: number
): Promise<DBReadingSession> {
  const response = await fetch(`${API_BASE}/books/${bookId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startPage }),
  });
  return handleResponse<DBReadingSession>(response);
}

export async function endReadingSession(
  bookId: string,
  sessionId: string,
  endPage: number
): Promise<DBReadingSession> {
  const response = await fetch(`${API_BASE}/books/${bookId}/sessions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, endPage }),
  });
  return handleResponse<DBReadingSession>(response);
}

export async function getActiveSession(
  bookId: string
): Promise<DBReadingSession | null> {
  const response = await fetch(`${API_BASE}/books/${bookId}/sessions`);
  const result = await handleResponse<{
    session: DBReadingSession | null;
  }>(response);
  return result.session;
}

// Settings API
export interface PublicSettings {
  app: {
    environment: string;
    version: string;
  };
  upload: {
    maxSizeMB: number;
    allowedTypes: string[];
    presignedUrlExpiry: number;
  };
  storage: {
    type: "s3" | "local";
    isConfigured: boolean;
    region?: string;
  };
  database: {
    isConfigured: boolean;
  };
}

export async function fetchSettings(): Promise<PublicSettings> {
  const response = await fetch(`${API_BASE}/settings`);
  return handleResponse<PublicSettings>(response);
}

// Book completion API
export async function markBookCompleted(bookId: string): Promise<DBBook> {
  const response = await fetch(`${API_BASE}/books/${bookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true }),
  });
  return handleResponse<DBBook>(response);
}

// Toggle book favorite
export async function toggleBookFavorite(
  bookId: string,
  isFavorite: boolean
): Promise<DBBook> {
  const response = await fetch(`${API_BASE}/books/${bookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isFavorite }),
  });
  return handleResponse<DBBook>(response);
}

// Wishlist API
import type {
  DBWishlistItem,
  WishlistPriority,
  PaginatedResponse as PaginatedResponseType,
} from "@/types";

export async function fetchWishlist(): Promise<DBWishlistItem[]> {
  const response = await fetch(`${API_BASE}/wishlist`);
  return handleResponse<DBWishlistItem[]>(response);
}

export interface FetchWishlistPaginatedParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function fetchWishlistPaginated(
  params: FetchWishlistPaginatedParams = {}
): Promise<PaginatedResponseType<DBWishlistItem>> {
  const searchParams = new URLSearchParams({
    paginated: "true",
    page: String(params.page || 1),
    limit: String(params.limit || 20),
  });

  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  const response = await fetch(`${API_BASE}/wishlist?${searchParams}`);
  return handleResponse<PaginatedResponseType<DBWishlistItem>>(response);
}

export interface CreateWishlistItemInput {
  title: string;
  author?: string;
  notes?: string;
  priority?: WishlistPriority;
  url?: string;
}

export async function createWishlistItem(
  input: CreateWishlistItemInput
): Promise<DBWishlistItem> {
  const response = await fetch(`${API_BASE}/wishlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<DBWishlistItem>(response);
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
): Promise<DBWishlistItem> {
  const response = await fetch(`${API_BASE}/wishlist/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<DBWishlistItem>(response);
}

export async function deleteWishlistItem(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/wishlist/${id}`, {
    method: "DELETE",
  });
  await handleResponse<{ success: boolean }>(response);
}
