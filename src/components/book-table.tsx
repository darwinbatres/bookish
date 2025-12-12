import type { DBBook, DBCollection } from "@/types";
import {
  deleteBook,
  addBookToCollection,
  fetchCollections,
  getDownloadUrl,
  toggleBookFavorite,
} from "@/lib/api/client";
import { BookCover } from "./book-cover";
import { EditBookModal } from "./edit-book-modal";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trash2,
  BookOpen,
  StickyNote,
  Bookmark,
  HardDrive,
  MoreVertical,
  FolderInput,
  Folder,
  Check,
  Download,
  Pencil,
  Star,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BookTableProps {
  books: DBBook[];
  onReadBook: (book: DBBook) => void;
  onBooksChange: () => void;
}

function calculateProgress(currentPage: number, totalPages?: number): number {
  if (!totalPages || totalPages === 0) return 0;
  return Math.round((currentPage / totalPages) * 100);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function BookTable({
  books,
  onReadBook,
  onBooksChange,
}: BookTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<DBBook | null>(null);
  const [editTarget, setEditTarget] = useState<DBBook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [collections, setCollections] = useState<DBCollection[]>([]);

  // Fetch collections for the dropdown
  const loadCollections = useCallback(() => {
    fetchCollections()
      .then(setCollections)
      .catch((err) =>
        console.error("[BookTable] Failed to load collections:", err)
      );
  }, []);

  // Initial load
  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleMoveToCollection = useCallback(
    async (bookId: string, collectionId: string | null, bookTitle: string) => {
      try {
        await addBookToCollection(bookId, collectionId);
        const collectionName = collectionId
          ? collections.find((c) => c.id === collectionId)?.name || "collection"
          : "All Books";
        toast.success(`Moved to ${collectionName}`, {
          description: `"${bookTitle}" has been moved.`,
        });
        onBooksChange();
      } catch (error) {
        console.error("[BookTable] Failed to move book:", error);
        toast.error("Failed to move book");
      }
    },
    [collections, onBooksChange]
  );

  const handleToggleFavorite = useCallback(
    async (book: DBBook) => {
      try {
        const newState = !book.isFavorite;
        await toggleBookFavorite(book.id, newState);
        toast.success(
          newState ? "Added to favorites" : "Removed from favorites",
          {
            description: `"${book.title}" has been ${newState ? "added to" : "removed from"} favorites.`,
          }
        );
        onBooksChange();
      } catch (error) {
        console.error("[BookTable] Failed to toggle favorite:", error);
        toast.error("Failed to update favorite status");
      }
    },
    [onBooksChange]
  );

  const handleDownloadBook = useCallback(async (book: DBBook) => {
    try {
      if (!book.s3Key) {
        toast.error("Download unavailable", {
          description: "This book has no file associated with it.",
        });
        return;
      }

      toast.info("Preparing download...");

      const { downloadUrl } = await getDownloadUrl(book.s3Key);

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      // Use title + format as filename (sanitize title for safe filename)
      const safeTitle = book.title.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
      link.download = `${safeTitle}.${book.format}`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Download started", {
        description: `"${book.title}" is downloading.`,
      });
    } catch (error) {
      console.error("[BookTable] Failed to download book:", error);
      toast.error("Download failed", {
        description: "Please try again later.",
      });
    }
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
    } catch (error) {
      console.error("[Bookish] Failed to delete book:", error);
      toast("Failed to delete book", {
        description: "Please try again later.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onBooksChange]);

  if (books.length === 0) {
    return (
      <div
        className="text-center py-12 sm:py-16 text-muted-foreground"
        role="status"
      >
        <BookOpen
          className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 opacity-30"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">No books yet</p>
        <p className="text-xs mt-1 opacity-70">
          Upload your first book to get started
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-2 sm:space-y-3"
      role="list"
      aria-label="Books in your library"
    >
      {books.map((book) => {
        const progress = calculateProgress(book.currentPage, book.totalPages);

        return (
          <article
            key={book.id}
            role="listitem"
            className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-border hover:border-muted-foreground/30 active:bg-secondary/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            onClick={() => onReadBook(book)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onReadBook(book);
              }
            }}
            tabIndex={0}
          >
            {/* Cover thumbnail */}
            <BookCover
              coverUrl={book.coverUrl}
              format={book.format}
              title={book.title}
              className="w-12 h-16 rounded-lg shrink-0 hidden sm:flex"
              iconClassName="w-5 h-5"
            />
            {/* Book info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate pr-2 flex items-center gap-1.5">
                {book.isFavorite && (
                  <Star
                    className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0"
                    aria-label="Favorite"
                  />
                )}
                <span className="truncate">{book.title}</span>
              </h3>
              {book.author && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {book.author}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                <span className="text-xs text-muted-foreground uppercase font-medium">
                  {book.format}
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-xs text-muted-foreground">
                  {book.totalPages && book.totalPages > 0
                    ? `${book.currentPage} / ${book.totalPages} pages`
                    : "Open to load pages"}
                </span>
                <span className="hidden sm:inline text-muted-foreground/40">
                  •
                </span>
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <HardDrive className="w-3 h-3" aria-hidden="true" />
                  {formatBytes(book.fileSize)}
                </span>
                {(book.notesCount ?? 0) > 0 && (
                  <>
                    <span className="hidden sm:inline text-muted-foreground/40">
                      •
                    </span>
                    <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                      <StickyNote className="w-3 h-3" aria-hidden="true" />
                      {book.notesCount}{" "}
                      {book.notesCount === 1 ? "note" : "notes"}
                    </span>
                  </>
                )}
                {(book.bookmarksCount ?? 0) > 0 && (
                  <>
                    <span className="hidden sm:inline text-muted-foreground/40">
                      •
                    </span>
                    <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                      <Bookmark className="w-3 h-3" aria-hidden="true" />
                      {book.bookmarksCount}
                    </span>
                  </>
                )}
              </div>
              {/* Mobile-only metadata row */}
              <div className="flex sm:hidden items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatBytes(book.fileSize)}
                </span>
                {(book.notesCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <StickyNote className="w-3 h-3" />
                    {book.notesCount}
                  </span>
                )}
                {(book.bookmarksCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Bookmark className="w-3 h-3" />
                    {book.bookmarksCount}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              {/* Progress bar */}
              <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-initial sm:w-32">
                <div
                  className="flex-1 sm:flex-initial sm:w-20 h-1.5 sm:h-1 bg-secondary rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Reading progress: ${progress}%`}
                >
                  <div
                    className="h-full bg-foreground/70 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground w-8 text-right">
                  {progress}%
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReadBook(book);
                  }}
                  className="h-9 sm:h-8 px-4 sm:px-3 text-xs font-semibold"
                >
                  Read
                </Button>

                {/* More actions dropdown */}
                <DropdownMenu
                  onOpenChange={(open) => open && loadCollections()}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => e.stopPropagation()}
                      className="h-9 sm:h-8 w-9 sm:w-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                      aria-label={`More options for ${book.title}`}
                    >
                      <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderInput className="w-4 h-4 mr-2" />
                        Move to Collection
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onClick={() =>
                            handleMoveToCollection(book.id, null, book.title)
                          }
                        >
                          <Folder className="w-4 h-4 mr-2" />
                          <span className="flex-1">
                            All Books (No Collection)
                          </span>
                          {!book.collectionId && (
                            <Check className="w-4 h-4 ml-2 text-primary" />
                          )}
                        </DropdownMenuItem>
                        {collections.length > 0 && <DropdownMenuSeparator />}
                        {collections.map((collection) => (
                          <DropdownMenuItem
                            key={collection.id}
                            onClick={() =>
                              handleMoveToCollection(
                                book.id,
                                collection.id,
                                book.title
                              )
                            }
                          >
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: collection.color }}
                            />
                            <span className="flex-1">{collection.name}</span>
                            {book.collectionId === collection.id && (
                              <Check className="w-4 h-4 ml-2 text-primary" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={() => setEditTarget(book)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Book
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleToggleFavorite(book)}
                    >
                      <Star
                        className={cn(
                          "w-4 h-4 mr-2",
                          book.isFavorite && "fill-current text-amber-500"
                        )}
                      />
                      {book.isFavorite
                        ? "Remove from Favorites"
                        : "Add to Favorites"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownloadBook(book)}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Book
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteTarget(book)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Book
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </article>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete book?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title}&rdquo;
              from your library and remove the file from storage. This action
              cannot be undone.
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

      {/* Edit Book Modal */}
      <EditBookModal
        book={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onBookUpdated={onBooksChange}
      />
    </div>
  );
}
