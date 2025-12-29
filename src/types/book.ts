/**
 * Supported e-book formats
 */
export type BookFormat = "pdf" | "epub" | "mobi";

/**
 * Priority levels for wishlist items
 */
export type WishlistPriority = 0 | 1 | 2; // 0 = low, 1 = medium, 2 = high

/**
 * Media types for wishlist items
 */
export type WishlistMediaType = "book" | "audio" | "video" | "image";

// ─────────────────────────────────────────────────────────────────────────────
// Database types (PostgreSQL schema)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents a collection (book group) in the database
 */
export interface DBCollection {
  /** UUID primary key */
  id: string;
  /** Name of the collection */
  name: string;
  /** Optional description */
  description?: string;
  /** Color for UI display (hex) */
  color: string;
  /** Icon identifier */
  icon: string;
  /** Sort order */
  sortOrder: number;
  /** Number of books in this collection */
  bookCount?: number;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Represents a book in the PostgreSQL database
 */
export interface DBBook {
  /** UUID primary key */
  id: string;
  /** Title of the book */
  title: string;
  /** Author of the book */
  author?: string;
  /** File format of the book */
  format: BookFormat;
  /** File size in bytes */
  fileSize: number;
  /** Total number of pages in the book */
  totalPages?: number;
  /** Current reading position (page number) */
  currentPage: number;
  /** S3 key for the book file */
  s3Key: string;
  /** Cover image URL */
  coverUrl?: string;
  /** Total reading time in seconds */
  totalReadingTime: number;
  /** ISO timestamp when book was completed (100%) */
  completedAt?: string;
  /** Whether this book is marked as favorite */
  isFavorite: boolean;
  /** Collection ID this book belongs to */
  collectionId?: string;
  /** Collection name (joined) */
  collectionName?: string;
  /** Number of notes for this book */
  notesCount?: number;
  /** Number of bookmarks for this book */
  bookmarksCount?: number;
  /** Number of folders this book is in */
  folderCount?: number;
  /** ISO timestamp when the book was added */
  createdAt: string;
  /** ISO timestamp when the book was last updated */
  updatedAt: string;
}

/**
 * Represents a wishlist item (media you want but don't have)
 */
export interface DBWishlistItem {
  /** UUID primary key */
  id: string;
  /** Title of the media */
  title: string;
  /** Creator (author for books, artist for audio, creator for video) */
  author?: string;
  /** Type of media: book, audio, or video */
  mediaType: WishlistMediaType;
  /** Optional notes about this item */
  notes?: string;
  /** Priority: 0 = low, 1 = medium, 2 = high */
  priority: WishlistPriority;
  /** Optional URL to purchase/find the media */
  url?: string;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Represents a reading session
 */
export interface DBReadingSession {
  /** UUID primary key */
  id: string;
  /** Book ID */
  bookId: string;
  /** When session started */
  startedAt: string;
  /** When session ended (null if active) */
  endedAt?: string;
  /** Starting page */
  startPage: number;
  /** Ending page */
  endPage?: number;
  /** Duration in seconds */
  durationSeconds?: number;
}

/**
 * Represents a bookmark in the PostgreSQL database
 */
export interface DBBookmark {
  /** UUID primary key */
  id: string;
  /** Book ID this bookmark belongs to */
  bookId: string;
  /** Page number */
  page: number;
  /** Optional label for the bookmark */
  label?: string;
  /** ISO timestamp when the bookmark was created */
  createdAt: string;
}

/**
 * Represents a note in the PostgreSQL database
 */
export interface DBNote {
  /** UUID primary key */
  id: string;
  /** Book ID this note belongs to */
  bookId: string;
  /** Page number where the note is attached */
  page: number;
  /** Content of the note */
  content: string;
  /** ISO timestamp when the note was created */
  createdAt: string;
  /** ISO timestamp when the note was last updated */
  updatedAt: string;
}

/**
 * Response from upload presigned URL API
 */
export interface UploadPresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: number;
}

/**
 * Response from download presigned URL API
 */
export interface DownloadPresignedUrlResponse {
  downloadUrl: string;
  expiresAt: number;
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Pagination parameters for list APIs
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "title" | "updatedAt" | "createdAt" | "author";
  sortOrder?: "asc" | "desc";
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * View mode for library display
 */
export type LibraryViewMode = "list" | "grid" | "compact" | "cards";
