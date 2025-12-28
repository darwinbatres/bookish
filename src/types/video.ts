/**
 * Video Types for Bookish
 * Mirrors the database schema for video support
 * Created: December 2024
 */

// Supported video formats (industry standard web-compatible formats)
export type VideoFormat = "mp4" | "webm" | "mkv" | "mov" | "avi" | "m4v";

// Video format to MIME type mapping
export const VIDEO_FORMAT_MIME_TYPES: Record<VideoFormat, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  m4v: "video/x-m4v",
};

// MIME type to video format mapping
export const MIME_TYPE_TO_VIDEO_FORMAT: Record<string, VideoFormat> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/x-m4v": "m4v",
};

// View mode options for video library
export type VideoViewMode = "list" | "grid" | "compact" | "cards";

/**
 * Represents a video track in the PostgreSQL database
 */
export interface DBVideoTrack {
  /** UUID primary key */
  id: string;
  /** Title of the video */
  title: string;
  /** Optional description */
  description?: string;
  /** Duration in seconds */
  durationSeconds: number;
  /** Current playback position in seconds */
  currentPosition: number;
  /** Video format */
  format: VideoFormat;
  /** S3 key for the video file */
  s3Key: string;
  /** File size in bytes */
  fileSize: number;
  /** Original filename */
  originalFilename?: string;
  /** Cover/thumbnail URL (S3 key or external URL) */
  coverUrl?: string;
  /** Total watching time in seconds */
  totalWatchingTime: number;
  /** ISO timestamp when completed */
  completedAt?: string;
  /** Whether marked as favorite */
  isFavorite: boolean;
  /** Number of bookmarks */
  bookmarksCount?: number;
  /** Number of folders this video is in */
  folderCount?: number;
  /** ISO timestamp when added */
  addedAt: string;
  /** ISO timestamp when last played */
  lastPlayedAt?: string;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Represents a video bookmark (timestamp marker)
 */
export interface DBVideoBookmark {
  /** UUID primary key */
  id: string;
  /** Video ID this bookmark belongs to */
  videoId: string;
  /** Position in seconds */
  positionSeconds: number;
  /** Optional label */
  label?: string;
  /** ISO timestamp when created */
  createdAt: string;
}

/**
 * Represents a video watching session (for analytics)
 */
export interface DBVideoSession {
  /** UUID primary key */
  id: string;
  /** Video ID */
  videoId: string;
  /** When session started */
  startedAt: string;
  /** When session ended (null if active) */
  endedAt?: string;
  /** Starting position in seconds */
  startPosition: number;
  /** Ending position in seconds */
  endPosition?: number;
  /** Duration in seconds */
  durationSeconds?: number;
}

/**
 * Input for creating a video track
 */
export interface CreateVideoInput {
  title: string;
  description?: string;
  format: VideoFormat;
  fileSize: number;
  durationSeconds?: number;
  s3Key: string;
  originalFilename?: string;
  coverUrl?: string;
}

/**
 * Input for updating a video track
 */
export interface UpdateVideoInput {
  title?: string;
  description?: string;
  currentPosition?: number;
  durationSeconds?: number;
  coverUrl?: string;
  isFavorite?: boolean;
  completed?: boolean;
}

/**
 * Format duration for display (reusing pattern from audio)
 */
export function formatVideoDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get file extension from filename
 */
export function getVideoFormatFromFilename(
  filename: string
): VideoFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ext in VIDEO_FORMAT_MIME_TYPES) {
    return ext as VideoFormat;
  }
  return null;
}
