import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import type { DBBook, DBCollection } from "@/types";
import { fetchBook, checkAuth, logout } from "@/lib/api/client";
import { Sidebar, type ViewType } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { LibraryView } from "@/components/library-view";
import { ReaderView } from "@/components/reader-view";
import { StatsView } from "@/components/stats-view";
import { SettingsView } from "@/components/settings-view";
import { WishlistView } from "@/components/wishlist-view";

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
      console.error("[Shelf] Failed to fetch book:", error);
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
          <title>Shelf - Personal Book Reader</title>
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
          <title>Shelf - Personal Book Reader</title>
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
            ? `${currentBook.title} | Shelf`
            : activeView === "stats"
              ? "Stats | Shelf"
              : activeView === "settings"
                ? "Settings | Shelf"
                : activeView === "wishlist"
                  ? "Wishlist | Shelf"
                  : activeView === "favorites"
                    ? "Favorites | Shelf"
                    : "Shelf - Personal Book Reader"}
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
        </div>
      </div>
    </>
  );
}
