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
import { MembershipBadge } from "@/components/membership-badge";
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
    <div
      className="border border-border rounded-xl overflow-hidden divide-y divide-border"
      role="list"
    >
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
            {/* Thumbnail */}
            <div className="relative shrink-0 w-8 h-10 rounded overflow-hidden">
              <AudioCover
                coverUrl={track.coverUrl}
                title={track.title}
                className="w-full h-full"
                iconClassName="w-4 h-4"
              />

              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center bg-black/40",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
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
            {((track.folderCount ?? 0) > 0 ||
              (track.playlistCount ?? 0) > 0) && (
              <MembershipBadge
                folderCount={track.folderCount}
                playlistCount={track.playlistCount}
                className="shrink-0"
              />
            )}

            {/* Title & Artist */}
            <div className="flex-1 min-w-0">
              <span
                className="text-sm font-medium truncate block"
                title={track.title}
              >
                {track.title}
              </span>
              {track.artist && (
                <span className="text-xs text-muted-foreground truncate block">
                  {track.artist}
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

            {/* Progress + Duration */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 flex items-center gap-1.5">
                <Progress value={progress} className="h-1 flex-1" />
                <span className="text-[10px] text-muted-foreground w-7 text-right">
                  {progress}%
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
            </div>
          </article>
        );
      })}
    </div>
  );
}
