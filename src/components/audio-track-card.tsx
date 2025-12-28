import { useState } from "react";
import {
  MoreVertical,
  Download,
  Trash2,
  Edit,
  FolderPlus,
  Star,
  HardDrive,
  Clock,
  Bookmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AudioCover } from "@/components/audio-cover";
import { AddToFolderModal } from "@/components/add-to-folder-modal";
import { MembershipBadge } from "@/components/membership-badge";
import { cn } from "@/lib/utils";
import type { DBAudioTrack } from "@/types";
import { formatDuration } from "@/types/audio";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface AudioTrackCardProps {
  track: DBAudioTrack;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  onPlay: (track: DBAudioTrack) => void;
  onPause: () => void;
  onEdit: (track: DBAudioTrack) => void;
  onDelete: (track: DBAudioTrack) => void;
  onDownload: (track: DBAudioTrack) => void;
  onToggleFavorite: (track: DBAudioTrack) => void;
  /** Called when track is added to a folder (for refreshing data) */
  onRefresh?: () => void;
}

export function AudioTrackCard({
  track,
  isPlaying = false,
  isCurrentTrack = false,
  onPlay,
  onPause,
  onEdit,
  onDelete,
  onDownload,
  onToggleFavorite,
  onRefresh,
}: AudioTrackCardProps) {
  const [showFolderModal, setShowFolderModal] = useState(false);

  const progress = track.durationSeconds
    ? (track.currentPosition / track.durationSeconds) * 100
    : 0;

  return (
    <article
      role="listitem"
      className={cn(
        "group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-border hover:border-muted-foreground/30 active:bg-secondary/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        isCurrentTrack && "border-primary/50 bg-accent/30"
      )}
      onClick={() => (isPlaying && isCurrentTrack ? onPause() : onPlay(track))}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isPlaying && isCurrentTrack) {
            onPause();
          } else {
            onPlay(track);
          }
        }
      }}
      tabIndex={0}
    >
      {/* Cover thumbnail - hidden on mobile */}
      <AudioCover
        coverUrl={track.coverUrl}
        title={track.title}
        className="w-12 h-12 rounded-lg shrink-0 hidden sm:flex"
        iconClassName="w-5 h-5"
      />

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-foreground truncate pr-2 flex items-center gap-1.5">
          {track.isFavorite && (
            <Star
              className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0"
              aria-label="Favorite"
            />
          )}
          <span className="truncate">{track.title}</span>
        </h3>
        {(track.artist || track.album) && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {track.artist}
            {track.artist && track.album && " — "}
            {track.album}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <span className="text-xs text-muted-foreground uppercase font-medium">
            AUDIO
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-xs text-muted-foreground">
            {track.durationSeconds
              ? formatDuration(track.durationSeconds)
              : "Open to load duration"}
          </span>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <HardDrive className="w-3 h-3" aria-hidden="true" />
            {formatBytes(track.fileSize)}
          </span>
          {(track.bookmarksCount ?? 0) > 0 && (
            <>
              <span className="hidden sm:inline text-muted-foreground/40">
                •
              </span>
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Bookmark className="w-3 h-3" aria-hidden="true" />
                {track.bookmarksCount}
              </span>
            </>
          )}
          {((track.folderCount ?? 0) > 0 || (track.playlistCount ?? 0) > 0) && (
            <>
              <span className="hidden sm:inline text-muted-foreground/40">
                •
              </span>
              <span className="hidden sm:inline">
                <MembershipBadge
                  folderCount={track.folderCount}
                  playlistCount={track.playlistCount}
                />
              </span>
            </>
          )}
        </div>
        {/* Mobile-only metadata row */}
        <div className="flex sm:hidden items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {formatBytes(track.fileSize)}
          </span>
          {(track.bookmarksCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Bookmark className="w-3 h-3" />
              {track.bookmarksCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
        {/* Progress bar */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-initial sm:w-32">
          <div
            className="flex-1 sm:flex-initial sm:w-20 h-1.5 sm:h-1 bg-secondary rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Listening progress: ${progress}%`}
          >
            <div
              className="h-full bg-foreground/70 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground w-8 text-right">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={(e) => {
              e.stopPropagation();
              if (isPlaying && isCurrentTrack) {
                onPause();
              } else {
                onPlay(track);
              }
            }}
            className="h-9 sm:h-8 px-4 sm:px-3 text-xs font-semibold"
          >
            {isPlaying && isCurrentTrack ? "Pause" : "Play"}
          </Button>

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                className="h-9 sm:h-8 w-9 sm:w-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                aria-label={`More options for ${track.title}`}
              >
                <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => onEdit(track)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleFavorite(track)}>
                <Star
                  className={cn(
                    "w-4 h-4 mr-2",
                    track.isFavorite && "fill-current text-amber-500"
                  )}
                />
                {track.isFavorite
                  ? "Remove from Favorites"
                  : "Add to Favorites"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload(track)}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFolderModal(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add to Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(track)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AddToFolderModal
        open={showFolderModal}
        onOpenChange={setShowFolderModal}
        itemId={track.id}
        itemType="audio"
        itemTitle={track.title}
        onSuccess={onRefresh}
      />
    </article>
  );
}
