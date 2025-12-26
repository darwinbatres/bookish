import { useEffect, useRef, useCallback, useState } from "react";

interface UseListeningTrackerOptions {
  /** Track ID for the listening session */
  trackId: string;
  /** Starting position in seconds */
  startPosition: number;
  /** Callback to start a session */
  onStartSession: (trackId: string, startPosition: number) => Promise<{ id: string }>;
  /** Callback to end a session */
  onEndSession: (
    trackId: string,
    sessionId: string,
    endPosition: number,
    durationSeconds: number
  ) => Promise<void>;
  /** Callback when session time updates (for UI display) */
  onTimeUpdate?: (seconds: number) => void;
  /** Minimum session duration to save (in seconds) - default 5 */
  minSessionDuration?: number;
}

interface ListeningTrackerState {
  /** Current session ID */
  sessionId: string | null;
  /** Total time in current session (seconds) */
  sessionTime: number;
  /** Whether the user is actively listening */
  isActive: boolean;
}

/**
 * Hook for tracking listening time with audio-specific handling
 * 
 * Handles:
 * - Audio playback state (pauses when audio paused)
 * - Tab visibility (for background audio support)
 * - Mobile-friendly (handles page lifecycle events)
 * - Automatic session persistence on unmount/close
 */
export function useListeningTracker({
  trackId,
  startPosition,
  onStartSession,
  onEndSession,
  onTimeUpdate,
  minSessionDuration = 5,
}: UseListeningTrackerOptions): ListeningTrackerState & {
  endSession: (endPosition: number) => Promise<void>;
  updatePosition: (position: number) => void;
  setPlaying: (playing: boolean) => void;
} {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Refs for values we need in event handlers
  const sessionIdRef = useRef<string | null>(null);
  const sessionTimeRef = useRef(0);
  const currentPositionRef = useRef(startPosition);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);
  const hasEndedRef = useRef(false);

  // Start tracking interval
  const startTracking = useCallback(() => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      if (isPlayingRef.current && sessionIdRef.current) {
        sessionTimeRef.current += 1;
        setSessionTime(sessionTimeRef.current);
        onTimeUpdate?.(sessionTimeRef.current);
      }
    }, 1000);
  }, [onTimeUpdate]);

  // Stop tracking interval
  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // End the session (can be called manually or automatically)
  const endSession = useCallback(async (endPosition: number) => {
    if (hasEndedRef.current || !sessionIdRef.current) return;
    hasEndedRef.current = true;
    stopTracking();

    // Only save if we have meaningful listening time
    if (sessionTimeRef.current >= minSessionDuration) {
      try {
        await onEndSession(
          trackId,
          sessionIdRef.current,
          endPosition,
          sessionTimeRef.current
        );
      } catch (error) {
        console.error("[ListeningTracker] Failed to end session:", error);
      }
    }
  }, [trackId, onEndSession, stopTracking, minSessionDuration]);

  // Update current position
  const updatePosition = useCallback((position: number) => {
    currentPositionRef.current = position;
  }, []);

  // Handle play/pause state
  const setPlaying = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    setIsActive(playing);
  }, []);

  // Handle page unload/hide
  useEffect(() => {
    const handleBeforeUnload = () => {
      endSession(currentPositionRef.current);
    };

    const handlePageHide = () => {
      endSession(currentPositionRef.current);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [endSession]);

  // Start session on mount
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const session = await onStartSession(trackId, startPosition);
        if (mounted) {
          sessionIdRef.current = session.id;
          setSessionId(session.id);
          startTracking();
        }
      } catch (error) {
        console.error("[ListeningTracker] Failed to start session:", error);
      }
    }

    initSession();

    // Cleanup on unmount
    return () => {
      mounted = false;
      endSession(currentPositionRef.current);
    };
  }, [trackId, startPosition, onStartSession, startTracking, endSession]);

  return {
    sessionId,
    sessionTime,
    isActive,
    endSession,
    updatePosition,
    setPlaying,
  };
}

/**
 * Format listening time in human-readable format
 */
export function formatListeningTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Format audio duration as MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}
