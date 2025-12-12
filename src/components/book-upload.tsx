import type React from "react";
import { Plus, FileText, AlertCircle, Upload } from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import type { BookFormat } from "@/types";
import { getUploadUrl, createBook, fetchSettings } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

// Default max file size (will be overridden by settings)
const DEFAULT_MAX_FILE_SIZE_MB = 100;
const ACCEPTED_FORMATS = ".pdf,.epub,.mobi" as const;

// Utility functions
function generateId(): string {
  return crypto.randomUUID();
}

function extractTitleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
}

function getFormatFromFilename(filename: string): BookFormat {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "epub") return "epub";
  if (ext === "mobi") return "mobi";
  return "pdf";
}

function getContentTypeFromFormat(format: BookFormat): string {
  switch (format) {
    case "epub":
      return "application/epub+zip";
    case "mobi":
      return "application/x-mobipocket-ebook";
    default:
      return "application/pdf";
  }
}

interface BookUploadProps {
  onBookAdded: () => void;
}

interface UploadState {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
}

export function BookUpload({ onBookAdded }: BookUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(DEFAULT_MAX_FILE_SIZE_MB);

  // Fetch settings on mount to get actual max file size
  useEffect(() => {
    fetchSettings()
      .then((settings) => {
        if (settings?.upload?.maxSizeMB) {
          setMaxFileSizeMB(settings.upload.maxSizeMB);
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
            const contentType = getContentTypeFromFormat(format);
            const bookId = generateId();
            const title = extractTitleFromFilename(file.name);

            updateUpload(i, { progress: 10 });

            // Get presigned upload URL from API
            const { uploadUrl, s3Key } = await getUploadUrl(
              bookId,
              file.name,
              contentType,
              file.size
            );

            updateUpload(i, { progress: 20 });

            // Upload file with progress tracking using XMLHttpRequest
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();

              xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                  // Map 0-100% of upload to 20-80% of our progress
                  const uploadPercent = (event.loaded / event.total) * 100;
                  const mappedProgress = 20 + uploadPercent * 0.6;
                  updateUpload(i, { progress: Math.round(mappedProgress) });
                }
              });

              xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve();
                } else {
                  reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
              });

              xhr.addEventListener("error", () => {
                reject(new Error("Network error during upload"));
              });

              xhr.open("PUT", uploadUrl);
              xhr.setRequestHeader("Content-Type", contentType);
              xhr.send(file);
            });

            updateUpload(i, { progress: 85, status: "processing" });

            // Create book record in database
            await createBook({
              title,
              format,
              fileSize: file.size,
              s3Key,
            });

            updateUpload(i, { progress: 100, status: "complete" });
            successCount++;
            onBookAdded();
          } catch (err) {
            console.error(`[Bookish] Upload error for ${file.name}:`, err);
            updateUpload(i, { status: "error" });
          }
        }

        if (successCount > 0) {
          toast(
            successCount === 1 ? "Book added" : `${successCount} books added`,
            {
              description:
                successCount === 1
                  ? "Your book has been uploaded successfully."
                  : `${successCount} books have been uploaded successfully.`,
            }
          );
        }

        // Clear uploads after delay
        setTimeout(() => setUploads([]), 2000);
      } catch (err) {
        console.error("[Bookish] Upload error:", err);
        const message =
          err instanceof Error ? err.message : "Failed to upload file";
        setError(message);
        toast("Upload failed", { description: message });
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [onBookAdded, updateUpload, maxFileSizeBytes, maxFileSizeMB]
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
          id="book-upload"
          disabled={isUploading}
          aria-describedby={error ? "upload-error" : undefined}
        />
        <label
          htmlFor="book-upload"
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
              {isUploading ? "Uploading..." : "Add books"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF, EPUB, or MOBI (max {maxFileSizeMB}MB)
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
          id="upload-error"
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

export function FormatIcon({
  format,
  className,
}: {
  format: "pdf" | "epub" | "mobi";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground",
        className
      )}
    >
      <FileText className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="uppercase text-[10px] font-semibold tracking-wide">
        {format}
      </span>
    </div>
  );
}
