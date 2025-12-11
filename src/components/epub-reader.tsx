import { useState, useCallback, useRef, useEffect } from "react";
import type { DBBook, DBBookmark, DBNote } from "@/types";
import {
  updateBook,
  fetchBookmarks,
  addBookmark as apiAddBookmark,
  removeBookmark as apiRemoveBookmark,
  fetchNotes,
  createNote as apiCreateNote,
  deleteNote as apiDeleteNote,
  getDownloadUrl,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bookmark,
  StickyNote,
  PanelRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { NoteModal } from "./note-modal";
import { ReadingPanel } from "./reading-panel";

interface EpubReaderProps {
  book: DBBook;
  onBookUpdate: () => void;
  onBack: () => void;
}

export function EpubReader({ book, onBookUpdate, onBack }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);
  const totalLocationsRef = useRef(0);
  const currentCfiRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(book.currentPage || 1);
  const [totalPages, setTotalPages] = useState(book.totalPages || 100);
  const [fontSize, setFontSize] = useState(100); // percentage

  const [bookmarks, setBookmarks] = useState<DBBookmark[]>([]);
  const [notes, setNotes] = useState<DBNote[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [noteModal, setNoteModal] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    note?: DBNote;
  }>({ isOpen: false, mode: "create" });

  // Load bookmarks and notes
  useEffect(() => {
    const loadData = async () => {
      try {
        const [bookmarksData, notesData] = await Promise.all([
          fetchBookmarks(book.id),
          fetchNotes(book.id),
        ]);
        setBookmarks(bookmarksData);
        setNotes(notesData);
      } catch (err) {
        console.error("[EpubReader] Failed to load data:", err);
      }
    };
    loadData();
  }, [book.id]);

  // Initialize EPUB
  useEffect(() => {
    let mounted = true;
    const savedStartPage = book.currentPage || 1;

    const initEpub = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get download URL
        const { downloadUrl } = await getDownloadUrl(book.s3Key);

        // Dynamically import epubjs (avoid SSR issues)
        const ePub = (await import("epubjs")).default;

        if (!mounted) return;

        // Create book instance
        const epubBook = ePub(downloadUrl);
        bookRef.current = epubBook;

        // Wait for book to be ready
        await epubBook.ready;

        if (!mounted || !viewerRef.current) return;

        // Create rendition with allowScriptedContent for proper rendering
        const rendition = epubBook.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          spread: "none",
          flow: "paginated",
          allowScriptedContent: true,
        });

        renditionRef.current = rendition;

        // Hook into content to apply styles after iframe loads
        rendition.hooks.content.register((contents: any) => {
          // Apply font size to the iframe document directly
          const doc = contents.document;
          if (doc) {
            const style = doc.createElement("style");
            style.textContent = `
              body, p, div, span, a, li, td, th, h1, h2, h3, h4, h5, h6 {
                font-size: ${fontSize}% !important;
                line-height: 1.6 !important;
              }
            `;
            style.id = "custom-font-style";
            doc.head.appendChild(style);
          }
        });

        // Register a theme for initial setup
        rendition.themes.register("custom", {
          "body, p, div, span, a, li, td, th, h1, h2, h3, h4, h5, h6": {
            "font-size": `${fontSize}% !important`,
            "line-height": "1.6 !important",
          },
        });
        rendition.themes.select("custom");

        // Generate locations for pagination
        await epubBook.locations.generate(1024);

        if (!mounted) return;

        const total = epubBook.locations.length();
        totalLocationsRef.current = total;
        setTotalPages(total);

        // Set up location tracking
        rendition.on("relocated", (location: any) => {
          if (location?.start) {
            // Store current CFI for position restoration
            currentCfiRef.current = location.start.cfi;

            const currentLoc = epubBook.locations.locationFromCfi(
              location.start.cfi
            );
            if (typeof currentLoc === "number") {
              const page = Math.max(1, currentLoc + 1);
              setCurrentPage(page);
            }
          }
        });

        // Display at saved location or beginning
        if (savedStartPage > 1 && total > 0) {
          const targetLoc = Math.min(savedStartPage - 1, total - 1);
          const cfi = epubBook.locations.cfiFromLocation(targetLoc);
          if (cfi) {
            await rendition.display(cfi);
          } else {
            await rendition.display();
          }
        } else {
          await rendition.display();
        }

        setIsLoading(false);
      } catch (err) {
        console.error("[EpubReader] Failed to load EPUB:", err);
        if (mounted) {
          setError("Failed to load book. Please try again.");
          setIsLoading(false);
        }
      }
    };

    initEpub();

    return () => {
      mounted = false;
      if (renditionRef.current) {
        renditionRef.current.destroy();
      }
      if (bookRef.current) {
        bookRef.current.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.s3Key]);

  // Save progress when page changes
  useEffect(() => {
    if (currentPage > 0 && totalPages > 0 && !isLoading) {
      const timeout = setTimeout(async () => {
        try {
          await updateBook(book.id, { currentPage, totalPages });
          onBookUpdate();
        } catch (err) {
          console.error("[EpubReader] Failed to save progress:", err);
        }
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [currentPage, totalPages, isLoading, book.id, onBookUpdate]);

  // Navigation
  const goToPrev = useCallback(async () => {
    if (renditionRef.current) {
      await renditionRef.current.prev();
    }
  }, []);

  const goToNext = useCallback(async () => {
    if (renditionRef.current) {
      await renditionRef.current.next();
    }
  }, []);

  const goToPage = useCallback(async (page: number) => {
    if (bookRef.current && totalLocationsRef.current > 0) {
      const targetLoc = Math.min(page - 1, totalLocationsRef.current - 1);
      const cfi = bookRef.current.locations.cfiFromLocation(targetLoc);
      if (renditionRef.current && cfi) {
        await renditionRef.current.display(cfi);
      }
    }
  }, []);

  // Font size - update via iframe contents directly and maintain position
  const updateFontSize = useCallback(async (newSize: number) => {
    if (renditionRef.current) {
      // Save current position before changing font size
      const savedCfi = currentCfiRef.current;

      // Update via themes API
      renditionRef.current.themes.register("custom", {
        "body, p, div, span, a, li, td, th, h1, h2, h3, h4, h5, h6": {
          "font-size": `${newSize}% !important`,
          "line-height": "1.6 !important",
        },
      });
      renditionRef.current.themes.select("custom");

      // Also update the injected style in all iframes
      const contents = renditionRef.current.getContents();
      contents.forEach((content: any) => {
        const doc = content.document;
        if (doc) {
          const style = doc.getElementById("custom-font-style");
          if (style) {
            style.textContent = `
              body, p, div, span, a, li, td, th, h1, h2, h3, h4, h5, h6 {
                font-size: ${newSize}% !important;
                line-height: 1.6 !important;
              }
            `;
          }
        }
      });

      // Restore position after font size change
      if (savedCfi) {
        await renditionRef.current.display(savedCfi);
      }
    }
  }, []);

  const increaseFontSize = useCallback(async () => {
    const newSize = Math.min(fontSize + 10, 200);
    setFontSize(newSize);
    await updateFontSize(newSize);
  }, [fontSize, updateFontSize]);

  const decreaseFontSize = useCallback(async () => {
    const newSize = Math.max(fontSize - 10, 70);
    setFontSize(newSize);
    await updateFontSize(newSize);
  }, [fontSize, updateFontSize]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (noteModal.isOpen) return;
      if (e.key === "ArrowLeft") {
        goToPrev();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, noteModal.isOpen]);

  // Bookmarks
  const isCurrentPageBookmarked = bookmarks.some((b) => b.page === currentPage);

  const toggleBookmark = useCallback(async () => {
    const existingBookmark = bookmarks.find((b) => b.page === currentPage);

    if (existingBookmark) {
      try {
        await apiRemoveBookmark(book.id, existingBookmark.page);
        setBookmarks((prev) =>
          prev.filter((b) => b.id !== existingBookmark.id)
        );
        toast("Bookmark removed");
      } catch (err) {
        console.error("[EpubReader] Failed to remove bookmark:", err);
        toast("Failed to remove bookmark");
      }
    } else {
      try {
        const newBookmark = await apiAddBookmark(book.id, currentPage);
        setBookmarks((prev) => [...prev, newBookmark]);
        toast("Bookmark added");
      } catch (err) {
        console.error("[EpubReader] Failed to add bookmark:", err);
        toast("Failed to add bookmark");
      }
    }
  }, [book.id, currentPage, bookmarks]);

  // Remove bookmark by page (for ReadingPanel)
  const removeBookmark = useCallback(
    async (page: number) => {
      try {
        await apiRemoveBookmark(book.id, page);
        setBookmarks((prev) => prev.filter((b) => b.page !== page));
        toast("Bookmark removed");
      } catch (err) {
        console.error("[EpubReader] Failed to remove bookmark:", err);
        toast("Failed to remove bookmark");
      }
    },
    [book.id]
  );

  // Notes
  const openCreateNote = useCallback(() => {
    setNoteModal({ isOpen: true, mode: "create" });
  }, []);

  const handleSaveNote = useCallback(
    async (content: string) => {
      if (noteModal.mode === "create") {
        try {
          const newNote = await apiCreateNote(book.id, currentPage, content);
          setNotes((prev) => [...prev, newNote]);
          toast("Note created");
        } catch (err) {
          console.error("[EpubReader] Failed to create note:", err);
          toast("Failed to create note");
        }
      }
      setNoteModal({ isOpen: false, mode: "create" });
    },
    [book.id, currentPage, noteModal.mode]
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      try {
        await apiDeleteNote(book.id, noteId);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast("Note deleted");
      } catch (err) {
        console.error("[EpubReader] Failed to delete note:", err);
        toast("Failed to delete note");
      }
    },
    [book.id]
  );

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0 shrink-0"
              aria-label="Back to library"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <h1 className="font-semibold text-sm sm:text-base truncate">
              {book.title}
            </h1>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {/* Font size controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={decreaseFontSize}
              disabled={fontSize <= 70}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              aria-label="Decrease font size"
            >
              <Minus className="w-4 h-4" aria-hidden="true" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">
              {fontSize}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={increaseFontSize}
              disabled={fontSize >= 200}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              aria-label="Increase font size"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </Button>

            <div className="w-px h-5 bg-border mx-1" />

            <Button
              variant={isCurrentPageBookmarked ? "secondary" : "ghost"}
              size="icon"
              onClick={toggleBookmark}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              aria-label={
                isCurrentPageBookmarked ? "Remove bookmark" : "Add bookmark"
              }
            >
              <Bookmark
                className={`w-4 h-4 ${isCurrentPageBookmarked ? "fill-current" : ""}`}
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={openCreateNote}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              aria-label="Add note"
            >
              <StickyNote className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant={isPanelOpen ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              aria-label={isPanelOpen ? "Close panel" : "Open panel"}
            >
              <PanelRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* EPUB Viewer */}
        <div className="flex-1 min-h-0 relative bg-white">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading book...</p>
              </div>
            </div>
          )}
          <div ref={viewerRef} className="w-full h-full" />
        </div>

        {/* Navigation */}
        <div className="shrink-0 border-t border-border bg-card px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrev}
            disabled={isLoading}
            className="h-9 w-9 sm:h-8 sm:w-8 p-0"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </Button>

          <span className="text-xs text-muted-foreground min-w-16 text-center">
            {currentPage} / {totalPages || "..."}
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            disabled={isLoading}
            className="h-9 w-9 sm:h-8 sm:w-8 p-0"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Side panel */}
      <ReadingPanel
        bookmarks={bookmarks}
        notes={notes}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onGoToPage={goToPage}
        onRemoveBookmark={removeBookmark}
        onRemoveNote={handleDeleteNote}
      />

      {/* Note modal */}
      <NoteModal
        isOpen={noteModal.isOpen}
        currentPage={currentPage}
        onClose={() => setNoteModal({ isOpen: false, mode: "create" })}
        onSave={handleSaveNote}
      />
    </div>
  );
}
