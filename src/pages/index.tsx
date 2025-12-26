import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import type { DBBook, DBCollection, DBAudioTrack } from "@/types";
import { formatDuration } from "@/types/audio";
import {
  fetchBook,
  checkAuth,
  logout,
  updateAudioTrack,
  getAudioStreamUrl,
  getDownloadUrl,
  addAudioBookmark,
} from "@/lib/api/client";
import { Sidebar, type ViewType } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { LibraryView } from "@/components/library-view";
import { ReaderView } from "@/components/reader-view";
import { StatsView } from "@/components/stats-view";
import { SettingsView } from "@/components/settings-view";
import { WishlistView } from "@/components/wishlist-view";
import { AudioLibraryView } from "@/components/audio-library-view";
import { MiniPlayer } from "@/components/mini-player";
import { FullPlayer } from "@/components/full-player";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useMediaSession } from "@/hooks/use-media-session";
import { useConfetti } from "@/hooks/use-confetti";
import { toast } from "sonner";

export default function Home() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewType>("library");
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [currentBook, setCurrentBook] = useState<DBBook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string>("");
  const [selectedCollection, setSelectedCollection] =
    useState<DBCollection | null>(null);
  // Track if we need to refresh library (for child component coordination)
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  // Audio player state
  const [currentTrack, setCurrentTrack] = useState<DBAudioTrack | null>(null);
  const [audioStreamUrl, setAudioStreamUrl] = useState<string | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  // Queue for auto-play next track
  const [audioQueue, setAudioQueue] = useState<DBAudioTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  // Track updates to propagate to AudioLibraryView (e.g., duration detected)
  const [trackUpdate, setTrackUpdate] = useState<DBAudioTrack | null>(null);

  // Refs for tracking save state (avoids closure issues and duplicate saves)
  const lastSavedPositionRef = useRef<number>(-1);
  const currentTrackRef = useRef<DBAudioTrack | null>(null);
  const audioQueueRef = useRef<DBAudioTrack[]>([]);
  const queueIndexRef = useRef<number>(-1);

  // Keep refs in sync
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    audioQueueRef.current = audioQueue;
    queueIndexRef.current = queueIndex;
  }, [audioQueue, queueIndex]);

  // Confetti celebration hook
  const { celebrate } = useConfetti();

  // Audio player hook
  const [playerState, playerControls] = useAudioPlayer({
    src: audioStreamUrl || undefined,
    autoPlay: !!audioStreamUrl, // Auto-play when we have a stream URL
    initialPosition: currentTrack?.currentPosition || 0,
    onTimeUpdate: (time) => {
      // Save position every 10 seconds, but only once per 10-second mark
      const roundedTime = Math.floor(time / 10) * 10;
      if (
        currentTrackRef.current &&
        roundedTime > 0 &&
        roundedTime !== lastSavedPositionRef.current
      ) {
        lastSavedPositionRef.current = roundedTime;
        updateAudioTrack(currentTrackRef.current.id, {
          currentPosition: Math.floor(time),
        }).catch(() => {});
      }
    },
    onEnded: () => {
      // Handle track completion with celebration
      if (currentTrackRef.current) {
        const track = currentTrackRef.current;
        updateAudioTrack(track.id, { completed: true })
          .then(() => {
            // Celebrate completion!
            celebrate();
            toast.success(`🎉 Completed: ${track.title}`);
          })
          .catch(() => {});
      }

      // Auto-play next track in queue (with delay for confetti enjoyment)
      const queue = audioQueueRef.current;
      const currentIdx = queueIndexRef.current;
      if (
        queue.length > 0 &&
        currentIdx >= 0 &&
        currentIdx < queue.length - 1
      ) {
        // Wait 3 seconds before playing next track to enjoy the confetti
        setTimeout(() => {
          const nextIdx = currentIdx + 1;
          const nextTrack = queue[nextIdx];
          // Reset save tracker for new track
          lastSavedPositionRef.current = -1;
          setQueueIndex(nextIdx);
          setCurrentTrack(nextTrack);
          // Get stream URL and play
          getAudioStreamUrl(nextTrack.s3Key)
            .then((streamUrl) => {
              setAudioStreamUrl(streamUrl);
            })
            .catch(() => {
              toast.error("Failed to play next track");
            });
        }, 3000); // 3 second delay to enjoy the confetti
      }
    },
    onDurationChange: (duration) => {
      // If we detect duration from streaming and the track has no duration saved, update it
      if (
        currentTrackRef.current &&
        duration > 0 &&
        (!currentTrackRef.current.durationSeconds ||
          currentTrackRef.current.durationSeconds === 0)
      ) {
        const track = currentTrackRef.current;
        const durationSeconds = Math.floor(duration);
        updateAudioTrack(track.id, { durationSeconds })
          .then(() => {
            // Update local track state to reflect the new duration
            const updatedTrack = { ...track, durationSeconds };
            setCurrentTrack(updatedTrack);
            // Also notify the library view to update its copy
            setTrackUpdate(updatedTrack);
            console.log(
              `[Player] Updated duration for track: ${durationSeconds}s`
            );
          })
          .catch(() => {});
      }
    },
    onPlayStateChange: (isPlaying) => {
      // Could trigger listening session tracking here
    },
  });

  // Media session for OS-level controls
  // Convert cover S3 key to signed URL for media session artwork
  useEffect(() => {
    if (!currentTrack?.coverUrl) {
      setArtworkUrl(null);
      return;
    }

    if (currentTrack.coverUrl.startsWith("audio-covers/")) {
      getDownloadUrl(currentTrack.coverUrl)
        .then(({ downloadUrl }) => setArtworkUrl(downloadUrl))
        .catch(() => setArtworkUrl(null));
    } else {
      // Already a full URL
      setArtworkUrl(currentTrack.coverUrl);
    }
  }, [currentTrack?.coverUrl]);

  useMediaSession({
    title: currentTrack?.title || "",
    artist: currentTrack?.artist,
    album: currentTrack?.album,
    artwork: artworkUrl || undefined,
    position: playerState.currentTime,
    duration: playerState.duration,
    playbackRate: playerState.playbackRate,
    isPlaying: playerState.isPlaying,
    onPlay: playerControls.play,
    onPause: playerControls.pause,
    onSeekBackward: (offset) => playerControls.skipBackward(offset),
    onSeekForward: (offset) => playerControls.skipForward(offset),
    onSeekTo: playerControls.seek,
  });

  const handlePlayTrack = useCallback(
    (
      track: DBAudioTrack,
      streamUrl: string,
      queue?: DBAudioTrack[],
      index?: number
    ) => {
      // Reset save tracker for new track
      lastSavedPositionRef.current = -1;
      setCurrentTrack(track);
      setAudioStreamUrl(streamUrl);
      // Set up queue for auto-play next
      if (queue && typeof index === "number") {
        setAudioQueue(queue);
        setQueueIndex(index);
      } else {
        // Single track, no queue
        setAudioQueue([track]);
        setQueueIndex(0);
      }
      // autoPlay is enabled, so audio will play when ready
    },
    []
  );

  // Skip to next/previous track in queue
  const handleSkipToNext = useCallback(async () => {
    if (queueIndex >= 0 && queueIndex < audioQueue.length - 1) {
      const nextIdx = queueIndex + 1;
      const nextTrack = audioQueue[nextIdx];
      lastSavedPositionRef.current = -1;
      setQueueIndex(nextIdx);
      setCurrentTrack(nextTrack);
      try {
        const streamUrl = await getAudioStreamUrl(nextTrack.s3Key);
        setAudioStreamUrl(streamUrl);
      } catch {
        toast.error("Failed to play next track");
      }
    }
  }, [audioQueue, queueIndex]);

  const handleSkipToPrevious = useCallback(async () => {
    if (queueIndex > 0) {
      const prevIdx = queueIndex - 1;
      const prevTrack = audioQueue[prevIdx];
      lastSavedPositionRef.current = -1;
      setQueueIndex(prevIdx);
      setCurrentTrack(prevTrack);
      try {
        const streamUrl = await getAudioStreamUrl(prevTrack.s3Key);
        setAudioStreamUrl(streamUrl);
      } catch {
        toast.error("Failed to play previous track");
      }
    }
  }, [audioQueue, queueIndex]);

  // Add bookmark at current position
  const handleAddBookmark = useCallback(async () => {
    if (!currentTrack) return;
    try {
      const position = Math.floor(playerState.currentTime);
      const label = `Bookmark at ${formatDuration(playerState.currentTime)}`;
      await addAudioBookmark(currentTrack.id, position, label);
      toast.success("Bookmark added");
    } catch {
      toast.error("Failed to add bookmark");
    }
  }, [currentTrack, playerState.currentTime]);

  const handleClosePlayer = useCallback(() => {
    playerControls.pause();
    if (currentTrackRef.current) {
      // Save final position
      updateAudioTrack(currentTrackRef.current.id, {
        currentPosition: Math.floor(playerState.currentTime),
      }).catch(() => {});
    }
    setCurrentTrack(null);
    setAudioStreamUrl(null);
    setShowFullPlayer(false);
  }, [playerState.currentTime, playerControls]);

  const handleToggleTrackFavorite = useCallback(async () => {
    if (!currentTrack) return;
    try {
      const updated = await updateAudioTrack(currentTrack.id, {
        isFavorite: !currentTrack.isFavorite,
      });
      setCurrentTrack(updated);
      setTrackUpdate(updated);
      toast.success(
        updated.isFavorite ? "Added to favorites" : "Removed from favorites"
      );
    } catch {
      toast.error("Failed to update favorite status");
    }
  }, [currentTrack]);

  // Check authentication on mount
  useEffect(() => {
    async function checkAuthentication() {
      try {
        const { authenticated, user } = await checkAuth();
        setIsAuthenticated(authenticated);
        if (user) setUsername(user.username);
        if (!authenticated) {
          router.replace("/login");
        }
      } catch {
        // Auth check failed - might be disabled
        setIsAuthenticated(true);
      }
    }
    checkAuthentication();
  }, [router]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  // Signal library to refresh (increment key triggers re-fetch in LibraryView)
  const triggerLibraryRefresh = useCallback(() => {
    setLibraryRefreshKey((k) => k + 1);
  }, []);

  const refreshCurrentBook = useCallback(async () => {
    if (!currentBookId) return;
    try {
      const book = await fetchBook(currentBookId);
      setCurrentBook(book);
    } catch (error) {
      console.error("[Bookish] Failed to fetch book:", error);
    }
  }, [currentBookId]);

  // Sync URL query param to state on mount and URL changes
  useEffect(() => {
    if (!router.isReady) return;

    const bookId = router.query.book as string | undefined;
    const view = router.query.view as string | undefined;

    if (bookId && bookId !== currentBookId) {
      setCurrentBookId(bookId);
    } else if (!bookId && currentBookId) {
      setCurrentBookId(null);
      setCurrentBook(null);
    }

    if (view === "stats" && activeView !== "stats") {
      setActiveView("stats");
    } else if (view === "settings" && activeView !== "settings") {
      setActiveView("settings");
    } else if (view === "wishlist" && activeView !== "wishlist") {
      setActiveView("wishlist");
    } else if (view === "favorites" && activeView !== "favorites") {
      setActiveView("favorites");
    } else if (view === "audio" && activeView !== "audio") {
      setActiveView("audio");
    } else if (!view && !bookId && activeView !== "library") {
      setActiveView("library");
    }
  }, [router.isReady, router.query.book, router.query.view]);

  useEffect(() => {
    // Initial load complete - LibraryView handles its own data fetching
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (currentBookId) {
      refreshCurrentBook();
    }
  }, [currentBookId, refreshCurrentBook]);

  const handleReadBook = useCallback(
    (book: DBBook) => {
      setCurrentBookId(book.id);
      setCurrentBook(book);
      // Update URL without full page reload
      router.push(`/?book=${book.id}`, undefined, { shallow: true });
    },
    [router]
  );

  const handleBackToLibrary = useCallback(() => {
    setCurrentBookId(null);
    setCurrentBook(null);
    triggerLibraryRefresh();
    // Clear URL query
    router.push("/", undefined, { shallow: true });
  }, [triggerLibraryRefresh, router]);

  // Nav view change handler (only for library/stats)
  const handleNavViewChange = useCallback(
    (view: ViewType) => {
      setActiveView(view);
      setCurrentBookId(null);
      setCurrentBook(null);
      // Update URL with view param
      if (view === "stats") {
        router.push("/?view=stats", undefined, { shallow: true });
      } else if (view === "settings") {
        router.push("/?view=settings", undefined, { shallow: true });
      } else if (view === "wishlist") {
        router.push("/?view=wishlist", undefined, { shallow: true });
      } else if (view === "favorites") {
        router.push("/?view=favorites", undefined, { shallow: true });
      } else if (view === "audio") {
        router.push("/?view=audio", undefined, { shallow: true });
      } else {
        router.push("/", undefined, { shallow: true });
      }
    },
    [router]
  );

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return (
      <>
        <Head>
          <title>Bookish - Personal Book Reader</title>
        </Head>
        <div className="flex items-center justify-center h-dvh bg-background">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </>
    );
  }

  // If not authenticated, show nothing (will redirect to login)
  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <>
        <Head>
          <title>Bookish - Personal Book Reader</title>
        </Head>
        <div className="flex flex-col lg:flex-row h-dvh overflow-hidden bg-background">
          <div className="hidden lg:flex shrink-0 w-52 xl:w-56 bg-sidebar border-r border-border" />
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="h-14 border-b border-border bg-card lg:hidden" />
            <main className="flex-1 overflow-auto min-h-0 p-4 sm:p-6 md:p-8">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-32" />
                <div className="h-24 bg-muted rounded-xl" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted rounded-xl" />
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      </>
    );
  }

  const renderContent = () => {
    // If we have a book selected, show the reader regardless of activeView
    if (currentBook) {
      return (
        <ReaderView
          currentBook={currentBook}
          onBackToLibrary={handleBackToLibrary}
          onBookUpdate={refreshCurrentBook}
        />
      );
    }

    switch (activeView) {
      case "stats":
        return <StatsView />;
      case "settings":
        return <SettingsView />;
      case "wishlist":
        return <WishlistView isFullPage />;
      case "favorites":
        return (
          <LibraryView
            books={[]}
            onReadBook={handleReadBook}
            onBooksChange={triggerLibraryRefresh}
            selectedCollectionId={selectedCollection?.id}
            refreshKey={libraryRefreshKey}
            favoritesOnly
          />
        );
      case "audio":
        return (
          <AudioLibraryView
            onPlayTrack={handlePlayTrack}
            currentTrackId={currentTrack?.id}
            isPlaying={playerState.isPlaying}
            onPause={playerControls.pause}
            onClosePlayer={handleClosePlayer}
            trackUpdate={trackUpdate}
          />
        );
      default:
        return (
          <LibraryView
            books={[]}
            onReadBook={handleReadBook}
            onBooksChange={triggerLibraryRefresh}
            selectedCollectionId={selectedCollection?.id}
            refreshKey={libraryRefreshKey}
          />
        );
    }
  };

  return (
    <>
      <Head>
        <title>
          {currentBook
            ? `${currentBook.title} | Bookish`
            : activeView === "stats"
              ? "Stats | Bookish"
              : activeView === "settings"
                ? "Settings | Bookish"
                : activeView === "wishlist"
                  ? "Wishlist | Bookish"
                  : activeView === "favorites"
                    ? "Favorites | Bookish"
                    : activeView === "audio"
                      ? "Audio | Bookish"
                      : "Bookish - Personal Book Reader"}
        </title>
      </Head>
      <div className="flex flex-col lg:flex-row h-dvh overflow-hidden bg-background">
        {/* Desktop sidebar - hidden when reading a book */}
        {!currentBook && (
          <div className="hidden lg:flex shrink-0">
            <Sidebar
              activeView={activeView}
              onViewChange={handleNavViewChange}
              username={username}
              onLogout={handleLogout}
              selectedCollection={selectedCollection}
              onSelectCollection={setSelectedCollection}
            />
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Mobile nav - hidden when reading a book */}
          {!currentBook && (
            <MobileNav
              activeView={activeView}
              onViewChange={handleNavViewChange}
              selectedCollection={selectedCollection}
              onSelectCollection={setSelectedCollection}
              onLogout={handleLogout}
            />
          )}

          <main id="main-content" className="flex-1 overflow-hidden min-h-0">
            {renderContent()}
          </main>

          {/* Audio mini player */}
          {currentTrack && audioStreamUrl && !showFullPlayer && (
            <MiniPlayer
              track={currentTrack}
              isPlaying={playerState.isPlaying}
              currentTime={playerState.currentTime}
              duration={playerState.duration}
              volume={playerState.volume}
              isMuted={playerState.isMuted}
              onPlay={playerControls.play}
              onPause={playerControls.pause}
              onSeek={playerControls.seek}
              onSkipBack={() => playerControls.skipBackward()}
              onSkipForward={() => playerControls.skipForward()}
              onVolumeChange={playerControls.setVolume}
              onToggleMute={playerControls.toggleMute}
              onClose={handleClosePlayer}
              onExpand={() => setShowFullPlayer(true)}
            />
          )}

          {/* Audio full-screen player */}
          {currentTrack && audioStreamUrl && showFullPlayer && (
            <FullPlayer
              track={currentTrack}
              isPlaying={playerState.isPlaying}
              currentTime={playerState.currentTime}
              duration={playerState.duration}
              volume={playerState.volume}
              isMuted={playerState.isMuted}
              playbackRate={playerState.playbackRate}
              onPlay={playerControls.play}
              onPause={playerControls.pause}
              onSeek={playerControls.seek}
              onSkipBack={() => playerControls.skipBackward()}
              onSkipForward={() => playerControls.skipForward()}
              onVolumeChange={playerControls.setVolume}
              onToggleMute={playerControls.toggleMute}
              onPlaybackRateChange={playerControls.setPlaybackRate}
              onClose={() => setShowFullPlayer(false)}
              onToggleFavorite={handleToggleTrackFavorite}
              onAddBookmark={handleAddBookmark}
              onSkipToNext={handleSkipToNext}
              onSkipToPrevious={handleSkipToPrevious}
              hasNext={queueIndex >= 0 && queueIndex < audioQueue.length - 1}
              hasPrevious={queueIndex > 0}
              queuePosition={
                audioQueue.length > 1
                  ? { current: queueIndex + 1, total: audioQueue.length }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
