import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioCover } from "@/components/audio-cover";
import { cn } from "@/lib/utils";
import type { DBAudioTrack } from "@/types";
import { formatDuration } from "@/types/audio";
import { Slider } from "@/components/ui/slider";

interface MiniPlayerProps {
  track: DBAudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onClose: () => void;
  onExpand?: () => void;
}

export function MiniPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onPlay,
  onPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  onVolumeChange,
  onToggleMute,
  onClose,
  onExpand,
}: MiniPlayerProps) {
  if (!track) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
      {/* Progress bar at top */}
      <div
        className="h-1 bg-primary/20 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          onSeek(percent * duration);
        }}
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: progress + "%" }}
        />
      </div>

      <div className="flex items-center gap-4 px-4 py-3">
        {/* Track Info - clickable to expand */}
        <button
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          onClick={onExpand}
          aria-label="Open full player"
        >
          <AudioCover
            coverUrl={track.coverUrl}
            title={track.title}
            className="w-12 h-12 rounded-md flex-shrink-0"
            iconClassName="h-5 w-5"
          />

          <div className="min-w-0">
            <h4 className="font-medium truncate">{track.title}</h4>
            <p className="text-sm text-muted-foreground truncate">
              {track.artist || "Unknown Artist"}
            </p>
          </div>
        </button>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onSkipBack}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={isPlaying ? onPause : onPlay}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" fill="currentColor" />
            ) : (
              <Play className="h-5 w-5" fill="currentColor" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onSkipForward}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Time Display */}
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground min-w-[100px]">
          <span>{formatDuration(currentTime)}</span>
          <span>/</span>
          <span>{formatDuration(duration)}</span>
        </div>

        {/* Volume Control */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleMute}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            max={100}
            step={1}
            className="w-24"
            onValueChange={([v]) => onVolumeChange(v / 100)}
          />
        </div>

        {/* Expand Button - always visible */}
        {onExpand && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onExpand}
            aria-label="Expand player"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}

        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
