import { useState, useEffect, useCallback } from "react";
import { ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageCard } from "./image-card";
import { ImageUpload } from "./image-upload";
import { ImageEditModal } from "./image-edit-modal";
import { ImageViewer } from "./image-viewer";
import { SearchInput, PaginationControls } from "./library";
import { ImageViewModeSwitcher } from "./image-library";
import {
  getImages,
  deleteImage,
  updateImage,
  downloadImageFile,
} from "@/lib/api/client";
import type { DBImage, ImageViewMode } from "@/types";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteConfirmationInfo } from "./delete-confirmation-info";

const PAGE_SIZE_KEY = "bookish-library-page-size";
const VIEW_MODE_KEY = "bookish-image-view-mode";

function getStoredPageSize(): number {
  if (typeof window === "undefined") return 20;
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 20;
}

function getStoredViewMode(): ImageViewMode {
  if (typeof window === "undefined") return "grid";
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  if (
    stored === "grid" ||
    stored === "cards" ||
    stored === "compact" ||
    stored === "list"
  ) {
    return stored;
  }
  return "grid";
}

export function ImageLibraryView() {
  const [images, setImages] = useState<DBImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(getStoredPageSize);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DBImage | null>(null);
  const [editTarget, setEditTarget] = useState<DBImage | null>(null);
  const [viewTarget, setViewTarget] = useState<DBImage | null>(null);
  const [viewMode, setViewMode] = useState<ImageViewMode>(getStoredViewMode);

  const handleViewModeChange = useCallback((mode: ImageViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getImages({
        page,
        limit,
        search: search || undefined,
        sortBy: "createdAt",
        sortDir: "desc",
      });
      setImages(result.data);
      setTotalItems(result.pagination.totalItems);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error("Failed to load images:", error);
      toast.error("Failed to load images");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, String(newLimit));
  }, []);

  const handleToggleFavorite = useCallback(async (image: DBImage) => {
    try {
      await updateImage(image.id, { isFavorite: !image.isFavorite });
      setImages((prev) =>
        prev.map((i) =>
          i.id === image.id ? { ...i, isFavorite: !image.isFavorite } : i
        )
      );
      toast.success(
        image.isFavorite ? "Removed from favorites" : "Added to favorites"
      );
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast.error("Failed to update favorite status");
    }
  }, []);

  const handleDownload = useCallback(async (image: DBImage) => {
    try {
      await downloadImageFile(image);
    } catch (error) {
      console.error("Failed to download:", error);
      toast.error("Failed to download image");
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    const imageId = deleteTarget.id;
    setImages((prev) => prev.filter((i) => i.id !== imageId));
    setTotalItems((prev) => prev - 1);
    setDeleteTarget(null);

    try {
      await deleteImage(imageId);
      toast.success("Image deleted");
    } catch (error) {
      console.error("Failed to delete image:", error);
      toast.error("Failed to delete image");
      loadImages();
    }
  }, [deleteTarget, loadImages]);

  const handleEdit = useCallback((image: DBImage) => {
    setEditTarget(image);
  }, []);

  const handleView = useCallback((image: DBImage) => {
    setViewTarget(image);
  }, []);

  const imageWord = totalItems === 1 ? "image" : "images";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Image Library
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {totalItems} {imageWord}
                  {search && ` matching "${search}"`}
                </p>
              </div>
            </div>

            {/* Search and view controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search images..."
              />
              <ImageViewModeSwitcher
                currentMode={viewMode}
                onChange={handleViewModeChange}
              />
            </div>
          </div>

          {/* Upload */}
          <div className="mb-6 sm:mb-8">
            <ImageUpload onSuccess={loadImages} />
          </div>

          {/* Content */}
          {loading && images.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ImageIcon className="h-16 w-16 mb-4 opacity-50" />
              <h2 className="text-lg font-medium mb-2">No images yet</h2>
              <p className="text-sm">Upload some image files to get started</p>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : viewMode === "cards"
                    ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                    : viewMode === "compact"
                      ? "border border-border rounded-xl overflow-hidden divide-y divide-border"
                      : "space-y-2"
              }
            >
              {images.map((image) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  viewMode={viewMode}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                  onDownload={handleDownload}
                  onToggleFavorite={handleToggleFavorite}
                  onRefresh={loadImages}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="shrink-0 border-t border-border bg-popover/80 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-3 safe-area-inset-bottom">
        <div className="max-w-6xl mx-auto">
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={handleLimitChange}
          />
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  This will permanently delete &ldquo;{deleteTarget?.title}
                  &rdquo;. This action cannot be undone.
                </p>
                {deleteTarget && (
                  <DeleteConfirmationInfo
                    itemType="image"
                    itemId={deleteTarget.id}
                    isFavorite={deleteTarget.isFavorite}
                  />
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <ImageEditModal
        image={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSuccess={() => {
          loadImages();
          setEditTarget(null);
        }}
      />

      {/* Image Viewer */}
      {viewTarget && (
        <ImageViewer
          image={viewTarget}
          onClose={() => setViewTarget(null)}
          onPrev={
            images.indexOf(viewTarget) > 0
              ? () => {
                  const idx = images.indexOf(viewTarget);
                  setViewTarget(images[idx - 1]);
                }
              : undefined
          }
          onNext={
            images.indexOf(viewTarget) < images.length - 1
              ? () => {
                  const idx = images.indexOf(viewTarget);
                  setViewTarget(images[idx + 1]);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
