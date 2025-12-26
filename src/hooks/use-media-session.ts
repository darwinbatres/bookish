import { useEffect, useCallback } from "react";

interface UseMediaSessionOptions {
  /** Track title */
  title: string;
  /** Artist name */
  artist?: string;
  /** Album name */
  album?: string;
  /** Cover artwork URL */
  artwork?: string;
  /** Current playback position in seconds */
  position?: number;
  /** Total duration in seconds */
  duration?: number;
  /** Playback rate */
  playbackRate?: number;
  /** Whether currently playing */
  isPlaying?: boolean;
  /** Callback for play action */
  onPlay?: () => void;
  /** Callback for pause action */
  onPause?: () => void;
  /** Callback for previous track */
  onPreviousTrack?: () => void;
  /** Callback for next track */
  onNextTrack?: () => void;
  /** Callback for seek backward */
  onSeekBackward?: (seekOffset: number) => void;
  /** Callback for seek forward */
  onSeekForward?: (seekOffset: number) => void;
  /** Callback for seek to position */
  onSeekTo?: (seekTime: number) => void;
  /** Callback for stop */
  onStop?: () => void;
}

/**
 * Hook for integrating with the Media Session API
 * 
 * This enables:
 * - Lock screen controls on mobile
 * - Media keys on keyboards
 * - Picture-in-picture controls
 * - OS media widget integration (Windows, macOS)
 */
export function useMediaSession({
  title,
  artist,
  album,
  artwork,
  position = 0,
  duration = 0,
  playbackRate = 1,
  isPlaying = false,
  onPlay,
  onPause,
  onPreviousTrack,
  onNextTrack,
  onSeekBackward,
  onSeekForward,
  onSeekTo,
  onStop,
}: UseMediaSessionOptions) {
  
  // Check if Media Session API is available
  const isSupported = typeof navigator !== "undefined" && "mediaSession" in navigator;

  // Update metadata
  useEffect(() => {
    if (!isSupported) return;

    const artworkSources: MediaImage[] = [];
    if (artwork) {
      // Provide multiple sizes for different contexts
      artworkSources.push(
        { src: artwork, sizes: "96x96", type: "image/png" },
        { src: artwork, sizes: "128x128", type: "image/png" },
        { src: artwork, sizes: "192x192", type: "image/png" },
        { src: artwork, sizes: "256x256", type: "image/png" },
        { src: artwork, sizes: "384x384", type: "image/png" },
        { src: artwork, sizes: "512x512", type: "image/png" }
      );
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: artist || "Unknown Artist",
      album: album || "Bookish Audio",
      artwork: artworkSources,
    });
  }, [isSupported, title, artist, album, artwork]);

  // Update playback state
  useEffect(() => {
    if (!isSupported) return;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isSupported, isPlaying]);

  // Update position state for seeking UI
  const updatePositionState = useCallback(() => {
    if (!isSupported || !duration) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position: Math.min(position, duration),
      });
    } catch (error) {
      // Some browsers may not support setPositionState
      console.debug("[MediaSession] Position state not supported");
    }
  }, [isSupported, duration, playbackRate, position]);

  useEffect(() => {
    updatePositionState();
  }, [updatePositionState]);

  // Set up action handlers
  useEffect(() => {
    if (!isSupported) return;

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ["play", onPlay ? () => onPlay() : null],
      ["pause", onPause ? () => onPause() : null],
      ["previoustrack", onPreviousTrack ? () => onPreviousTrack() : null],
      ["nexttrack", onNextTrack ? () => onNextTrack() : null],
      [
        "seekbackward",
        onSeekBackward
          ? (details) => onSeekBackward(details.seekOffset || 10)
          : null,
      ],
      [
        "seekforward",
        onSeekForward
          ? (details) => onSeekForward(details.seekOffset || 10)
          : null,
      ],
      [
        "seekto",
        onSeekTo
          ? (details) => {
              if (details.seekTime !== undefined) {
                onSeekTo(details.seekTime);
              }
            }
          : null,
      ],
      ["stop", onStop ? () => onStop() : null],
    ];

    // Register handlers
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        // Some actions may not be supported in all browsers
        console.debug(`[MediaSession] Action "${action}" not supported`);
      }
    }

    // Cleanup
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [
    isSupported,
    onPlay,
    onPause,
    onPreviousTrack,
    onNextTrack,
    onSeekBackward,
    onSeekForward,
    onSeekTo,
    onStop,
  ]);

  return {
    isSupported,
    updatePositionState,
  };
}
