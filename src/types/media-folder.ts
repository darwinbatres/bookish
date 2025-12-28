/**
 * Media Folder Types for Bookish
 * Allows grouping books, audio, and videos into organized folders with notes
 * Created: December 2024
 */

// Media item types that can be added to folders
export type MediaItemType = "book" | "audio" | "video";

/**
 * Represents a media folder in the PostgreSQL database
 */
export interface DBMediaFolder {
  /** UUID primary key */
  id: string;
  /** Folder name/title */
  name: string;
  /** Optional description/notes for the folder */
  description?: string;
  /** Color for UI display (hex) */
  color: string;
  /** Icon identifier */
  icon: string;
  /** Sort order for display */
  sortOrder: number;
  /** Cover image URL (S3 key or external URL) */
  coverUrl?: string;
  /** Number of items in this folder */
  itemCount?: number;
  /** Breakdown by type */
  bookCount?: number;
  audioCount?: number;
  videoCount?: number;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Represents an item within a media folder
 */
export interface DBMediaFolderItem {
  /** UUID primary key */
  id: string;
  /** Folder ID this item belongs to */
  folderId: string;
  /** Type of media item */
  itemType: MediaItemType;
  /** ID of the book, audio track, or video */
  itemId: string;
  /** Sort order within the folder */
  sortOrder: number;
  /** Optional notes specific to this item in this folder */
  notes?: string;
  /** ISO timestamp when added */
  addedAt: string;
}

/**
 * Media folder item with resolved item details
 * Used when fetching folder contents with item data
 */
export interface DBMediaFolderItemWithDetails extends DBMediaFolderItem {
  /** Item title (from book/audio/video) */
  itemTitle?: string;
  /** Item author/artist (if applicable) */
  itemAuthor?: string;
  /** Item cover URL */
  itemCoverUrl?: string;
  /** Item duration (for audio/video) */
  itemDuration?: number;
  /** Item progress (page for books, position for audio/video) */
  itemProgress?: number;
  /** Item total (pages for books, duration for audio/video) */
  itemTotal?: number;
  /** Item format */
  itemFormat?: string;
  /** Whether the item is favorited */
  itemIsFavorite?: boolean;
  /** How many folders this item is in */
  itemFolderCount?: number;
  /** S3 key for downloading the file */
  itemS3Key?: string;
  /** Number of bookmarks (for audio/video) */
  itemBookmarksCount?: number;
  /** Folder name (when searching across all folders) */
  folderName?: string;
}

/**
 * Input for creating a media folder
 */
export interface CreateMediaFolderInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  coverUrl?: string;
}

/**
 * Input for updating a media folder
 */
export interface UpdateMediaFolderInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
  coverUrl?: string;
}

/**
 * Input for adding an item to a folder
 */
export interface AddMediaFolderItemInput {
  itemType: MediaItemType;
  itemId: string;
  notes?: string;
  sortOrder?: number;
}

/**
 * Input for updating an item in a folder
 */
export interface UpdateMediaFolderItemInput {
  notes?: string;
  sortOrder?: number;
}

/**
 * Available folder icon options
 */
export const FOLDER_ICONS = [
  "folder",
  "folder-open",
  "bookmark",
  "star",
  "heart",
  "film",
  "music",
  "book",
  "graduation-cap",
  "briefcase",
  "archive",
  "box",
  "tag",
  "flag",
  "trophy",
] as const;

export type FolderIcon = (typeof FOLDER_ICONS)[number];

/**
 * Available folder color options
 */
export const FOLDER_COLORS = [
  "#6366f1", // Indigo (default)
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6b7280", // Gray
] as const;
