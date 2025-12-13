import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Pencil,
  Star,
  Loader2,
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
import { updateBook, uploadCover, getDownloadUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { DBBook } from "@/types";

interface EditBookModalProps {
  book: DBBook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookUpdated: () => void;
}

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function EditBookModal({
  book,
  open,
  onOpenChange,
  onBookUpdated,
}: EditBookModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
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
      .catch(() => {
        // Use default if settings fetch fails
      });
  }, []);

  const maxCoverSize = maxCoverSizeMB * 1024 * 1024;

  // Reset form when book changes
  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author || "");
      setIsFavorite(book.isFavorite);
      setCoverFile(null);
      setCoverPreview(null);
      setRemoveCover(false);

      // Load existing cover if available
      if (book.coverUrl) {
        // If it's an S3 key, we need to get a signed URL
        if (book.coverUrl.startsWith("covers/")) {
          getDownloadUrl(book.coverUrl)
            .then(({ downloadUrl }) => setExistingCoverUrl(downloadUrl))
            .catch(() => setExistingCoverUrl(null));
        } else {
          setExistingCoverUrl(book.coverUrl);
        }
      } else {
        setExistingCoverUrl(null);
      }
    }
  }, [book]);

  // Process and validate image file (used by both file input and paste)
  const processImageFile = useCallback(
    (file: File) => {
      // Validate file type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("Invalid file type", {
          description: "Please select a JPEG, PNG, WebP, or GIF image.",
        });
        return;
      }

      // Validate file size
      if (file.size > maxCoverSize) {
        toast.error("File too large", {
          description: `Cover image must be less than ${maxCoverSizeMB}MB.`,
        });
        return;
      }

      setCoverFile(file);
      setRemoveCover(false);

      // Create preview
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

  // Global paste handler when dialog is open
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

  const uploadCoverToS3 = async (
    file: File,
    bookId: string
  ): Promise<string> => {
    // Upload through our API (proxied upload)
    // This sends the file to our server, which uploads to S3 internally
    const { s3Key } = await uploadCover(bookId, file);
    return s3Key;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      let newCoverUrl: string | undefined = undefined;

      // Handle cover upload
      if (coverFile) {
        setIsUploadingCover(true);
        try {
          newCoverUrl = await uploadCoverToS3(coverFile, book.id);
        } catch (error) {
          console.error("[EditBookModal] Failed to upload cover:", error);
          toast.error("Failed to upload cover image");
          setIsUploadingCover(false);
          setIsSaving(false);
          return;
        }
        setIsUploadingCover(false);
      } else if (removeCover) {
        // Set to empty string to indicate removal
        newCoverUrl = "";
      }

      // Update book
      await updateBook(book.id, {
        title: trimmedTitle,
        author: author.trim() || undefined,
        isFavorite,
        ...(newCoverUrl !== undefined && {
          coverUrl: newCoverUrl || undefined,
        }),
      });

      toast.success("Book updated", {
        description: `"${trimmedTitle}" has been updated.`,
      });
      onBookUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("[EditBookModal] Failed to update book:", error);
      toast.error("Failed to update book", {
        description: "Please try again later.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = book
    ? title.trim() !== book.title ||
      (author.trim() || "") !== (book.author || "") ||
      isFavorite !== book.isFavorite ||
      coverFile !== null ||
      removeCover
    : false;

  const displayCover = coverPreview || (!removeCover && existingCoverUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Edit Book
          </DialogTitle>
          <DialogDescription>
            Update the book&apos;s details, cover image, or mark it as a
            favorite.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Image Section */}
          <div className="space-y-2">
            <Label>Cover Image</Label>
            <div className="flex items-start gap-4">
              {/* Cover Preview */}
              <div
                className={cn(
                  "w-20 h-28 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden transition-all",
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

              {/* Upload Controls */}
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

          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-author">Author</Label>
            <Input
              id="edit-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author name (optional)"
              disabled={isSaving}
            />
          </div>

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
