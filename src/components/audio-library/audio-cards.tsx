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
  Calendar,
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

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
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
              <AudioCover
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

              {((track.folderCount ?? 0) > 0 ||
                (track.playlistCount ?? 0) > 0) && (
                <MembershipBadge
                  folderCount={track.folderCount}
                  playlistCount={track.playlistCount}
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
                  {track.artist && (
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artist}
                    </p>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <MoreVertical className="w-4 h-4" />
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
                      Edit Track
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
                    {onAddToFolder && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToFolder(track);
                        }}
                      >
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Add to Folder
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(track);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash className="w-4 h-4 mr-2" />
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
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatRelativeDate(track.updatedAt)}
                </span>
              </div>

              {/* Progress */}
              <div className="mt-auto pt-3 flex items-center gap-3">
                <div className="flex-1">
                  <Progress value={progress} className="h-1.5" />
                </div>
                <span className="text-xs font-medium w-16 text-right">
                  {track.durationSeconds
                    ? `${formatDuration(track.currentPosition)}/${formatDuration(track.durationSeconds)}`
                    : "0%"}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
