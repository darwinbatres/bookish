import { useRef, useState, useCallback, useEffect } from "react";

export type RepeatMode = "none" | "one" | "all";

export interface AudioPlayerState {
  /** Is audio currently playing */
  isPlaying: boolean;
  /** Is audio currently loading/buffering */
  isLoading: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Volume (0-1) */
  volume: number;
  /** Is audio muted */
  isMuted: boolean;
  /** Playback rate (0.5-2.0) */
  playbackRate: number;
  /** Repeat mode */
  repeatMode: RepeatMode;
  /** Is shuffled */
  isShuffled: boolean;
  /** Error message if any */
  error: string | null;
}

export interface AudioPlayerControls {
  /** Play audio */
  play: () => void;
  /** Pause audio */
  pause: () => void;
  /** Toggle play/pause */
  togglePlay: () => void;
  /** Seek to position (seconds) */
  seek: (time: number) => void;
  /** Skip forward by seconds */
  skipForward: (seconds?: number) => void;
  /** Skip backward by seconds */
  skipBackward: (seconds?: number) => void;
  /** Set volume (0-1) */
  setVolume: (volume: number) => void;
  /** Toggle mute */
  toggleMute: () => void;
  /** Set playback rate */
  setPlaybackRate: (rate: number) => void;
  /** Cycle through repeat modes */
  cycleRepeatMode: () => void;
  /** Toggle shuffle */
  toggleShuffle: () => void;
  /** Load a new audio source */
  loadSource: (src: string) => void;
}

interface UseAudioPlayerOptions {
  /** Initial source URL */
  src?: string;
  /** Auto-play when loaded */
  autoPlay?: boolean;
  /** Initial position to seek to */
  initialPosition?: number;
  /** Callback when track ends */
  onEnded?: () => void;
  /** Callback when time updates */
  onTimeUpdate?: (time: number) => void;
  /** Callback when playback state changes */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** Callback when duration is detected (useful for updating DB if missing) */
  onDurationChange?: (duration: number) => void;
  /** Default skip duration in seconds */
  skipDuration?: number;
}

