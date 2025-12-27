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
import { AudioCover } from "@/components/audio-cover";
import { AddToFolderModal } from "@/components/add-to-folder-modal";
import { cn } from "@/lib/utils";
import type { DBAudioTrack } from "@/types";
import { formatDuration } from "@/types/audio";

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
}: AudioTrackCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);

  const handleFavoriteClick = () => {
    setIsAnimating(true);
    onToggleFavorite(track);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const progress = track.durationSeconds
    ? (track.currentPosition / track.durationSeconds) * 100
    : 0;

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
        <AudioCover
          coverUrl={track.coverUrl}
          title={track.title}
          className="w-14 h-14 rounded-md"
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
          {track.artist && <span className="truncate">{track.artist}</span>}
          {track.artist && track.album && <span>-</span>}
          {track.album && <span className="truncate">{track.album}</span>}
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
          ? formatDuration(track.durationSeconds)
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
        itemType="audio"
        itemTitle={track.title}
      />
    </div>
  );
}
