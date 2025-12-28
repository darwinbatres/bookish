import { useState, useCallback, useEffect } from "react";
import type { DBBook, DBCollection } from "@/types";
import { BookCover } from "../book-cover";
import { MembershipBadge } from "../membership-badge";
import { EditBookModal } from "../edit-book-modal";
import { AddToFolderModal } from "../add-to-folder-modal";
import { DeleteConfirmationInfo } from "../delete-confirmation-info";
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
  Calendar,
  Star,
  MoreVertical,
  FolderInput,
  Folder,
  Check,
  Download,
  Pencil,
  FolderPlus,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  deleteBook,
  addBookToCollection,
  fetchCollections,
  getDownloadUrl,
  toggleBookFavorite,
} from "@/lib/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BookCardsProps {
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

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function BookCards({
  books,
  onReadBook,
  onBooksChange,
}: BookCardsProps) {
  const [deleteTarget, setDeleteTarget] = useState<DBBook | null>(null);
  const [editTarget, setEditTarget] = useState<DBBook | null>(null);
  const [folderTarget, setFolderTarget] = useState<DBBook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [collections, setCollections] = useState<DBCollection[]>([]);

  const loadCollections = useCallback(() => {
    fetchCollections()
      .then(setCollections)
      .catch((err) =>
        console.error("[BookCards] Failed to load collections:", err)
      );
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleMoveToCollection = useCallback(
    async (bookId: string, collectionId: string | null, bookTitle: string) => {
      try {
        await addBookToCollection(bookId, collectionId);
        toast.success(
          collectionId
            ? `Moved "${bookTitle}" to collection`
            : `Removed "${bookTitle}" from collection`
        );
        onBooksChange();
      } catch (err) {
        console.error("[BookCards] Failed to move book:", err);
        toast.error("Failed to move book");
      }
    },
    [onBooksChange]
  );

  const handleToggleFavorite = useCallback(
    async (book: DBBook) => {
      try {
        await toggleBookFavorite(book.id, !book.isFavorite);
        toast.success(
          book.isFavorite ? "Removed from favorites" : "Added to favorites"
        );
        onBooksChange();
      } catch (err) {
        console.error("[BookCards] Failed to toggle favorite:", err);
        toast.error("Failed to update favorite");
      }
    },
    [onBooksChange]
  );

  const handleDownloadBook = useCallback(async (book: DBBook) => {
    try {
      if (!book.s3Key) {
        toast.error("Download unavailable");
        return;
      }
      toast.info("Preparing download...");
      const { downloadUrl } = await getDownloadUrl(book.s3Key);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const safeTitle = book.title.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
      link.download = `${safeTitle}.${book.format}`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch (err) {
      console.error("[BookCards] Failed to download book:", err);
      toast.error("Failed to download book");
    }
  }, []);

  const handleDeleteBook = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteBook(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.title}"`);
      onBooksChange();
      setDeleteTarget(null);
    } catch (err) {
      console.error("[BookCards] Failed to delete book:", err);
      toast.error("Failed to delete book");
    } finally {
      setIsDeleting(false);
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
        <p className="text-sm font-medium">No books found</p>
        <p className="text-xs mt-1 opacity-70">
          Try a different search or upload a book
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
        {books.map((book) => {
          const progress = calculateProgress(book.currentPage, book.totalPages);

          return (
            <article
              key={book.id}
              role="listitem"
              className="group flex bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
              onClick={() => onReadBook(book)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onReadBook(book);
                }
              }}
            >
              {/* Cover side */}
              <div className="w-24 sm:w-32 shrink-0 relative">
                <BookCover
                  coverUrl={book.coverUrl}
                  format={book.format}
                  title={book.title}
                  className="w-full h-full"
                  iconClassName="w-10 h-10"
                />
                {book.isFavorite && (
                  <div className="absolute top-2 left-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  </div>
                )}
                {(book.folderCount ?? 0) > 0 && (
                  <MembershipBadge
                    folderCount={book.folderCount}
                    className="absolute top-2 right-2"
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 p-4 flex flex-col min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-semibold text-sm truncate"
                      title={book.title}
                    >
                      {book.title}
                    </h3>
                    {book.author && (
                      <p className="text-xs text-muted-foreground truncate">
                        {book.author}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <MoreVertical className="w-4 h-4" />
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
                      <DropdownMenuItem
                        onClick={() => handleDownloadBook(book)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Book
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFolderTarget(book)}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Add to Folder
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

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    {formatBytes(book.fileSize)}
                  </span>
                  {(book.notesCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <StickyNote className="w-3 h-3" />
                      {book.notesCount}{" "}
                      {book.notesCount === 1 ? "note" : "notes"}
                    </span>
                  )}
                  {(book.bookmarksCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Bookmark className="w-3 h-3" />
                      {book.bookmarksCount}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatRelativeDate(book.updatedAt)}
                  </span>
                </div>

                {/* Progress */}
                <div className="mt-auto pt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  <span className="text-xs font-medium w-16 text-right">
                    {book.totalPages
                      ? `${book.currentPage}/${book.totalPages}`
                      : "0%"}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This
              action cannot be undone.
              {deleteTarget && (
                <DeleteConfirmationInfo
                  itemType="book"
                  itemId={deleteTarget.id}
                  isFavorite={deleteTarget.isFavorite}
                />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBook}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <EditBookModal
        book={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onBookUpdated={onBooksChange}
      />

      {/* Add to Folder Modal */}
      {folderTarget && (
        <AddToFolderModal
          open={!!folderTarget}
          onOpenChange={(open) => !open && setFolderTarget(null)}
          itemId={folderTarget.id}
          itemType="book"
          itemTitle={folderTarget.title}
          onSuccess={onBooksChange}
        />
      )}
    </>
  );
}