export function useAudioPlayer({
  src,
  autoPlay = false,
  initialPosition = 0,
  onEnded,
  onTimeUpdate,
  onPlayStateChange,
  onDurationChange,
  skipDuration = 15,
}: UseAudioPlayerOptions = {}): [
  AudioPlayerState,
  AudioPlayerControls,
  React.RefObject<HTMLAudioElement | null>,
] {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use refs for callbacks to avoid recreating the effect
  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlayStateChangeRef = useRef(onPlayStateChange);
  const onDurationChangeRef = useRef(onDurationChange);

  // Keep refs in sync with latest callbacks
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    onPlayStateChangeRef.current = onPlayStateChange;
  }, [onPlayStateChange]);

  useEffect(() => {
    onDurationChangeRef.current = onDurationChange;
  }, [onDurationChange]);

  useEffect(() => {
    onPlayStateChangeRef.current = onPlayStateChange;
  }, [onPlayStateChange]);

  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    repeatMode: "none",
    isShuffled: false,
    error: null,
  });

  // Track repeat mode in ref for event handler
  const repeatModeRef = useRef(state.repeatMode);
  useEffect(() => {
    repeatModeRef.current = state.repeatMode;
  }, [state.repeatMode]);

  // Use ref for initialPosition to avoid effect re-runs
  const initialPositionRef = useRef(initialPosition);

  useEffect(() => {
    initialPositionRef.current = initialPosition;
  }, [initialPosition]);

  // Update state helper
  const updateState = useCallback((updates: Partial<AudioPlayerState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Track if we should autoplay on load (set when src changes with autoPlay true)
  const shouldAutoPlayRef = useRef(false);
  const pendingSeekRef = useRef<number>(0);

  // Initialize audio element - ONLY depends on src
  useEffect(() => {
    // Capture autoPlay at the moment src changes
    shouldAutoPlayRef.current = autoPlay;
    pendingSeekRef.current = initialPositionRef.current;

    // Create a fresh audio element for each new source to avoid state issues
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }
    audioRef.current = new Audio();

    const audio = audioRef.current;

    const handleLoadStart = () => updateState({ isLoading: true, error: null });

    const handleLoadedMetadata = () => {
      // Seek to saved position once metadata is loaded (duration is known)
      if (pendingSeekRef.current > 0 && audio.duration > 0) {
        // Ensure we don't seek past the end
        const seekTo = Math.min(pendingSeekRef.current, audio.duration - 1);
        audio.currentTime = seekTo;
      }
    };

    const handleCanPlay = () => {
      updateState({ isLoading: false, duration: audio.duration || 0 });
      if (shouldAutoPlayRef.current) {
        audio.play().catch((err) => {
          console.warn("[AudioPlayer] Autoplay failed:", err);
        });
      }
    };
    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      updateState({ currentTime: time });
      onTimeUpdateRef.current?.(time);
    };
    const handlePlay = () => {
      updateState({ isPlaying: true });
      onPlayStateChangeRef.current?.(true);
    };
    const handlePause = () => {
      updateState({ isPlaying: false });
      onPlayStateChangeRef.current?.(false);
    };
    const handleEnded = () => {
      updateState({ isPlaying: false });
      onPlayStateChangeRef.current?.(false);

      if (repeatModeRef.current === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        onEndedRef.current?.();
      }
    };
    const handleError = () => {
      updateState({
        isLoading: false,
        error: "Failed to load audio file",
      });
    };
    const handleDurationChange = () => {
      const duration = audio.duration || 0;
      updateState({ duration });
      if (duration > 0) {
        onDurationChangeRef.current?.(duration);
      }
    };
    const handleVolumeChange = () => {
      updateState({
        volume: audio.volume,
        isMuted: audio.muted,
      });
    };
    const handleWaiting = () => updateState({ isLoading: true });
    const handlePlaying = () => updateState({ isLoading: false });

    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("volumechange", handleVolumeChange);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);

    // Load initial source
    if (src) {
      audio.src = src;
      audio.load();
    }

    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("volumechange", handleVolumeChange);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.pause();
    };
    // Note: autoPlay is captured at the start of the effect via shouldAutoPlayRef
    // We include it here so the closure captures the correct value when src changes
  }, [src, autoPlay, updateState]);

  // Controls
  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  const seek = useCallback(
    (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(
          0,
          Math.min(time, state.duration)
        );
      }
    },
    [state.duration]
  );

  const skipForward = useCallback(
    (seconds = skipDuration) => {
      seek(state.currentTime + seconds);
    },
    [state.currentTime, skipDuration, seek]
  );

  const skipBackward = useCallback(
    (seconds = skipDuration) => {
      seek(state.currentTime - seconds);
    },
    [state.currentTime, skipDuration, seek]
  );

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
      if (volume > 0) {
        audioRef.current.muted = false;
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
    }
  }, []);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (audioRef.current) {
        audioRef.current.playbackRate = Math.max(0.5, Math.min(2, rate));
        updateState({ playbackRate: audioRef.current.playbackRate });
      }
    },
    [updateState]
  );

  const cycleRepeatMode = useCallback(() => {
    const modes: RepeatMode[] = ["none", "one", "all"];
    const currentIndex = modes.indexOf(state.repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    updateState({ repeatMode: nextMode });
  }, [state.repeatMode, updateState]);

  const toggleShuffle = useCallback(() => {
    updateState({ isShuffled: !state.isShuffled });
  }, [state.isShuffled, updateState]);

  const loadSource = useCallback((newSrc: string) => {
    if (audioRef.current) {
      audioRef.current.src = newSrc;
      audioRef.current.load();
    }
  }, []);

  const controls: AudioPlayerControls = {
    play,
    pause,
    togglePlay,
    seek,
    skipForward,
    skipBackward,
    setVolume,
    toggleMute,
    setPlaybackRate,
    cycleRepeatMode,
    toggleShuffle,
    loadSource,
  };

  return [state, controls, audioRef];
}
