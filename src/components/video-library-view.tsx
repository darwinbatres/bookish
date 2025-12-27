import { useState, useEffect, useCallback } from "react";
import { Video } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoTrackCard } from "./video-track-card";
import { VideoUpload } from "./video-upload";
import { VideoEditModal } from "./video-edit-modal";
import { SearchInput, PaginationControls } from "./library";
import { VideoViewModeSwitcher } from "./video-library";
import {
  fetchVideosPaginated,
  deleteVideo,
  toggleVideoFavorite,
  getVideoDownloadUrl,
  getVideoStreamUrl,
} from "@/lib/api/client";
import type { DBVideoTrack, VideoViewMode } from "@/types";
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

const PAGE_SIZE_KEY = "bookish-library-page-size";
const VIEW_MODE_KEY = "bookish-video-view-mode";

function getStoredPageSize(): number {
  if (typeof window === "undefined") return 20;
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 20;
}

function getStoredViewMode(): VideoViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  if (
    stored === "grid" ||
    stored === "cards" ||
    stored === "compact" ||
    stored === "list"
  ) {
    return stored;
  }
  return "list";
}

interface VideoLibraryViewProps {
  onPlayVideo?: (track: DBVideoTrack, streamUrl: string) => void;
  currentVideoId?: string;
  isPlaying?: boolean;
  onPause?: () => void;
}

export function VideoLibraryView({
  onPlayVideo,
  currentVideoId,
  isPlaying = false,
  onPause,
}: VideoLibraryViewProps) {
  const [tracks, setTracks] = useState<DBVideoTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(getStoredPageSize);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DBVideoTrack | null>(null);
  const [editTarget, setEditTarget] = useState<DBVideoTrack | null>(null);
  const [viewMode, setViewMode] = useState<VideoViewMode>(getStoredViewMode);

  const handleViewModeChange = useCallback((mode: VideoViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  const loadTracks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchVideosPaginated({
        page,
        limit,
        search: search || undefined,
        sortBy: "updatedAt",
        sortOrder: "desc",
      });
      setTracks(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.totalItems);
    } catch (error) {
      console.error("Failed to load videos:", error);
      toast.error("Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, String(newLimit));
  }, []);

  const handlePlay = useCallback(
    async (track: DBVideoTrack) => {
      if (!onPlayVideo) return;
      try {
        const streamUrl = await getVideoStreamUrl(track.s3Key);
        onPlayVideo(track, streamUrl);
      } catch (error) {
        console.error("Failed to get stream URL:", error);
        toast.error("Failed to play video");
      }
    },
    [onPlayVideo]
  );

  const handleToggleFavorite = useCallback(async (track: DBVideoTrack) => {
    try {
      const updated = await toggleVideoFavorite(track.id, !track.isFavorite);
      setTracks((prev) => prev.map((t) => (t.id === track.id ? updated : t)));
      toast.success(
        updated.isFavorite ? "Added to favorites" : "Removed from favorites"
      );
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast.error("Failed to update favorite status");
    }
  }, []);

  const handleDownload = useCallback(async (track: DBVideoTrack) => {
    try {
      const downloadUrl = await getVideoDownloadUrl(track.id);
      window.open(downloadUrl, "_blank");
    } catch (error) {
      console.error("Failed to get download URL:", error);
      toast.error("Failed to download video");
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    const trackId = deleteTarget.id;
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    setTotalItems((prev) => prev - 1);
    setDeleteTarget(null);

    try {
      await deleteVideo(trackId);
      toast.success("Video deleted");
    } catch (error) {
      console.error("Failed to delete video:", error);
      toast.error("Failed to delete video");
      loadTracks();
    }
  }, [deleteTarget, loadTracks]);

  const handleEdit = useCallback((track: DBVideoTrack) => {
    setEditTarget(track);
  }, []);

  const videoWord = totalItems === 1 ? "video" : "videos";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Video Library
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {totalItems} {videoWord}
                  {search && ` matching "${search}"`}
                </p>
              </div>
              <VideoViewModeSwitcher
                currentMode={viewMode}
                onChange={handleViewModeChange}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search videos..."
              />
            </div>
          </div>

          {/* Upload */}
          <div className="mb-6 sm:mb-8">
            <VideoUpload onTrackAdded={loadTracks} />
          </div>

          {/* Content */}
          {loading && tracks.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Video className="h-16 w-16 mb-4 opacity-50" />
              <h2 className="text-lg font-medium mb-2">No videos yet</h2>
              <p className="text-sm">Upload some video files to get started</p>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                  : viewMode === "cards"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    : viewMode === "compact"
                      ? "space-y-1"
                      : "space-y-2"
              }
            >
              {tracks.map((track) => (
                <VideoTrackCard
                  key={track.id}
                  track={track}
                  isPlaying={isPlaying}
                  isCurrentTrack={currentVideoId === track.id}
                  onPlay={handlePlay}
                  onPause={onPause || (() => {})}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                  onDownload={handleDownload}
                  onToggleFavorite={handleToggleFavorite}
                  viewMode={viewMode}
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
            <AlertDialogTitle>Delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title}&rdquo;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <VideoEditModal
        track={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onTrackUpdated={(updatedTrack) => {
          setTracks((prev) =>
            prev.map((t) => (t.id === updatedTrack.id ? updatedTrack : t))
          );
        }}
      />
    </div>
  );
}
