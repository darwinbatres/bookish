/**
 * Audio Types for Bookish
 * Mirrors the database schema for audio/podcast support
 */

// Supported audio formats
export type AudioFormat =
  | "mp3"
  | "wav"
  | "ogg"
  | "m4a"
  | "flac"
  | "aac"
  | "webm";

// Audio format to MIME type mapping
export const AUDIO_FORMAT_MIME_TYPES: Record<AudioFormat, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  webm: "audio/webm",
};

// View mode options for audio library
export type AudioViewMode = "list" | "grid" | "compact" | "cards";

// MIME type to audio format mapping
export const MIME_TYPE_TO_AUDIO_FORMAT: Record<string, AudioFormat> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/aac": "aac",
  "audio/webm": "webm",
};

/**
 * Represents an audio track in the PostgreSQL database
 */
export interface DBAudioTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  format: AudioFormat;
  durationSeconds: number;
  currentPosition: number;
  s3Key: string;
  fileSize: number;
  originalFilename?: string;
  coverUrl?: string;
  totalListeningTime: number;
  completedAt?: string;
  isFavorite: boolean;
  bookmarksCount?: number;
  /** Number of folders this track is in */
  folderCount?: number;
  /** Number of playlists this track is in */
  playlistCount?: number;
  addedAt: string;
  lastPlayedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a playlist in the PostgreSQL database
 */
export interface DBPlaylist {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  sortOrder: number;
  trackCount?: number;
  totalDuration?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a playlist item (track in a playlist)
 */
export interface DBPlaylistItem {
  id: string;
  playlistId: string;
  trackId: string;
  sortOrder: number;
  addedAt: string;
  track?: DBAudioTrack;
}

/**
 * Represents a listening session for analytics
 */
export interface DBListeningSession {
  id: string;
  trackId: string;
  startedAt: string;
  endedAt?: string;
  startPosition: number;
  endPosition?: number;
  durationSeconds?: number;
}

/**
 * Represents a bookmark/timestamp within an audio track
 */
export interface DBAudioBookmark {
  id: string;
  trackId: string;
  positionSeconds: number;
  label?: string;
  createdAt: string;
}

// Input types for API requests

export interface CreateAudioTrackInput {
  title: string;
  artist?: string;
  album?: string;
  format: AudioFormat;
  durationSeconds: number;
  fileSize: number;
  s3Key: string;
  originalFilename?: string;
  coverUrl?: string;
}

export interface UpdateAudioTrackInput {
  title?: string;
  artist?: string;
  album?: string;
  currentPosition?: number;
  durationSeconds?: number;
  coverUrl?: string;
  completed?: boolean;
  isFavorite?: boolean;
}

export interface CreatePlaylistInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdatePlaylistInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface AddPlaylistItemInput {
  trackId: string;
  sortOrder?: number;
}

export interface ReorderPlaylistItemsInput {
  items: Array<{ id: string; sortOrder: number }>;
}

// Utility functions

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return (
      hours +
      ":" +
      minutes.toString().padStart(2, "0") +
      ":" +
      secs.toString().padStart(2, "0")
    );
  }
  return minutes + ":" + secs.toString().padStart(2, "0");
}

export function parseDuration(duration: string): number {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

export function calculateProgress(
  currentPosition: number,
  durationSeconds: number
): number {
  if (durationSeconds <= 0) return 0;
  return Math.min(100, Math.round((currentPosition / durationSeconds) * 100));
}
