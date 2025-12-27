import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ChevronDown,
  Heart,
  ListMusic,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AudioCover } from "@/components/audio-cover";
import { cn } from "@/lib/utils";
import type { DBAudioTrack } from "@/types";
import { formatDuration } from "@/types/audio";

interface FullPlayerProps {
  track: DBAudioTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onClose: () => void;
  onToggleFavorite?: () => void;
  onAddBookmark?: () => void;
  // Queue navigation
  onSkipToNext?: () => void;
  onSkipToPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  queuePosition?: { current: number; total: number };
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function FullPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  onPlay,
  onPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onClose,
  onToggleFavorite,
  onAddBookmark,
  onSkipToNext,
  onSkipToPrevious,
  hasNext = false,
  hasPrevious = false,
  queuePosition,
}: FullPlayerProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (isPlaying) {
            onPause();
          } else {
            onPlay();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          onSkipBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          onSkipForward();
          break;
        case "ArrowUp":
          e.preventDefault();
          onVolumeChange(Math.min(1, volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          onVolumeChange(Math.max(0, volume - 0.1));
          break;
        case "m":
          e.preventDefault();
          onToggleMute();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isPlaying,
    volume,
    onPlay,
    onPause,
    onSkipBack,
    onSkipForward,
    onVolumeChange,
    onToggleMute,
    onClose,
  ]);

  const cyclePlaybackRate = () => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    onPlaybackRateChange(PLAYBACK_RATES[nextIndex]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:py-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={onClose}
          aria-label="Close full player"
        >
          <ChevronDown className="h-6 w-6" />
        </Button>

        <div className="text-center flex-1 px-4">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wide">
            {queuePosition
              ? `${queuePosition.current} of ${queuePosition.total}`
              : "Now Playing"}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              aria-label="More options"
            >
              <ListMusic className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onAddBookmark && (
              <DropdownMenuItem onClick={onAddBookmark}>
                <Bookmark className="h-4 w-4 mr-2" />
                Add Bookmark
              </DropdownMenuItem>
            )}
            {onToggleFavorite && (
              <DropdownMenuItem onClick={onToggleFavorite}>
                <Heart
                  className={cn(
                    "h-4 w-4 mr-2",
                    track.isFavorite && "fill-red-500 text-red-500"
                  )}
                />
                {track.isFavorite ? "Remove Favorite" : "Add to Favorites"}
              </DropdownMenuItem>
            )}
            {(onAddBookmark || onToggleFavorite) &&
              (hasPrevious || hasNext) && <DropdownMenuSeparator />}
            {hasPrevious && onSkipToPrevious && (
              <DropdownMenuItem onClick={onSkipToPrevious}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous Track
              </DropdownMenuItem>
            )}
            {hasNext && onSkipToNext && (
              <DropdownMenuItem onClick={onSkipToNext}>
                <ChevronRight className="h-4 w-4 mr-2" />
                Next Track
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Cover Art - Takes up available space on mobile */}
      <div className="flex-1 flex items-center justify-center px-8 sm:px-12 py-4 min-h-0">
        <div className="w-full max-w-[min(80vw,400px)] aspect-square">
          <AudioCover
            coverUrl={track.coverUrl}
            title={track.title}
            className="w-full h-full rounded-2xl shadow-2xl"
            iconClassName="h-24 w-24 sm:h-32 sm:w-32"
          />
        </div>
      </div>

      {/* Track Info & Controls */}
      <div className="px-6 sm:px-8 pb-8 sm:pb-10 space-y-6">
        {/* Track Info */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {track.title}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground truncate">
              {track.artist || "Unknown Artist"}
            </p>
            {track.album && (
              <p className="text-sm text-muted-foreground/70 truncate mt-0.5">
                {track.album}
              </p>
            )}
          </div>

          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={onToggleFavorite}
              aria-label={
                track.isFavorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              <Heart
                className={cn(
                  "h-6 w-6 transition-colors",
                  track.isFavorite
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground hover:text-red-500"
                )}
              />
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            className="w-full cursor-pointer"
            onValueChange={([value]) => {
              const newTime = (value / 100) * duration;
              onSeek(newTime);
            }}
            aria-label="Seek"
          />
          <div className="flex justify-between text-xs sm:text-sm text-muted-foreground tabular-nums">
            <span>{formatDuration(currentTime)}</span>
            <span>-{formatDuration(Math.max(0, duration - currentTime))}</span>
          </div>
        </div>

        {/* Main Playback Controls */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {/* Previous Track / Skip Back */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-12 w-12 sm:h-14 sm:w-14",
              hasPrevious && "text-foreground",
              !hasPrevious && "text-muted-foreground"
            )}
            onClick={
              hasPrevious && onSkipToPrevious ? onSkipToPrevious : onSkipBack
            }
            aria-label={hasPrevious ? "Previous track" : "Skip back 10 seconds"}
          >
            <SkipBack className="h-6 w-6 sm:h-7 sm:w-7" />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="default"
            size="icon"
            className="h-16 w-16 sm:h-18 sm:w-18 rounded-full shadow-lg"
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7 sm:h-8 sm:w-8" fill="currentColor" />
            ) : (
              <Play
                className="h-7 w-7 sm:h-8 sm:w-8 ml-1"
                fill="currentColor"
              />
            )}
          </Button>

          {/* Next Track / Skip Forward */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-12 w-12 sm:h-14 sm:w-14",
              hasNext && "text-foreground",
              !hasNext && "text-muted-foreground"
            )}
            onClick={hasNext && onSkipToNext ? onSkipToNext : onSkipForward}
            aria-label={hasNext ? "Next track" : "Skip forward 30 seconds"}
          >
            <SkipForward className="h-6 w-6 sm:h-7 sm:w-7" />
          </Button>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center justify-between">
          {/* Playback Speed */}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs sm:text-sm font-medium h-8 px-2"
            onClick={cyclePlaybackRate}
            aria-label={`Playback speed: ${playbackRate}x`}
          >
            {playbackRate}x
          </Button>

          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                showVolumeSlider ? "w-24 opacity-100" : "w-0 opacity-0"
              )}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                className="w-24"
                onValueChange={([v]) => onVolumeChange(v / 100)}
                aria-label="Volume"
              />
            </div>
          </div>

          {/* Mobile Volume Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:hidden"
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          {/* Bookmark (for audiobooks/podcasts) */}
          {onAddBookmark && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onAddBookmark}
              aria-label="Add bookmark"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          )}

          {/* Queue info - shows position if available */}
          {queuePosition && queuePosition.total > 1 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {queuePosition.current}/{queuePosition.total}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
