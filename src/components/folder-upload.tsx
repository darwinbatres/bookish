/**
 * FolderUpload Component
 * Unified upload for folders - detects file type and adds to folder automatically
 * Created: December 2024
 */

import type React from "react";
import {
  Plus,
  AlertCircle,
  Upload,
  BookOpen,
  Music,
  Video,
  Image as ImageIcon,
} from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import type {
  BookFormat,
  AudioFormat,
  VideoFormat,
  MediaItemType,
} from "@/types";
import {
  uploadBook,
  createBook,
  uploadAudio,
  createAudioTrack,
  uploadVideoFile,
  createVideo,
  uploadImageFile,
  createImage,
  addItemToMediaFolder,
  fetchSettings,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

// Accepted formats by category
const BOOK_EXTENSIONS = ["pdf", "epub", "mobi"];
const AUDIO_EXTENSIONS = [
  "mp3",
  "m4a",
  "m4b",
  "aac",
  "ogg",
  "flac",
  "wav",
  "wma",
  "webm",
];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mkv", "mov", "avi", "m4v"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"];

// Combined accept string for file input
const ACCEPTED_FORMATS = [
  ".pdf",
  ".epub",
  ".mobi",
  ".mp3",
  ".m4a",
  ".m4b",
  ".aac",
  ".ogg",
  ".flac",
  ".wav",
  ".wma",
  ".mp4",
  ".mkv",
  ".mov",
  ".avi",
  ".m4v",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
].join(",");

// Default max file sizes per category
const DEFAULT_MAX_BOOK_SIZE_MB = 100;
const DEFAULT_MAX_AUDIO_SIZE_MB = 500;
const DEFAULT_MAX_VIDEO_SIZE_MB = 1024;
const DEFAULT_MAX_IMAGE_SIZE_MB = 50;

// Utility functions
function generateId(): string {
  return crypto.randomUUID();
}

function extractTitleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function detectMediaType(filename: string): MediaItemType | null {
  const ext = getFileExtension(filename);
  if (BOOK_EXTENSIONS.includes(ext)) return "book";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  return null;
}

function getBookFormat(filename: string): BookFormat {
  const ext = getFileExtension(filename);
  if (ext === "epub") return "epub";
  if (ext === "mobi") return "mobi";
  return "pdf";
}

function getAudioFormat(filename: string): AudioFormat {
  const ext = getFileExtension(filename);
  switch (ext) {
    case "m4a":
    case "m4b":
      return "m4a";
    case "aac":
      return "aac";
    case "ogg":
      return "ogg";
    case "flac":
      return "flac";
    case "wav":
      return "wav";
    case "webm":
      return "webm";
    default:
      return "mp3";
  }
}

function getVideoFormat(filename: string): VideoFormat {
  const ext = getFileExtension(filename);
  switch (ext) {
    case "webm":
      return "webm";
    case "mkv":
      return "mkv";
    case "mov":
      return "mov";
    case "avi":
      return "avi";
    case "m4v":
      return "m4v";
    default:
      return "mp4";
  }
}

/**
 * Extract audio duration from a file using the Audio API
 */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(objectUrl);
      }
    };

    const resolveDuration = () => {
      if (resolved) return;
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        cleanup();
        resolve(Math.floor(audio.duration));
      }
    };

    audio.addEventListener("loadedmetadata", resolveDuration);
    audio.addEventListener("durationchange", resolveDuration);
    audio.addEventListener("canplaythrough", resolveDuration);

    audio.addEventListener("error", () => {
      cleanup();
      resolve(0);
    });

    setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(0);
      }
    }, 15000);

    audio.preload = "metadata";
    audio.src = objectUrl;
  });
}

/**
 * Extract video duration from a file using the Video API
 */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(objectUrl);
      }
    };

    const resolveDuration = () => {
      if (resolved) return;
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        cleanup();
        resolve(Math.floor(video.duration));
      }
    };

    video.addEventListener("loadedmetadata", resolveDuration);
    video.addEventListener("durationchange", resolveDuration);
    video.addEventListener("canplaythrough", resolveDuration);

    video.addEventListener("error", () => {
      cleanup();
      resolve(0);
    });

    setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(0);
      }
    }, 30000);

    video.preload = "metadata";
    video.src = objectUrl;
  });
}

