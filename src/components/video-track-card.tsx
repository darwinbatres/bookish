import { useState } from "react";
import {
  Heart,
  MoreVertical,
  Play,
  Pause,
  Download,
  Trash2,
  Edit,
  CheckCircle2,
  FolderPlus,
  Star,
  HardDrive,
  Bookmark,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VideoCover } from "@/components/video-cover";
import { MembershipBadge } from "@/components/membership-badge";
import { AddToFolderModal } from "@/components/add-to-folder-modal";
import { cn } from "@/lib/utils";
import type { DBVideoTrack, VideoViewMode } from "@/types";
import { formatVideoDuration } from "@/types/video";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface VideoTrackCardProps {
  track: DBVideoTrack;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  viewMode?: VideoViewMode;
  onPlay: (track: DBVideoTrack) => void;
  onPause: () => void;
  onEdit: (track: DBVideoTrack) => void;
  onDelete: (track: DBVideoTrack) => void;
  onDownload: (track: DBVideoTrack) => void;
  onToggleFavorite: (track: DBVideoTrack) => void;
  /** Called when track is added to a folder (for refreshing data) */
  onRefresh?: () => void;
}

export function VideoTrackCard({
  track,
  isPlaying = false,
  isCurrentTrack = false,
  viewMode = "list",
  onPlay,
  onPause,
  onEdit,
  onDelete,
  onDownload,
  onToggleFavorite,
  onRefresh,
}: VideoTrackCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    onToggleFavorite(track);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const progress = track.durationSeconds
    ? (track.currentPosition / track.durationSeconds) * 100
    : 0;

  // Cards view - horizontal layout matching Book cards (cover left, details right)
  if (viewMode === "cards") {
    return (
      <article
        className={cn(
          "group flex bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring",
          isCurrentTrack && "border-primary/50 bg-accent/30"
        )}
        onClick={() =>
          isPlaying && isCurrentTrack ? onPause() : onPlay(track)
        }
        tabIndex={0}
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
      >
        {/* Cover side */}
        <div className="w-24 sm:w-32 shrink-0 relative">
          <VideoCover
            coverUrl={track.coverUrl}
            title={track.title}
            className="w-full h-full"
            iconClassName="w-10 h-10"
          />
          {track.isFavorite && (
            <div className="absolute top-2 left-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
          )}
          {(track.folderCount ?? 0) > 0 && (
            <MembershipBadge
              folderCount={track.folderCount}
              className="absolute top-2 right-2"
            />
          )}
          {/* Play overlay */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              isCurrentTrack && isPlaying && "opacity-100"
            )}
          >
            {isPlaying && isCurrentTrack ? (
              <Pause className="h-8 w-8 text-white" fill="white" />
            ) : (
              <Play className="h-8 w-8 text-white" fill="white" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-sm truncate"
                title={track.title}
              >
                {track.title}
              </h3>
              {track.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {track.description}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(track);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Video
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(track);
                  }}
                >
                  <Star
                    className={cn(
                      "mr-2 h-4 w-4",
                      track.isFavorite && "fill-current text-amber-500"
                    )}
                  />
                  {track.isFavorite
                    ? "Remove from Favorites"
                    : "Add to Favorites"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(track);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFolderModal(true);
                  }}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Add to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(track);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
            {track.durationSeconds && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatVideoDuration(track.durationSeconds)}
              </span>
            )}
          </div>

          {/* Progress */}
          <div className="mt-auto pt-3 flex items-center gap-3">
            <div className="flex-1">
              <Progress value={progress} className="h-1.5" />
            </div>
            <span className="text-xs font-medium w-16 text-right">
              {track.durationSeconds
                ? `${formatVideoDuration(track.currentPosition)}/${formatVideoDuration(track.durationSeconds)}`
                : "0%"}
            </span>
          </div>
        </div>

        <AddToFolderModal
          open={showFolderModal}
          onOpenChange={setShowFolderModal}
          itemId={track.id}
          itemType="video"
          itemTitle={track.title}
          onSuccess={onRefresh}
        />
      </article>
    );
  }

  // Grid view - vertical card layout matching Book/Audio grid
  if (viewMode === "grid") {
    return (
      <article
        className={cn(
          "group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring",
          isCurrentTrack && "border-primary/50 bg-accent/30"
        )}
        onClick={() =>
          isPlaying && isCurrentTrack ? onPause() : onPlay(track)
        }
        tabIndex={0}
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
      >
        {/* Cover/Header */}
        <div className="relative h-32">
          <VideoCover
            coverUrl={track.coverUrl}
            title={track.title}
            className="w-full h-full"
            iconClassName="w-12 h-12"
          />

          {track.isFavorite && (
            <div className="absolute top-2 left-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
          )}

          <div className="absolute top-2 right-2 flex gap-1 z-10">
            {(track.folderCount ?? 0) > 0 && (
              <MembershipBadge
                folderCount={track.folderCount}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(track);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Video
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(track);
                  }}
                >
                  <Star
                    className={cn(
                      "mr-2 h-4 w-4",
                      track.isFavorite && "fill-current text-amber-500"
                    )}
                  />
                  {track.isFavorite
                    ? "Remove from Favorites"
                    : "Add to Favorites"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(track);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFolderModal(true);
                  }}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Add to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(track);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Play/Pause overlay */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              isCurrentTrack && isPlaying && "opacity-100"
            )}
          >
            {isPlaying && isCurrentTrack ? (
              <Pause className="h-10 w-10 text-white" fill="white" />
            ) : (
              <Play className="h-10 w-10 text-white" fill="white" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col">
          <h3 className="font-semibold text-sm truncate" title={track.title}>
            {track.title}
          </h3>
          {track.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {track.description}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
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
            <span className="ml-auto">
              {track.durationSeconds
                ? formatVideoDuration(track.durationSeconds)
                : "--:--"}
            </span>
          </div>

          {/* Progress */}
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground">
                {track.durationSeconds
                  ? `${formatVideoDuration(track.currentPosition)} / ${formatVideoDuration(track.durationSeconds)}`
                  : "Not started"}
              </span>
              <span className="text-[10px] font-medium">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        </div>

        <AddToFolderModal
          open={showFolderModal}
          onOpenChange={setShowFolderModal}
          itemId={track.id}
          itemType="video"
          itemTitle={track.title}
          onSuccess={onRefresh}
        />
      </article>
    );
  }

  // Compact view - minimal horizontal row matching Books compact
  if (viewMode === "compact") {
    return (
      <div
        className={cn(
          "group flex items-center gap-3 px-3 py-3 hover:bg-secondary/30 transition-colors cursor-pointer",
          isCurrentTrack && "bg-accent/50"
        )}
        onClick={() =>
          isPlaying && isCurrentTrack ? onPause() : onPlay(track)
        }
        tabIndex={0}
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
      >
        {/* Small thumbnail */}
        <div className="relative shrink-0 w-8 h-10 rounded overflow-hidden">
          <VideoCover
            coverUrl={track.coverUrl}
            title={track.title}
            className="w-full h-full"
            iconClassName="w-4 h-4"
          />
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity",
              isCurrentTrack && isPlaying && "opacity-100"
            )}
          >
            {isPlaying && isCurrentTrack ? (
              <Pause className="h-3 w-3 text-white" fill="white" />
            ) : (
              <Play className="h-3 w-3 text-white" fill="white" />
            )}
          </div>
        </div>

        {/* Favorite Star */}
        {track.isFavorite && (
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
        )}

        {/* Membership Badge */}
        {(track.folderCount ?? 0) > 0 && (
          <MembershipBadge
            folderCount={track.folderCount}
            className="shrink-0"
          />
        )}

        {/* Title & Description */}
        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-medium truncate block"
            title={track.title}
          >
            {track.title}
          </span>
          {track.description && (
            <span className="text-xs text-muted-foreground truncate block">
              {track.description}
            </span>
          )}
        </div>

        {/* Bookmarks - hidden on small screens */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          {(track.bookmarksCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Bookmark className="w-3 h-3" />
              {track.bookmarksCount}
            </span>
          )}
        </div>

        {/* Progress + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-16 flex items-center gap-1.5">
            <Progress value={progress} className="h-1 flex-1" />
            <span className="text-[10px] text-muted-foreground w-7 text-right">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Actions on hover */}
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFavoriteClick}
              className="h-7 w-7 p-0"
              aria-label={
                track.isFavorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              <Heart
                className={cn(
                  "w-3.5 h-3.5",
                  track.isFavorite && "fill-amber-500 text-amber-500"
                )}
              />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(track);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Video
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(track);
                  }}
                >
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
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(track);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFolderModal(true);
                  }}
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Add to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(track);
                  }}
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
          itemType="video"
          itemTitle={track.title}
          onSuccess={onRefresh}
        />
      </div>
    );
  }

  // Default: List view - horizontal row matching BookTable style
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
      <VideoCover
        coverUrl={track.coverUrl}
        title={track.title}
        className="w-16 h-10 rounded-lg shrink-0 hidden sm:flex"
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
        {track.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {track.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <span className="text-xs text-muted-foreground uppercase font-medium">
            VIDEO
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-xs text-muted-foreground">
            {track.durationSeconds
              ? formatVideoDuration(track.durationSeconds)
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
          {(track.folderCount ?? 0) > 0 && (
            <>
              <span className="hidden sm:inline text-muted-foreground/40">
                •
              </span>
              <span className="hidden sm:inline">
                <MembershipBadge folderCount={track.folderCount} />
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
            aria-label={`Watching progress: ${Math.round(progress)}%`}
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
            {isPlaying && isCurrentTrack ? "Pause" : "Watch"}
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
                Edit Video
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
        itemType="video"
        itemTitle={track.title}
        onSuccess={onRefresh}
      />
    </article>
  );
}
