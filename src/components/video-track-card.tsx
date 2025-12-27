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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VideoCover } from "@/components/video-cover";
import { AddToFolderModal } from "@/components/add-to-folder-modal";
import { cn } from "@/lib/utils";
import type { DBVideoTrack, VideoViewMode } from "@/types";
import { formatVideoDuration } from "@/types/video";

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

  // Grid/Cards view - vertical card layout
  if (viewMode === "grid" || viewMode === "cards") {
    return (
      <div
        className={cn(
          "group relative flex flex-col rounded-lg border overflow-hidden transition-all",
          "hover:bg-accent/50 hover:shadow-sm cursor-pointer",
          isCurrentTrack && "bg-accent/30 border-primary/50"
        )}
        onClick={() =>
          isPlaying && isCurrentTrack ? onPause() : onPlay(track)
        }
      >
        {/* Cover / Play Button */}
        <div className="relative aspect-video">
          <VideoCover
            coverUrl={track.coverUrl}
            title={track.title}
            className="w-full h-full"
            iconClassName="h-8 w-8"
          />

          {/* Play/Pause overlay */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity",
              isCurrentTrack && isPlaying && "opacity-100"
            )}
          >
            {isPlaying && isCurrentTrack ? (
              <Pause
                className="h-10 w-10 text-white drop-shadow-lg"
                fill="white"
              />
            ) : (
              <Play
                className="h-10 w-10 text-white drop-shadow-lg"
                fill="white"
              />
            )}
          </div>

          {/* Duration badge */}
          {track.durationSeconds && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
              {formatVideoDuration(track.durationSeconds)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex items-start gap-2">
            <h3
              className="font-medium text-sm truncate flex-1"
              title={track.title}
            >
              {track.title}
            </h3>
            {track.completedAt && (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            )}
          </div>

          {track.description && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {track.description}
            </p>
          )}

          {/* Progress bar */}
          {progress > 0 && progress < 100 && (
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: progress + "%" }}
              />
            </div>
          )}

          {/* Actions row */}
          <div className="mt-auto pt-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleFavoriteClick}
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5 transition-all duration-200",
                  track.isFavorite && "fill-amber-500 text-amber-500",
                  isAnimating && "scale-125"
                )}
              />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(track);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
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
        </div>

        <AddToFolderModal
          open={showFolderModal}
          onOpenChange={setShowFolderModal}
          itemId={track.id}
          itemType="video"
          itemTitle={track.title}
        />
      </div>
    );
  }

  // Compact view - minimal horizontal row
  if (viewMode === "compact") {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer",
          "hover:bg-accent/50",
          isCurrentTrack && "bg-accent/30"
        )}
        onClick={() =>
          isPlaying && isCurrentTrack ? onPause() : onPlay(track)
        }
      >
        {/* Small thumbnail */}
        <div className="relative shrink-0">
          <VideoCover
            coverUrl={track.coverUrl}
            title={track.title}
            className="w-12 h-8 rounded"
            iconClassName="h-4 w-4"
          />
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded",
              "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity",
              isCurrentTrack && isPlaying && "opacity-100"
            )}
          >
            {isPlaying && isCurrentTrack ? (
              <Pause className="h-4 w-4 text-white" fill="white" />
            ) : (
              <Play className="h-4 w-4 text-white" fill="white" />
            )}
          </div>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm truncate">{track.title}</span>
          {track.completedAt && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
          )}
        </div>

        {/* Duration */}
        <span className="text-xs text-muted-foreground shrink-0">
          {track.durationSeconds
            ? formatVideoDuration(track.durationSeconds)
            : "--:--"}
        </span>

        {/* Favorite */}
        <Heart
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
            track.isFavorite && "fill-amber-500 text-amber-500 opacity-100"
          )}
          onClick={handleFavoriteClick}
        />
      </div>
    );
  }

  // Default: List view - horizontal row with full details
  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 p-4 rounded-lg border transition-all",
        "hover:bg-accent/50 hover:shadow-sm",
        isCurrentTrack && "bg-accent/30 border-primary/50"
      )}
    >
      {/* Cover / Play Button */}
      <div className="relative shrink-0">
        <VideoCover
          coverUrl={track.coverUrl}
          title={track.title}
          className="w-20 h-12 rounded-md"
          iconClassName="h-6 w-6"
        />

        {/* Play/Pause overlay */}
        <button
          onClick={() =>
            isPlaying && isCurrentTrack ? onPause() : onPlay(track)
          }
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-md",
            "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity",
            isCurrentTrack && isPlaying && "opacity-100"
          )}
        >
          {isPlaying && isCurrentTrack ? (
            <Pause className="h-6 w-6 text-white" fill="white" />
          ) : (
            <Play className="h-6 w-6 text-white" fill="white" />
          )}
        </button>
      </div>

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{track.title}</h3>
          {track.completedAt && (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {track.description && (
            <span className="truncate max-w-xs">{track.description}</span>
          )}
        </div>

        {/* Progress bar */}
        {progress > 0 && progress < 100 && (
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: progress + "%" }}
            />
          </div>
        )}
      </div>

      {/* Duration */}
      <div className="shrink-0 text-sm text-muted-foreground">
        {track.durationSeconds
          ? formatVideoDuration(track.durationSeconds)
          : "--:--"}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleFavoriteClick}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all duration-200",
              track.isFavorite && "fill-amber-500 text-amber-500",
              isAnimating && "scale-125"
            )}
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(track)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(track)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowFolderModal(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Add to Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(track)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AddToFolderModal
        open={showFolderModal}
        onOpenChange={setShowFolderModal}
        itemId={track.id}
        itemType="video"
        itemTitle={track.title}
      />
    </div>
  );
}
