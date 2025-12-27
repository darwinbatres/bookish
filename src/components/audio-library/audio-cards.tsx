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
  HardDrive,
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

interface AudioCardsProps extends AudioTrackActions {
  tracks: DBAudioTrack[];
  currentTrackId?: string;
  isPlaying?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function AudioCards({
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
}: AudioCardsProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
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
              "group flex gap-4 bg-card border border-border rounded-xl p-4 hover:border-muted-foreground/30 transition-all",
              isCurrentTrack && "border-primary/50 bg-accent/30"
            )}
          >
            {/* Cover / Play Button */}
            <div
              className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden cursor-pointer"
              onClick={() =>
                isPlaying && isCurrentTrack ? onPause() : onPlay(track)
              }
            >
              <AudioCover
                coverUrl={track.coverUrl}
                title={track.title}
                className="w-full h-full"
                iconClassName="w-8 h-8"
              />

              {track.isFavorite && (
                <div className="absolute top-1.5 left-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                </div>
              )}

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
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3
                    className="font-semibold text-sm truncate"
                    title={track.title}
                  >
                    {track.title}
                  </h3>
                  {track.artist && (
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artist}
                    </p>
                  )}
                  {track.album && (
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {track.album}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleFavorite(track)}
                    className="h-8 w-8 p-0"
                    aria-label={
                      track.isFavorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                  >
                    <Heart
                      className={cn(
                        "w-4 h-4",
                        track.isFavorite && "fill-amber-500 text-amber-500"
                      )}
                    />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
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
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
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
                    ? formatDuration(track.durationSeconds)
                    : "--:--"}
                </span>
              </div>

              <div className="mt-auto pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    {track.durationSeconds
                      ? `${formatDuration(track.currentPosition)} / ${formatDuration(track.durationSeconds)}`
                      : "Not started"}
                  </span>
                  <span className="text-[10px] font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1" />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
