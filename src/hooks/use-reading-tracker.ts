import { useEffect, useRef, useCallback, useState } from "react";

interface UseReadingTrackerOptions {
  /** Book ID for the reading session */
  bookId: string;
  /** Starting page number */
  startPage: number;
  /** Callback to start a session */
  onStartSession: (bookId: string, startPage: number) => Promise<{ id: string }>;
  /** Callback to end a session */
  onEndSession: (
    bookId: string,
    sessionId: string,
    endPage: number,
    durationSeconds: number
  ) => Promise<void>;
  /** Callback when session time updates (for UI display) */
  onTimeUpdate?: (seconds: number) => void;
  /** Minimum session duration to save (in seconds) - default 5 */
  minSessionDuration?: number;
}

interface ReadingTrackerState {
  /** Current session ID */
  sessionId: string | null;
  /** Total time in current session (seconds) */
  sessionTime: number;
  /** Whether the user is actively reading (tab visible & focused) */
  isActive: boolean;
}

/**
 * Hook for tracking reading time with visibility-based accuracy
 * 
 * Handles:
 * - Tab visibility (pauses when tab hidden)
 * - Window focus (pauses when window unfocused)
 * - Mobile-friendly (handles page lifecycle events)
 * - Automatic session persistence on unmount/close
 */
export function useReadingTracker({
  bookId,
  startPage,
  onStartSession,
  onEndSession,
  onTimeUpdate,
  minSessionDuration = 5,
}: UseReadingTrackerOptions): ReadingTrackerState & {
  endSession: (endPage: number) => Promise<void>;
} {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Refs for values we need in event handlers
  const sessionIdRef = useRef<string | null>(null);
  const sessionTimeRef = useRef(0);
  const currentPageRef = useRef(startPage);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const hasEndedRef = useRef(false);

  // Start tracking interval
  const startTracking = useCallback(() => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current && sessionIdRef.current) {
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
  const endSession = useCallback(async (endPage: number) => {
    if (hasEndedRef.current || !sessionIdRef.current) return;
    hasEndedRef.current = true;
    stopTracking();

    // Only save if we have meaningful reading time
    if (sessionTimeRef.current >= minSessionDuration) {
      try {
        await onEndSession(
          bookId,
          sessionIdRef.current,
          endPage,
          sessionTimeRef.current
        );
      } catch (error) {
        console.error("[ReadingTracker] Failed to end session:", error);
      }
    }
  }, [bookId, onEndSession, stopTracking, minSessionDuration]);

  // Handle visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      isActiveRef.current = isVisible;
      setIsActive(isVisible);
    };

    const handleFocus = () => {
      isActiveRef.current = true;
      setIsActive(true);
    };

    const handleBlur = () => {
      isActiveRef.current = false;
      setIsActive(false);
    };

    // Handle page unload (mobile-friendly)
    const handleBeforeUnload = () => {
      endSession(currentPageRef.current);
    };

    // Handle mobile page hide (more reliable on mobile)
    const handlePageHide = () => {
      endSession(currentPageRef.current);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [endSession]);

  // Start session on mount
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const session = await onStartSession(bookId, startPage);
        if (mounted) {
          sessionIdRef.current = session.id;
          setSessionId(session.id);
          startTracking();
        }
      } catch (error) {
        console.error("[ReadingTracker] Failed to start session:", error);
      }
    }

    initSession();

    // Cleanup on unmount
    return () => {
      mounted = false;
      endSession(currentPageRef.current);
    };
  }, [bookId, startPage, onStartSession, startTracking, endSession]);

  // Update current page ref when it changes (for session end)
  const updateCurrentPage = useCallback((page: number) => {
    currentPageRef.current = page;
  }, []);

  return {
    sessionId,
    sessionTime,
    isActive,
    endSession,
    // Expose method to update current page
    ...{ updateCurrentPage } as any,
  };
}

/**
 * Format reading time in human-readable format
 */
export function formatReadingTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
