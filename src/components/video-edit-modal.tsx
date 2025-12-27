import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Star,
  Video,
  Upload,
  X,
  ImageIcon,
  Clipboard,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateVideo,
  uploadVideoCover,
  getDownloadUrl,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { DBVideoTrack } from "@/types/video";

interface VideoEditModalProps {
  track: DBVideoTrack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrackUpdated: (updatedTrack: DBVideoTrack) => void;
}

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function VideoEditModal({
  track,
  open,
  onOpenChange,
  onTrackUpdated,
}: VideoEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Cover image state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [maxCoverSizeMB, setMaxCoverSizeMB] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch cover max size from settings
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((settings) => {
        if (settings.cover?.maxSizeMB) {
          setMaxCoverSizeMB(settings.cover.maxSizeMB);
        }
      })
      .catch(() => {});
  }, []);

  const maxCoverSize = maxCoverSizeMB * 1024 * 1024;

  // Reset form when track changes
  useEffect(() => {
    if (track) {
      setTitle(track.title);
      setDescription(track.description || "");
      setIsFavorite(track.isFavorite);
      setCoverFile(null);
      setCoverPreview(null);
      setRemoveCover(false);

      if (track.coverUrl) {
        if (track.coverUrl.startsWith("video-covers/")) {
          getDownloadUrl(track.coverUrl)
            .then(({ downloadUrl }) => setExistingCoverUrl(downloadUrl))
            .catch(() => setExistingCoverUrl(null));
        } else {
          setExistingCoverUrl(track.coverUrl);
        }
      } else {
        setExistingCoverUrl(null);
      }
    }
  }, [track]);

  const processImageFile = useCallback(
    (file: File) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("Invalid file type", {
          description: "Please select a JPEG, PNG, WebP, or GIF image.",
        });
        return;
      }

      if (file.size > maxCoverSize) {
        toast.error("File too large", {
          description: `Cover image must be less than ${maxCoverSizeMB}MB.`,
        });
        return;
      }

      setCoverFile(file);
      setRemoveCover(false);

      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [maxCoverSize, maxCoverSizeMB]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processImageFile(file);
    },
    [processImageFile]
  );

  // Global paste handler
  useEffect(() => {
    if (!open) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processImageFile(file);
            toast.success("Image pasted from clipboard");
          }
          return;
        }
      }
    };

    document.addEventListener("paste", handleGlobalPaste);
    return () => document.removeEventListener("paste", handleGlobalPaste);
  }, [open, processImageFile]);

  const handleRemoveCover = useCallback(() => {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      let newCoverUrl: string | undefined = undefined;

      if (coverFile) {
        setIsUploadingCover(true);
        try {
          const s3Key = await uploadVideoCover(track.id, coverFile);
          newCoverUrl = s3Key;
        } catch (error) {
          console.error("[VideoEditModal] Failed to upload cover:", error);
          toast.error("Failed to upload cover image");
          setIsUploadingCover(false);
          setIsSaving(false);
          return;
        }
        setIsUploadingCover(false);
      } else if (removeCover) {
        newCoverUrl = "";
      }

      const updatedTrack = await updateVideo(track.id, {
        title: trimmedTitle,
        description: description.trim() || undefined,
        isFavorite,
        ...(newCoverUrl !== undefined && {
          coverUrl: newCoverUrl || undefined,
        }),
      });

      toast.success("Video updated", {
        description: `"${trimmedTitle}" has been updated.`,
      });
      onTrackUpdated(updatedTrack);
      onOpenChange(false);
    } catch (error) {
      console.error("[VideoEditModal] Failed to update video:", error);
      toast.error("Failed to update video", {
        description: "Please try again later.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = track
    ? title.trim() !== track.title ||
      (description.trim() || "") !== (track.description || "") ||
      isFavorite !== track.isFavorite ||
      coverFile !== null ||
      removeCover
    : false;

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} bytes`;
  };

  const displayCover = coverPreview || (!removeCover && existingCoverUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-rose-500" />
            Edit Video
          </DialogTitle>
          <DialogDescription>
            Update the video&apos;s details, cover image, or mark it as a
            favorite.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Image Section */}
          <div className="space-y-2">
            <Label>Cover Image</Label>
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "w-24 h-14 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden transition-all",
                  displayCover
                    ? "border-transparent"
                    : "border-border bg-secondary/30"
                )}
              >
                {displayCover ? (
                  <img
                    src={displayCover}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isSaving}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {displayCover ? "Change Cover" : "Upload Cover"}
                </Button>
                {displayCover && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveCover}
                    disabled={isSaving}
                    className="w-full text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove Cover
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP, or GIF. Max {maxCoverSizeMB}MB.
                </p>
                <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <Clipboard className="w-3 h-3" />
                  Or paste from clipboard (Ctrl/Cmd+V)
                </p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title"
              disabled={isSaving}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={isSaving}
            />
          </div>

          {/* Favorite Toggle */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              disabled={isSaving}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                isFavorite
                  ? "bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400"
                  : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
              aria-pressed={isFavorite}
            >
              <Star
                className={cn(
                  "w-4 h-4 transition-all",
                  isFavorite && "fill-current"
                )}
              />
              <span className="text-sm font-medium">
                {isFavorite ? "Favorite" : "Add to Favorites"}
              </span>
            </button>
          </div>

          {/* Video Info */}
          {track && (
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <p>
                <span className="font-medium">Format:</span>{" "}
                {track.format.toUpperCase()}
              </p>
              <p>
                <span className="font-medium">Duration:</span>{" "}
                {track.durationSeconds > 0
                  ? formatDuration(track.durationSeconds)
                  : "Play to detect"}
              </p>
              <p>
                <span className="font-medium">Size:</span>{" "}
                {formatFileSize(track.fileSize)}
              </p>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !hasChanges}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isUploadingCover ? "Uploading..." : "Saving..."}
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