interface FolderUploadProps {
  /** The folder ID to add uploaded items to */
  folderId: string;
  /** Called when any item is added to the folder */
  onItemAdded: () => void;
  /** Optional: compact mode for inline use */
  compact?: boolean;
}

interface UploadState {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "adding" | "complete" | "error";
  mediaType: MediaItemType | null;
}

export function FolderUpload({
  folderId,
  onItemAdded,
  compact = false,
}: FolderUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [maxBookSizeMB, setMaxBookSizeMB] = useState(DEFAULT_MAX_BOOK_SIZE_MB);
  const [maxAudioSizeMB] = useState(DEFAULT_MAX_AUDIO_SIZE_MB);
  const [maxVideoSizeMB] = useState(DEFAULT_MAX_VIDEO_SIZE_MB);
  const [maxImageSizeMB] = useState(DEFAULT_MAX_IMAGE_SIZE_MB);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings()
      .then((settings) => {
        if (settings?.upload?.maxSizeMB) {
          setMaxBookSizeMB(settings.upload.maxSizeMB);
        }
      })
      .catch(() => {
        // Use defaults on error
      });
  }, []);

  const updateUpload = useCallback(
    (index: number, update: Partial<UploadState>) => {
      setUploads((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...update };
        return next;
      });
    },
    []
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      setError(null);
      setIsUploading(true);

      const fileList = Array.from(files);

      // Initialize upload states
      setUploads(
        fileList.map((file) => ({
          fileName: extractTitleFromFilename(file.name),
          progress: 0,
          status: "uploading" as const,
          mediaType: detectMediaType(file.name),
        }))
      );

      let successCount = 0;
      const addedTypes: Set<MediaItemType> = new Set();

      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const mediaType = detectMediaType(file.name);

          if (!mediaType) {
            updateUpload(i, { status: "error", progress: 0 });
            toast("Unsupported file type", {
              description: `"${file.name}" is not a supported format.`,
            });
            continue;
          }

          // Check file size based on type
          const maxSizeBytes =
            mediaType === "book"
              ? maxBookSizeMB * 1024 * 1024
              : mediaType === "audio"
                ? maxAudioSizeMB * 1024 * 1024
                : mediaType === "video"
                  ? maxVideoSizeMB * 1024 * 1024
                  : maxImageSizeMB * 1024 * 1024;

          const maxSizeMB =
            mediaType === "book"
              ? maxBookSizeMB
              : mediaType === "audio"
                ? maxAudioSizeMB
                : mediaType === "video"
                  ? maxVideoSizeMB
                  : maxImageSizeMB;

          if (file.size > maxSizeBytes) {
            updateUpload(i, { status: "error", progress: 0 });
            toast("File too large", {
              description: `"${file.name}" exceeds the ${maxSizeMB}MB limit for ${mediaType} files.`,
            });
            continue;
          }

          try {
            const title = extractTitleFromFilename(file.name);
            let itemId: string;

            updateUpload(i, { progress: 5 });

            // Upload based on media type
            if (mediaType === "book") {
              const bookId = generateId();
              const format = getBookFormat(file.name);

              const { s3Key } = await uploadBook(bookId, file, (percent) => {
                updateUpload(i, { progress: Math.round(5 + percent * 0.7) });
              });

              updateUpload(i, { progress: 80, status: "processing" });

              const book = await createBook({
                title,
                format,
                fileSize: file.size,
                s3Key,
              });
              itemId = book.id;
            } else if (mediaType === "audio") {
              const trackId = generateId();
              const format = getAudioFormat(file.name);

              // Get duration first
              const durationSeconds = await getAudioDuration(file);
              updateUpload(i, { progress: 10 });

              const { s3Key } = await uploadAudio(trackId, file, (percent) => {
                updateUpload(i, { progress: Math.round(10 + percent * 0.65) });
              });

              updateUpload(i, { progress: 80, status: "processing" });

              const track = await createAudioTrack({
                title,
                format,
                fileSize: file.size,
                durationSeconds,
                s3Key,
              });
              itemId = track.id;
            } else if (mediaType === "video") {
              const videoId = generateId();
              const format = getVideoFormat(file.name);

              // Get duration first
              const durationSeconds = await getVideoDuration(file);
              updateUpload(i, { progress: 10 });

              // uploadVideoFile returns s3Key directly as a string
              const s3Key = await uploadVideoFile(videoId, file, (percent) => {
                updateUpload(i, { progress: Math.round(10 + percent * 0.65) });
              });

              updateUpload(i, { progress: 80, status: "processing" });

              const video = await createVideo({
                title,
                format,
                fileSize: file.size,
                durationSeconds,
                s3Key,
                originalFilename: file.name,
              });
              itemId = video.id;
            } else {
              // image
              updateUpload(i, { progress: 10 });

              const uploadResult = await uploadImageFile(file, (percent) => {
                updateUpload(i, { progress: Math.round(10 + percent * 0.65) });
              });

              updateUpload(i, { progress: 80, status: "processing" });

              const image = await createImage({
                title,
                format: uploadResult.format,
                fileSize: uploadResult.fileSize,
                s3Key: uploadResult.s3Key,
                originalFilename: uploadResult.originalFilename,
              });
              itemId = image.id;
            }

            // Add to folder
            updateUpload(i, { progress: 90, status: "adding" });

            await addItemToMediaFolder(folderId, mediaType, itemId);

            updateUpload(i, { progress: 100, status: "complete" });
            successCount++;
            addedTypes.add(mediaType);
            onItemAdded();
          } catch (err) {
            console.error(`[Bookish] Upload error for ${file.name}:`, err);
            updateUpload(i, { status: "error" });
          }
        }

        if (successCount > 0) {
          const typeLabels = Array.from(addedTypes)
            .map((t) =>
              t === "book"
                ? "book"
                : t === "audio"
                  ? "audio track"
                  : t === "video"
                    ? "video"
                    : "image"
            )
            .join(", ");
          toast(
            successCount === 1
              ? "Item added to folder"
              : `${successCount} items added`,
            {
              description:
                successCount === 1
                  ? `Your ${typeLabels} has been uploaded and added to the folder.`
                  : `${successCount} items have been uploaded and added to the folder.`,
            }
          );
        }

        // Clear uploads after delay
        setTimeout(() => setUploads([]), 2500);
      } catch (err) {
        console.error("[Bookish] Folder upload error:", err);
        const message =
          err instanceof Error ? err.message : "Failed to upload files";
        setError(message);
        toast("Upload failed", { description: message });
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [
      folderId,
      onItemAdded,
      updateUpload,
      maxBookSizeMB,
      maxAudioSizeMB,
      maxVideoSizeMB,
      maxImageSizeMB,
    ]
  );

  const inputId = `folder-upload-${folderId}`;

  if (compact) {
    // Compact inline button for use in empty state or toolbar
    return (
      <div className="space-y-3">
        <input
          type="file"
          accept={ACCEPTED_FORMATS}
          multiple
          onChange={handleFileChange}
          className="hidden"
          id={inputId}
          disabled={isUploading}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            isUploading && "opacity-50 cursor-wait pointer-events-none"
          )}
        >
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {isUploading ? "Uploading..." : "Upload Files"}
          </span>
        </label>

        {/* Upload progress - matching other upload components */}
        {uploads.length > 0 && (
          <div className="space-y-2">
            {uploads.map((upload, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg shadow-lg",
                  "bg-popover text-popover-foreground border border-border",
                  upload.status === "error" && "border-destructive/50",
                  upload.status === "complete" && "border-green-500/50"
                )}
              >
                {upload.mediaType === "book" && (
                  <BookOpen
                    className={cn(
                      "w-4 h-4 shrink-0",
                      upload.status === "uploading" &&
                        "text-primary animate-pulse",
                      upload.status === "processing" && "text-amber-500",
                      upload.status === "adding" && "text-blue-500",
                      upload.status === "complete" && "text-green-500",
                      upload.status === "error" && "text-destructive"
                    )}
                  />
                )}
                {upload.mediaType === "audio" && (
                  <Music
                    className={cn(
                      "w-4 h-4 shrink-0",
                      upload.status === "uploading" &&
                        "text-primary animate-pulse",
                      upload.status === "processing" && "text-amber-500",
                      upload.status === "adding" && "text-blue-500",
                      upload.status === "complete" && "text-green-500",
                      upload.status === "error" && "text-destructive"
                    )}
                  />
                )}
                {upload.mediaType === "video" && (
                  <Video
                    className={cn(
                      "w-4 h-4 shrink-0",
                      upload.status === "uploading" &&
                        "text-rose-500 animate-pulse",
                      upload.status === "processing" && "text-amber-500",
                      upload.status === "adding" && "text-blue-500",
                      upload.status === "complete" && "text-green-500",
                      upload.status === "error" && "text-destructive"
                    )}
                  />
                )}
                {upload.mediaType === "image" && (
                  <ImageIcon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      upload.status === "uploading" &&
                        "text-emerald-500 animate-pulse",
                      upload.status === "processing" && "text-amber-500",
                      upload.status === "adding" && "text-blue-500",
                      upload.status === "complete" && "text-green-500",
                      upload.status === "error" && "text-destructive"
                    )}
                  />
                )}
                {!upload.mediaType && (
                  <Upload className="w-4 h-4 shrink-0 text-destructive" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {upload.fileName}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Progress
                      value={upload.progress}
                      className={cn(
                        "h-1.5 flex-1",
                        upload.status === "error" && "[&>div]:bg-destructive",
                        upload.status === "complete" && "[&>div]:bg-green-500"
                      )}
                    />
                    <span className="text-xs text-muted-foreground w-14 text-right">
                      {upload.status === "error"
                        ? "Failed"
                        : upload.status === "complete"
                          ? "Done"
                          : upload.status === "adding"
                            ? "Adding..."
                            : upload.status === "processing"
                              ? "Saving..."
                              : `${upload.progress}%`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // Full upload zone (for prominent display)
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed border-border rounded-xl p-4 sm:p-6 transition-colors bg-card/50",
          isUploading
            ? "opacity-50 pointer-events-none"
            : "hover:border-muted-foreground/40 active:border-muted-foreground/60"
        )}
      >
        <input
          type="file"
          accept={ACCEPTED_FORMATS}
          multiple
          onChange={handleFileChange}
          className="hidden"
          id={inputId}
          disabled={isUploading}
          aria-describedby={error ? "folder-upload-error" : undefined}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "cursor-pointer flex items-center gap-3 sm:gap-4",
            isUploading && "cursor-wait"
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
            {isUploading ? (
              <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-foreground">
              {isUploading ? "Uploading..." : "Add files to folder"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Books, Audio, Video, or Images
            </p>
          </div>
        </label>
      </div>

      {/* Upload progress indicators */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg shadow-lg",
                "bg-popover text-popover-foreground border border-border",
                upload.status === "error" && "border-destructive/50",
                upload.status === "complete" && "border-green-500/50"
              )}
            >
              {upload.mediaType === "book" && (
                <BookOpen
                  className={cn(
                    "w-4 h-4 shrink-0",
                    upload.status === "complete" && "text-green-500"
                  )}
                />
              )}
              {upload.mediaType === "audio" && (
                <Music
                  className={cn(
                    "w-4 h-4 shrink-0",
                    upload.status === "complete" && "text-green-500"
                  )}
                />
              )}
              {upload.mediaType === "video" && (
                <Video
                  className={cn(
                    "w-4 h-4 shrink-0",
                    upload.status === "complete" && "text-green-500"
                  )}
                />
              )}
              {upload.mediaType === "image" && (
                <ImageIcon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    upload.status === "complete" && "text-green-500"
                  )}
                />
              )}
              {!upload.mediaType && (
                <Upload className="w-4 h-4 shrink-0 text-destructive" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {upload.fileName}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Progress
                    value={upload.progress}
                    className={cn(
                      "h-1.5 flex-1",
                      upload.status === "error" && "[&>div]:bg-destructive",
                      upload.status === "complete" && "[&>div]:bg-green-500"
                    )}
                  />
                  <span className="text-xs text-muted-foreground w-14 text-right">
                    {upload.status === "error"
                      ? "Failed"
                      : upload.status === "complete"
                        ? "Done"
                        : upload.status === "adding"
                          ? "Adding..."
                          : upload.status === "processing"
                            ? "Saving..."
                            : `${upload.progress}%`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          id="folder-upload-error"
          role="alert"
          className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
