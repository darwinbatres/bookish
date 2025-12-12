import { useState, useCallback, useRef, memo, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
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
  startReadingSession,
  endReadingSession,
  markBookCompleted,
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
  ZoomIn,
  ZoomOut,
  Loader2,
  Clock,
} from "lucide-react";
import { NoteModal } from "./note-modal";
import { ReadingPanel } from "./reading-panel";
import { useConfetti } from "@/hooks/use-confetti";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
  book: DBBook;
  onBookUpdate: () => void;
  onBack: () => void;
}

interface IsolatedPdfViewerProps {
  fileUrl: string;
  initialPage: number;
  targetPage?: number; // External page navigation request
  onPageChange: (page: number, total: number) => void;
  onTotalPagesLoaded?: (total: number) => void;
}

const IsolatedPdfViewer = memo(
  function IsolatedPdfViewer({
    fileUrl,
    initialPage,
    targetPage,
    onPageChange,
    onTotalPagesLoaded,
  }: IsolatedPdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState(initialPage);
    const [zoom, setZoom] = useState(1);
    const [loadError, setLoadError] = useState<string | null>(null);
    const loadedRef = useRef(false);
    const onPageChangeRef = useRef(onPageChange);
    const onTotalPagesLoadedRef = useRef(onTotalPagesLoaded);

    // Keep refs updated without triggering re-renders
    onPageChangeRef.current = onPageChange;
    onTotalPagesLoadedRef.current = onTotalPagesLoaded;

    // Respond to external page navigation requests
    useEffect(() => {
      if (
        targetPage !== undefined &&
        targetPage !== pageNumber &&
        targetPage >= 1 &&
        targetPage <= numPages
      ) {
        setPageNumber(targetPage);
      }
    }, [targetPage, numPages]);

    const handleLoadSuccess = useCallback(
      ({ numPages: total }: { numPages: number }) => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        setNumPages(total);
        onTotalPagesLoadedRef.current?.(total);
      },
      []
    );

    const handleLoadError = useCallback((error: Error) => {
      console.error("[Bookish] PDF load error:", error);
      setLoadError(error.message || "Failed to load PDF");
    }, []);

    // Notify parent of page changes (after initial mount)
    const isInitialMount = useRef(true);
    useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      if (numPages > 0) {
        onPageChangeRef.current(pageNumber, numPages);
      }
    }, [pageNumber, numPages]);

    const goToPrev = useCallback(() => {
      setPageNumber((p) => Math.max(1, p - 1));
    }, []);

    const goToNext = useCallback(() => {
      setPageNumber((p) => Math.min(numPages, p + 1));
    }, [numPages]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;

        if (e.key === "ArrowLeft" || e.key === "PageUp") {
          e.preventDefault();
          goToPrev();
        } else if (
          e.key === "ArrowRight" ||
          e.key === "PageDown" ||
          e.key === " "
        ) {
          e.preventDefault();
          goToNext();
        } else if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          setZoom((z) => Math.min(2, z + 0.25));
        } else if (e.key === "-") {
          e.preventDefault();
          setZoom((z) => Math.max(0.5, z - 0.25));
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goToPrev, goToNext]);

    const zoomIn = useCallback(() => setZoom((z) => Math.min(2, z + 0.25)), []);
    const zoomOut = useCallback(
      () => setZoom((z) => Math.max(0.5, z - 0.25)),
      []
    );

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-auto min-h-0 flex justify-center p-2 sm:p-4 bg-muted/30">
          <Document
            file={fileUrl}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={
              <div
                className="flex items-center justify-center h-64"
                role="status"
                aria-label="Loading PDF"
              >
                <div className="animate-pulse text-muted-foreground text-sm">
                  Loading PDF...
                </div>
              </div>
            }
            error={
              <div
                className="flex flex-col items-center justify-center h-64 text-destructive text-sm"
                role="alert"
              >
                <p className="font-medium">Failed to load PDF</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {loadError || "Please try again"}
                </p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={zoom}
              className="shadow-lg"
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={
                <div
                  className="flex items-center justify-center h-64"
                  role="status"
                >
                  <div className="animate-pulse text-muted-foreground text-sm">
                    Loading page...
                  </div>
                </div>
              }
            />
          </Document>
        </div>

        <div
          className="shrink-0 border-t border-border bg-card px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1 sm:gap-2"
          role="toolbar"
          aria-label="PDF navigation"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={zoomOut}
            disabled={zoom <= 0.5}
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" aria-hidden="true" />
          </Button>
          <span
            className="text-xs text-muted-foreground w-12 text-center"
            aria-label={`Zoom level: ${Math.round(zoom * 100)}%`}
          >
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={zoomIn}
            disabled={zoom >= 2}
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" aria-hidden="true" />
          </Button>

          <div className="h-4 w-px bg-border mx-2" aria-hidden="true" />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goToPrev}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-16 text-center">
            <span aria-live="polite">
              {pageNumber} / {numPages || "..."}
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goToNext}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.fileUrl === next.fileUrl &&
    prev.initialPage === next.initialPage &&
    prev.targetPage === next.targetPage
);

