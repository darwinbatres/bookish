import type React from "react";
import { Plus, Music, AlertCircle, Upload } from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import type { AudioFormat } from "@/types";
import { uploadAudio, createAudioTrack, fetchSettings } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

// Default max file size for audio (will be overridden by settings)
const DEFAULT_MAX_FILE_SIZE_MB = 500;
const ACCEPTED_FORMATS = ".mp3,.m4a,.m4b,.aac,.ogg,.flac,.wav,.wma" as const;

// Utility functions
function generateId(): string {
  return crypto.randomUUID();
}

function extractTitleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
}

function getFormatFromFilename(filename: string): AudioFormat {
  const ext = filename.split(".").pop()?.toLowerCase();
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

/**
 * Extract audio duration from a file using the Audio API
 * Uses multiple event listeners for better compatibility with different formats
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

    // Try multiple events - some formats trigger different events
    audio.addEventListener("loadedmetadata", resolveDuration);
    audio.addEventListener("durationchange", resolveDuration);
    audio.addEventListener("canplaythrough", resolveDuration);

    audio.addEventListener("error", () => {
      cleanup();
      resolve(0); // Return 0 if we can't get duration
    });

    // Timeout after 15 seconds (some large files need more time)
    setTimeout(() => {
      if (!resolved) {
        // Try to get whatever duration we have
        if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
          cleanup();
          resolve(Math.floor(audio.duration));
        } else {
          cleanup();
          resolve(0);
        }
      }
    }, 15000);

    // Set preload to metadata for faster loading
    audio.preload = "metadata";
    audio.src = objectUrl;
    audio.load(); // Explicitly trigger load
  });
}

interface AudioUploadProps {
  onTrackAdded: () => void;
}

interface UploadState {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
}

export function AudioUpload({ onTrackAdded }: AudioUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(DEFAULT_MAX_FILE_SIZE_MB);

  // Fetch settings on mount to get actual max file size
  useEffect(() => {
    fetchSettings()
      .then((settings) => {
        if (settings?.audio?.maxSizeMB) {
          setMaxFileSizeMB(settings.audio.maxSizeMB);
        }
      })
      .catch(() => {
        // Use default on error
      });
  }, []);

  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

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
        }))
      );

      let successCount = 0;

      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];

          if (file.size > maxFileSizeBytes) {
            updateUpload(i, { status: "error", progress: 0 });
            toast("File too large", {
              description: `"${file.name}" exceeds the ${maxFileSizeMB}MB limit.`,
            });
            continue;
          }

          try {
            const format = getFormatFromFilename(file.name);
            const trackId = generateId();
            const title = extractTitleFromFilename(file.name);

            updateUpload(i, { progress: 5 });

            // Extract duration from the audio file
            const durationSeconds = await getAudioDuration(file);

            updateUpload(i, { progress: 10 });

            // Upload file through our API (proxied upload)
            const { s3Key } = await uploadAudio(trackId, file, (percent) => {
              // Map 0-100% of upload to 10-80% of our progress
              const mappedProgress = 10 + percent * 0.7;
              updateUpload(i, { progress: Math.round(mappedProgress) });
            });

            updateUpload(i, { progress: 85, status: "processing" });

            // Create track record in database
            await createAudioTrack({
              title,
              format,
              fileSize: file.size,
              s3Key,
              durationSeconds,
            });

            updateUpload(i, { progress: 100, status: "complete" });
            successCount++;
          } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
            updateUpload(i, { status: "error" });
            toast("Upload failed", {
              description: `Failed to upload "${file.name}". Please try again.`,
            });
          }
        }

        if (successCount > 0) {
          toast("Upload complete", {
            description:
              successCount === 1
                ? "Audio file added to your library"
                : `${successCount} audio files added to your library`,
          });
          onTrackAdded();
        }
      } finally {
        // Clear uploads after a delay
        setTimeout(() => {
          setUploads([]);
          setIsUploading(false);
        }, 2000);
      }

      // Reset file input
      e.target.value = "";
    },
    [maxFileSizeBytes, maxFileSizeMB, onTrackAdded, updateUpload]
  );

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
          id="audio-upload"
          disabled={isUploading}
          aria-describedby={error ? "audio-upload-error" : undefined}
        />
        <label
          htmlFor="audio-upload"
          className={cn(
            "cursor-pointer flex items-center gap-3 sm:gap-4",
            isUploading && "cursor-wait"
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
            {isUploading ? (
              <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus
                className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-foreground">
              {isUploading ? "Uploading..." : "Add audio files"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              MP3, M4A, FLAC, WAV, or OGG (max {maxFileSizeMB}MB)
            </p>
          </div>
        </label>
      </div>

      {/* Upload progress indicators - styled like Sonner toasts */}
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
              <Upload
                className={cn(
                  "w-4 h-4 shrink-0",
                  upload.status === "uploading" && "text-primary animate-pulse",
                  upload.status === "processing" &&
                    "text-amber-500 animate-spin",
                  upload.status === "complete" && "text-green-500",
                  upload.status === "error" && "text-destructive"
                )}
              />
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
          id="audio-upload-error"
          role="alert"
          className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
