/**
 * Image Types for Bookish
 * Mirrors the database schema for image support
 * Created: December 2024
 *
 * Browser Support Notes (as of December 2025):
 * - AVIF: Excellent compression, widely supported (Chrome 85+, Firefox 93+, Safari 16.1+, Edge 121+)
 * - WebP: Excellent fallback, universal modern browser support
 * - JPEG/PNG/GIF: Universal support including legacy browsers
 * - SVG: Vector graphics, universal support
 * - BMP: Supported but not recommended for web (large file sizes)
 * - HEIC: Safari only - will be converted or may not display in other browsers
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
 */

// Supported image formats (industry standard web-compatible formats)
// Priority: AVIF > WebP > JPEG/PNG for photos; SVG for vectors
export type ImageFormat =
  | "jpg"
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "svg"
  | "bmp"
  | "avif"
  | "heic";

// Image format to MIME type mapping
export const IMAGE_FORMAT_MIME_TYPES: Record<ImageFormat, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  heic: "image/heic",
};

// MIME type to image format mapping
export const MIME_TYPE_TO_IMAGE_FORMAT: Record<string, ImageFormat> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
  "image/heic": "heic",
};

// View mode options for image library
export type ImageViewMode = "list" | "grid" | "cards" | "compact";

/**
 * Represents an image in the PostgreSQL database
 */
export interface DBImage {
  /** UUID primary key */
  id: string;
  /** Title of the image */
  title: string;
  /** Optional description */
  description?: string;
  /** Image format */
  format: ImageFormat;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** S3 key for the image file */
  s3Key: string;
  /** File size in bytes */
  fileSize: number;
  /** Original filename */
  originalFilename?: string;
  /** Thumbnail URL (S3 key or external URL) */
  thumbnailUrl?: string;
  /** ISO timestamp when photo was taken (from EXIF) */
  takenAt?: string;
  /** Camera model (from EXIF) */
  cameraModel?: string;
  /** Album name for organization */
  album?: string;
  /** Array of tags for filtering */
  tags?: string[];
  /** Whether marked as favorite */
  isFavorite: boolean;
  /** Number of times viewed */
  viewCount: number;
  /** ISO timestamp when last viewed */
  lastViewedAt?: string;
  /** Number of folders this image is in */
  folderCount?: number;
  /** ISO timestamp when added */
  addedAt: string;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Input for creating a new image
 */
export interface CreateImageInput {
  title: string;
  description?: string;
  format: ImageFormat;
  width?: number;
  height?: number;
  s3Key: string;
  fileSize: number;
  originalFilename?: string;
  thumbnailUrl?: string;
  takenAt?: string;
  cameraModel?: string;
  album?: string;
  tags?: string[];
}

/**
 * Input for updating an image
 */
export interface UpdateImageInput {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  album?: string;
  tags?: string[];
  isFavorite?: boolean;
}

/**
 * Image metadata response (for albums/tags autocomplete)
 */
export interface ImageMetadata {
  albums: string[];
  tags: string[];
}