export function PdfReader({ book, onBookUpdate, onBack }: PdfReaderProps) {
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(book.currentPage);
  const [totalPages, setTotalPages] = useState(book.totalPages || 0);
  const [bookmarks, setBookmarks] = useState<DBBookmark[]>([]);
  const [notes, setNotes] = useState<DBNote[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);

  const bookIdRef = useRef(book.id);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartPageRef = useRef(book.currentPage);
  const hasCompletedRef = useRef(!!book.completedAt);
  const { celebrate } = useConfetti();

  // Format reading time
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Start reading session on mount
  useEffect(() => {
    async function startSession() {
      try {
        const session = await startReadingSession(book.id, book.currentPage);
        sessionIdRef.current = session.id;
        sessionStartPageRef.current = book.currentPage;
      } catch (error) {
        console.error("[Bookish] Failed to start reading session:", error);
      }
    }
    startSession();

    // End session on unmount
    return () => {
      if (sessionIdRef.current) {
        endReadingSession(book.id, sessionIdRef.current, currentPage).catch(
          (err) => console.error("[Bookish] Failed to end session:", err)
        );
      }
    };
  }, [book.id]);

  // Track session time
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check for book completion
  useEffect(() => {
    if (hasCompletedRef.current) return;
    if (totalPages > 0 && currentPage >= totalPages) {
      // User reached the last page!
      hasCompletedRef.current = true;
      celebrate();
      markBookCompleted(book.id)
        .then(() => {
          toast.success("🎉 Congratulations!", {
            description: `You finished reading "${book.title}"!`,
            duration: 5000,
          });
          onBookUpdate();
        })
        .catch((err) => console.error("[Bookish] Failed to mark complete:", err));
    }
  }, [currentPage, totalPages, book.id, book.title, celebrate, onBookUpdate]);

  // Fetch PDF URL from S3
  useEffect(() => {
    async function loadPdf() {
      try {
        setIsLoadingPdf(true);
        setLoadError(null);
        const { downloadUrl } = await getDownloadUrl(book.s3Key);
        setPdfUrl(downloadUrl);
      } catch (error) {
        console.error("[Bookish] Failed to get PDF URL:", error);
        setLoadError("Failed to load PDF. Please try again.");
      } finally {
        setIsLoadingPdf(false);
      }
    }
    loadPdf();
  }, [book.s3Key]);

  // Fetch bookmarks and notes
  const refreshBookmarks = useCallback(async () => {
    try {
      const data = await fetchBookmarks(bookIdRef.current);
      setBookmarks(data);
    } catch (error) {
      console.error("[Bookish] Failed to fetch bookmarks:", error);
    }
  }, []);

  const refreshNotes = useCallback(async () => {
    try {
      const data = await fetchNotes(bookIdRef.current);
      setNotes(data);
    } catch (error) {
      console.error("[Bookish] Failed to fetch notes:", error);
    }
  }, []);

  useEffect(() => {
    refreshBookmarks();
    refreshNotes();
  }, [refreshBookmarks, refreshNotes]);

  const handlePageChange = useCallback(async (page: number, total: number) => {
    setCurrentPage(page);
    if (total > 0) setTotalPages(total);
    try {
      await updateBook(bookIdRef.current, { currentPage: page });
    } catch (error) {
      console.error("[Bookish] Failed to update page:", error);
    }
  }, []);

  const handleTotalPagesLoaded = useCallback(
    async (total: number) => {
      setTotalPages(total);
      try {
        await updateBook(bookIdRef.current, { totalPages: total });
        onBookUpdate();
      } catch (error) {
        console.error("[Bookish] Failed to update total pages:", error);
      }
    },
    [onBookUpdate]
  );

  const toggleBookmark = useCallback(async () => {
    const isCurrentlyBookmarked = bookmarks.some((b) => b.page === currentPage);
    try {
      if (isCurrentlyBookmarked) {
        await apiRemoveBookmark(bookIdRef.current, currentPage);
        toast("Bookmark removed", { description: `Page ${currentPage}` });
      } else {
        await apiAddBookmark(bookIdRef.current, currentPage);
        toast("Bookmark added", { description: `Page ${currentPage}` });
      }
      await refreshBookmarks();
    } catch (error) {
      console.error("[Bookish] Failed to toggle bookmark:", error);
      toast("Failed to update bookmark");
    }
  }, [bookmarks, currentPage, refreshBookmarks]);

  const removeBookmark = useCallback(
    async (page: number) => {
      try {
        await apiRemoveBookmark(bookIdRef.current, page);
        await refreshBookmarks();
        toast("Bookmark removed", { description: `Page ${page}` });
      } catch (error) {
        console.error("[Bookish] Failed to remove bookmark:", error);
        toast("Failed to remove bookmark");
      }
    },
    [refreshBookmarks]
  );

  const addNote = useCallback(
    async (content: string) => {
      try {
        await apiCreateNote(bookIdRef.current, currentPage, content);
        await refreshNotes();
        toast("Note added", { description: `Page ${currentPage}` });
      } catch (error) {
        console.error("[Bookish] Failed to add note:", error);
        toast("Failed to add note");
      }
    },
    [currentPage, refreshNotes]
  );

  const removeNote = useCallback(
    async (noteId: string) => {
      try {
        await apiDeleteNote(bookIdRef.current, noteId);
        await refreshNotes();
        toast("Note deleted");
      } catch (error) {
        console.error("[Bookish] Failed to remove note:", error);
        toast("Failed to delete note");
      }
    },
    [refreshNotes]
  );

  const goToPage = useCallback(async (page: number) => {
    setCurrentPage(page);
    try {
      await updateBook(bookIdRef.current, { currentPage: page });
    } catch (error) {
      console.error("[Bookish] Failed to update page:", error);
    }
  }, []);

  const isBookmarked = bookmarks.some((b) => b.page === currentPage);

  if (isLoadingPdf) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !pdfUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-destructive text-sm">
          {loadError || "Failed to load PDF"}
        </p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 relative">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="border-b border-border px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0 shrink-0"
              aria-label="Back to library"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <div
              className="h-4 w-px bg-border hidden sm:block"
              aria-hidden="true"
            />
            <h1 className="font-semibold text-xs sm:text-sm truncate min-w-0">
              {book.title}
            </h1>
            {/* Session timer */}
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span>{formatTime(sessionTime)}</span>
            </div>
          </div>

          <div
            className="flex items-center gap-0.5 sm:gap-1 shrink-0"
            role="toolbar"
            aria-label="Reading tools"
          >
            <Button
              variant={isBookmarked ? "secondary" : "ghost"}
              size="sm"
              onClick={toggleBookmark}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              aria-pressed={isBookmarked}
            >
              <Bookmark
                className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`}
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNoteModalOpen(true)}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              aria-label="Add note"
            >
              <StickyNote className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant={isPanelOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="h-9 w-9 sm:h-8 sm:w-8 p-0"
              aria-label={
                isPanelOpen ? "Close notes panel" : "Open notes panel"
              }
              aria-expanded={isPanelOpen}
            >
              <PanelRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {book.format === "pdf" && pdfUrl ? (
            <IsolatedPdfViewer
              fileUrl={pdfUrl}
              initialPage={currentPage}
              targetPage={currentPage}
              onPageChange={handlePageChange}
              onTotalPagesLoaded={handleTotalPagesLoaded}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground px-4 h-full">
              <div className="text-center">
                <p className="text-sm font-medium mb-1">
                  {book.format.toUpperCase()} reader coming soon
                </p>
                <p className="text-xs opacity-70">PDF is fully supported</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ReadingPanel
        bookmarks={bookmarks}
        notes={notes}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onGoToPage={goToPage}
        onRemoveBookmark={removeBookmark}
        onRemoveNote={removeNote}
      />

      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSave={addNote}
        currentPage={currentPage}
      />
    </div>
  );
}
