import { useState, useEffect, useCallback } from "react";
import { Music } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioTrackCard } from "./audio-track-card";
import { AudioUpload } from "./audio-upload";
import { AudioEditModal } from "./audio-edit-modal";
import { AddToFolderModal } from "@/components/add-to-folder-modal";
import { SearchInput, PaginationControls } from "./library";
import {
  AudioGrid,
  AudioCards,
  AudioCompact,
  AudioViewModeSwitcher,
} from "./audio-library";
import {
  fetchAudioTracksPaginated,
  deleteAudioTrack,
  toggleAudioFavorite,
  getAudioDownloadUrl,
  getAudioStreamUrl,
} from "@/lib/api/client";
import type { DBAudioTrack, AudioViewMode } from "@/types";
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

// Store page size preference (same key as book library for consistency)
const PAGE_SIZE_KEY = "bookish-library-page-size";
const VIEW_MODE_KEY = "bookish-audio-view-mode";

function getStoredPageSize(): number {
  if (typeof window === "undefined") return 20;
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 20;
}

function getStoredViewMode(): AudioViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  if (stored && ["list", "grid", "cards", "compact"].includes(stored)) {
    return stored as AudioViewMode;
  }
  return "list";
}

interface AudioLibraryViewProps {
  onPlayTrack: (
    track: DBAudioTrack,
    streamUrl: string,
    queue?: DBAudioTrack[],
    index?: number
  ) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
  onPause: () => void;
  onClosePlayer: () => void;
  /** If provided, will be used to update a track in the list without refetching */
  trackUpdate?: DBAudioTrack | null;
  /** Called when a track is edited via the modal, so parent can sync player state */
  onTrackEdited?: (track: DBAudioTrack) => void;
}

export function AudioLibraryView({
  onPlayTrack,
  currentTrackId,
  isPlaying = false,
  onPause,
  onClosePlayer,
  trackUpdate,
  onTrackEdited,
}: AudioLibraryViewProps) {
  const [tracks, setTracks] = useState<DBAudioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(getStoredPageSize);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<AudioViewMode>(getStoredViewMode);
  const [deleteTarget, setDeleteTarget] = useState<DBAudioTrack | null>(null);
  const [editTarget, setEditTarget] = useState<DBAudioTrack | null>(null);
  const [folderTarget, setFolderTarget] = useState<DBAudioTrack | null>(null);

  // Persist view mode
  const handleViewModeChange = useCallback((mode: AudioViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  // Update track in list when parent sends an update (e.g., duration detected)
  useEffect(() => {
    if (trackUpdate) {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackUpdate.id ? { ...t, ...trackUpdate } : t
        )
      );
    }
  }, [trackUpdate]);

  const loadTracks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchAudioTracksPaginated({
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
      console.error("Failed to load audio tracks:", error);
      toast.error("Failed to load audio tracks");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Persist page size
  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, String(newLimit));
  }, []);

  const handlePlay = useCallback(
    async (track: DBAudioTrack) => {
      try {
        const streamUrl = await getAudioStreamUrl(track.s3Key);
        // Find the index of this track in the current list to enable queue
        const trackIndex = tracks.findIndex((t) => t.id === track.id);
        onPlayTrack(track, streamUrl, tracks, trackIndex >= 0 ? trackIndex : 0);
      } catch (error) {
        console.error("Failed to get stream URL:", error);
        toast.error("Failed to play track");
      }
    },
    [onPlayTrack, tracks]
  );

  const handleToggleFavorite = useCallback(async (track: DBAudioTrack) => {
    try {
      const updated = await toggleAudioFavorite(track.id, !track.isFavorite);
      setTracks((prev) => prev.map((t) => (t.id === track.id ? updated : t)));
      toast.success(
        updated.isFavorite ? "Added to favorites" : "Removed from favorites"
      );
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast.error("Failed to update favorite status");
    }
  }, []);

  const handleDownload = useCallback(async (track: DBAudioTrack) => {
    try {
      const downloadUrl = await getAudioDownloadUrl(track.id);
      window.open(downloadUrl, "_blank");
    } catch (error) {
      console.error("Failed to get download URL:", error);
      toast.error("Failed to download track");
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    const wasCurrentTrack = deleteTarget.id === currentTrackId;
    const trackId = deleteTarget.id;

    // Close player immediately if we're deleting the current track
    if (wasCurrentTrack) {
      onClosePlayer();
    }

    // Update UI immediately for responsive feel
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    setTotalItems((prev) => prev - 1);
    setDeleteTarget(null);

    try {
      await deleteAudioTrack(trackId);
      toast.success("Track deleted");
    } catch (error) {
      console.error("Failed to delete track:", error);
      toast.error("Failed to delete track");
      // Reload to restore state on error
      loadTracks();
    }
  }, [deleteTarget, currentTrackId, onClosePlayer, loadTracks]);

  const handleEdit = useCallback((track: DBAudioTrack) => {
    setEditTarget(track);
  }, []);

  // Get display values
  const trackWord = totalItems === 1 ? "track" : "tracks";

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Audio Library
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {totalItems} {trackWord}
                  {search && ` matching "${search}"`}
                </p>
              </div>
            </div>

            {/* Search & View Mode */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search audio, artists, albums..."
              />
              <AudioViewModeSwitcher
                currentMode={viewMode}
                onChange={handleViewModeChange}
              />
            </div>
          </div>

          {/* Upload */}
          <div className="mb-6 sm:mb-8">
            <AudioUpload onTrackAdded={loadTracks} />
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
              <Music className="h-16 w-16 mb-4 opacity-50" />
              <h2 className="text-lg font-medium mb-2">No audio tracks yet</h2>
              <p className="text-sm">Upload some audio files to get started</p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              {tracks.map((track) => (
                <AudioTrackCard
                  key={track.id}
                  track={track}
                  isPlaying={isPlaying}
                  isCurrentTrack={currentTrackId === track.id}
                  onPlay={handlePlay}
                  onPause={onPause}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                  onDownload={handleDownload}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          ) : viewMode === "grid" ? (
            <AudioGrid
              tracks={tracks}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={onPause}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onDownload={handleDownload}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : viewMode === "cards" ? (
            <AudioCards
              tracks={tracks}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={onPause}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onDownload={handleDownload}
              onToggleFavorite={handleToggleFavorite}
              onAddToFolder={setFolderTarget}
            />
          ) : (
            <AudioCompact
              tracks={tracks}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={onPause}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onDownload={handleDownload}
              onToggleFavorite={handleToggleFavorite}
              onAddToFolder={setFolderTarget}
            />
          )}
        </div>
      </div>

      {/* Sticky Pagination Footer - always show so users can change page size */}
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
            <AlertDialogTitle>Delete audio track?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title}&rdquo;
              and remove it from all playlists. This action cannot be undone.
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
      <AudioEditModal
        track={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onTrackUpdated={(updatedTrack) => {
          // Update local list
          setTracks((prev) =>
            prev.map((t) => (t.id === updatedTrack.id ? updatedTrack : t))
          );
          // Notify parent so it can sync player state
          onTrackEdited?.(updatedTrack);
        }}
      />

      {/* Add to Folder Modal */}
      <AddToFolderModal
        open={!!folderTarget}
        onOpenChange={(open) => !open && setFolderTarget(null)}
        itemId={folderTarget?.id || ""}
        itemType="audio"
        itemTitle={folderTarget?.title || ""}
      />
    </div>
  );
}
