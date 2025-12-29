/**
 * ImageUpload Component
 * Drag-and-drop and file select for image uploads
 * Created: December 2024
 */

import type React from "react";
import { useCallback, useState, useEffect } from "react";
import { Plus, AlertCircle, Upload } from "lucide-react";
import type { ImageFormat } from "@/types";
import { uploadImageFile, createImage, fetchSettings } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const DEFAULT_MAX_FILE_SIZE_MB = 100;
const ACCEPTED_FORMATS = ".jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.avif,.heic";

function extractTitleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
}

function getFormatFromFilename(filename: string): ImageFormat {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "gif":
      return "gif";
    case "webp":
      return "webp";
    case "svg":
      return "svg";
    case "bmp":
      return "bmp";
    case "avif":
      return "avif";
    case "heic":
      return "heic";
    default:
      return "jpg";
  }
}

interface ImageUploadProps {
  onSuccess?: () => void;
}

interface UploadState {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
}

export function ImageUpload({ onSuccess }: ImageUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(DEFAULT_MAX_FILE_SIZE_MB);

  useEffect(() => {
    fetchSettings()
      .then((settings) => {
        if (settings?.images?.maxSizeMB) {
          setMaxFileSizeMB(settings.images.maxSizeMB);
        }
      })
      .catch(() => {});
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
            toast.error(`"${file.name}" exceeds the ${maxFileSizeMB}MB limit.`);
            continue;
          }

          try {
            const format = getFormatFromFilename(file.name);
            const title = extractTitleFromFilename(file.name);

            updateUpload(i, { progress: 5 });

            // Upload file through our API
            const uploadResult = await uploadImageFile(file, (percent) => {
              const mappedProgress = 10 + percent * 0.7;
              updateUpload(i, { progress: Math.round(mappedProgress) });
            });

            updateUpload(i, { progress: 85, status: "processing" });

            // Create image record in database
            await createImage({
              title,
              format,
              fileSize: file.size,
              s3Key: uploadResult.s3Key,
            });

            updateUpload(i, { progress: 100, status: "complete" });
            successCount++;
          } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
            updateUpload(i, { status: "error" });
            toast.error(`Failed to upload "${file.name}"`);
          }
        }

        if (successCount > 0) {
          toast.success(
            successCount === 1
              ? "Image added to your library"
              : `${successCount} images added to your library`
          );
          onSuccess?.();
        }
      } finally {
        setTimeout(() => {
          setUploads([]);
          setIsUploading(false);
        }, 2000);
      }

      e.target.value = "";
    },
    [maxFileSizeBytes, maxFileSizeMB, onSuccess, updateUpload]
  );

  return (
    <div className="space-y-3">
      {/* Upload zone - matching Video style */}
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
          id="image-upload-input"
          disabled={isUploading}
          aria-describedby={error ? "image-upload-error" : undefined}
        />
        <label
          htmlFor="image-upload-input"
          className={cn(
            "cursor-pointer flex items-center gap-3 sm:gap-4",
            isUploading && "cursor-wait"
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
            {isUploading ? (
              <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus
                className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-foreground">
              {isUploading ? "Uploading..." : "Add image files"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              JPG, PNG, GIF, WebP, SVG, or HEIC (max {maxFileSizeMB}MB)
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
          id="image-upload-error"
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
