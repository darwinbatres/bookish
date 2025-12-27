import {
  Music,
  Heart,
  Play,
  Pause,
  Star,
  MoreVertical,
  Download,
  Trash,
  Edit,
  Bookmark,
  FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AudioCover } from "@/components/audio-cover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/types/audio";
import type { DBAudioTrack } from "@/types";
import type { AudioTrackActions } from "./types";

interface AudioCompactProps extends AudioTrackActions {
  tracks: DBAudioTrack[];
  currentTrackId?: string;
  isPlaying?: boolean;
}

export function AudioCompact({
  tracks,
  currentTrackId,
  isPlaying = false,
  onPlay,
  onPause,
  onEdit,
  onDelete,
  onDownload,
  onToggleFavorite,
  onAddToFolder,
}: AudioCompactProps) {
  if (tracks.length === 0) {
    return (
      <div
        className="text-center py-12 sm:py-16 text-muted-foreground"
        role="status"
      >
        <Music
          className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 opacity-30"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">No audio tracks found</p>
        <p className="text-xs mt-1 opacity-70">
          Try a different search or upload audio
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1" role="list">
      {tracks.map((track) => {
        const isCurrentTrack = currentTrackId === track.id;
        const progress = track.durationSeconds
          ? Math.round((track.currentPosition / track.durationSeconds) * 100)
          : 0;

        return (
          <article
            key={track.id}
            role="listitem"
            className={cn(
              "group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer",
              isCurrentTrack && "bg-accent/70"
            )}
            onClick={() =>
              isPlaying && isCurrentTrack ? onPause() : onPlay(track)
            }
          >
            {/* Thumbnail */}
            <div className="relative shrink-0 w-10 h-10 rounded overflow-hidden">
              <AudioCover
                coverUrl={track.coverUrl}
                title={track.title}
                className="w-full h-full"
                iconClassName="w-5 h-5"
              />

              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center bg-black/40",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
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

            {/* Favorite Star */}
            {track.isFavorite && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
            )}

            {/* Title & Artist */}
            <div className="flex-1 min-w-0 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <h3
                  className="text-sm font-medium truncate"
                  title={track.title}
                >
                  {track.title}
                </h3>
              </div>
              {track.artist && (
                <p className="text-xs text-muted-foreground truncate w-32 hidden sm:block">
                  {track.artist}
                </p>
              )}
            </div>

            {/* Bookmarks */}
            {(track.bookmarksCount ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground items-center gap-1 hidden md:flex">
                <Bookmark className="w-3 h-3" />
                {track.bookmarksCount}
              </span>
            )}

            {/* Progress */}
            <div className="w-20 hidden lg:block">
              <Progress value={progress} className="h-1" />
            </div>

            {/* Duration */}
            <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
              {track.durationSeconds
                ? formatDuration(track.durationSeconds)
                : "--:--"}
            </span>

            {/* Actions */}
            <div
              className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onToggleFavorite(track)}
                className="h-7 w-7 p-0"
                aria-label={
                  track.isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"
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
                  <DropdownMenuItem onClick={() => onEdit(track)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload(track)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  {onAddToFolder && (
                    <DropdownMenuItem onClick={() => onAddToFolder(track)}>
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Add to Folder
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(track)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </article>
        );
      })}
    </div>
  );
}
