import { useState, useEffect, useCallback } from "react";
import type { DBBook, LibraryViewMode, PaginatedResponse } from "@/types";
import { fetchBooksPaginated, deleteBook } from "@/lib/api/client";
import { BookUpload } from "./book-upload";
import { BookTable } from "./book-table";
import { DeleteConfirmationInfo } from "./delete-confirmation-info";
import {
  BookGrid,
  BookCards,
  BookCompact,
  SearchInput,
  ViewModeSwitcher,
  PaginationControls,
} from "./library";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface LibraryViewProps {
  books: DBBook[];
  onReadBook: (book: DBBook) => void;
  onBooksChange: () => void;
  selectedCollectionId?: string;
  /** Increment to trigger a refresh from parent */
  refreshKey?: number;
  /** Filter to show only favorite books */
  favoritesOnly?: boolean;
}

// Store view preference in localStorage
const VIEW_MODE_KEY = "bookish-library-view-mode";
const PAGE_SIZE_KEY = "bookish-library-page-size";

function getStoredViewMode(): LibraryViewMode {
  if (typeof window === "undefined") return "list";
  return (localStorage.getItem(VIEW_MODE_KEY) as LibraryViewMode) || "list";
}

function getStoredPageSize(): number {
  if (typeof window === "undefined") return 20;
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 20;
}

export function LibraryView({
  books: initialBooks,
  onReadBook,
  onBooksChange,
  selectedCollectionId,
  refreshKey,
  favoritesOnly,
}: LibraryViewProps) {
  // View state
  const [viewMode, setViewMode] = useState<LibraryViewMode>(getStoredViewMode);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(getStoredPageSize);
  const [paginatedData, setPaginatedData] =
    useState<PaginatedResponse<DBBook> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<DBBook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch paginated data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchBooksPaginated({
        page,
        limit,
        search: searchQuery || undefined,
        sortBy: "updatedAt",
        sortOrder: "desc",
        collectionId: selectedCollectionId,
        favoritesOnly,
      });
      setPaginatedData(result);
    } catch (error) {
      console.error("[Library] Failed to fetch books:", error);
      toast("Failed to load books", { description: "Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchQuery, selectedCollectionId, favoritesOnly]);

  // Fetch data on mount and when params change (including refreshKey from parent)
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Reset to page 1 when search or collection changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCollectionId]);

  // Persist view mode
  const handleViewModeChange = useCallback((mode: LibraryViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  // Persist page size
  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, String(newLimit));
  }, []);

  // Handle delete
  const handleDeleteClick = useCallback((book: DBBook) => {
    setDeleteTarget(book);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteBook(deleteTarget.id);
      toast("Book deleted", {
        description: `"${deleteTarget.title}" has been removed from your library.`,
      });
      onBooksChange();
      fetchData();
    } catch (error) {
      console.error("[Library] Failed to delete book:", error);
      toast("Failed to delete book", {
        description: "Please try again later.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onBooksChange, fetchData]);

  // Handle book added
  const handleBookAdded = useCallback(() => {
    onBooksChange();
    fetchData();
  }, [onBooksChange, fetchData]);

  // Get books to display
  const displayBooks = paginatedData?.data ?? initialBooks;
  const pagination = paginatedData?.pagination;

  // Render the appropriate view
  const renderBookView = () => {
    if (isLoading && !paginatedData) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    const fullViewProps = {
      books: displayBooks,
      onReadBook,
      onBooksChange: handleBookAdded,
    };

    switch (viewMode) {
      case "grid":
        return <BookGrid {...fullViewProps} />;
      case "cards":
        return <BookCards {...fullViewProps} />;
      case "compact":
        return <BookCompact {...fullViewProps} />;
      default:
        return (
          <BookTable
            books={displayBooks}
            onReadBook={onReadBook}
            onBooksChange={handleBookAdded}
          />
        );
    }
  };

  // Get display values
  const displayCount = pagination?.totalItems ?? displayBooks.length;
  const bookWord = displayCount === 1 ? "book" : "books";

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Library
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {displayCount} {bookWord}
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              </div>
            </div>

            {/* Search and view controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search books, authors, notes..."
              />
              <ViewModeSwitcher
                currentMode={viewMode}
                onChange={handleViewModeChange}
              />
            </div>
          </div>

          {/* Upload */}
          <div className="mb-6 sm:mb-8">
            <BookUpload onBookAdded={handleBookAdded} />
          </div>

          {/* Books view */}
          {renderBookView()}
        </div>
      </div>

      {/* Sticky Pagination Footer - always show so users can change page size */}
      {pagination && (
        <div className="shrink-0 border-t border-border bg-popover/80 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-3 safe-area-inset-bottom">
          <div className="max-w-6xl mx-auto">
            <PaginationControls
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              limit={pagination.limit}
              onPageChange={setPage}
              onLimitChange={handleLimitChange}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete book?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  This will permanently delete &ldquo;{deleteTarget?.title}
                  &rdquo; from your library and remove the file from storage.
                  This action cannot be undone.
                </p>
                {deleteTarget && (
                  <DeleteConfirmationInfo
                    itemType="book"
                    itemId={deleteTarget.id}
                    isFavorite={deleteTarget.isFavorite}
                  />
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
