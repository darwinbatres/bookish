import {
  Heart,
  Play,
  Pause,
  HardDrive,
  Star,
  Bookmark,
  Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AudioCover } from "@/components/audio-cover";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/types/audio";
import type { DBAudioTrack } from "@/types";
import type { AudioTrackActions } from "./types";

interface AudioGridProps extends AudioTrackActions {
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

export function AudioGrid({
  tracks,
  currentTrackId,
  isPlaying = false,
  onPlay,
  onPause,
  onToggleFavorite,
}: AudioGridProps) {
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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
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
            <div className="relative h-32">
              <AudioCover
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

              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center bg-black/40",
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

              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(track);
                }}
                className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
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
            </div>

            <div className="flex-1 p-4 flex flex-col">
              <h3
                className="font-semibold text-sm truncate"
                title={track.title}
              >
                {track.title}
              </h3>
              {track.artist && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {track.artist}
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
                    ? formatDuration(track.durationSeconds)
                    : "--:--"}
                </span>
              </div>

              <div className="mt-auto pt-3">
                <div className="flex items-center justify-between mb-1.5">
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
