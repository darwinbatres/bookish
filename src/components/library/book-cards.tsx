import type { DBBook } from "@/types";
import { BookCover } from "../book-cover";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  BookOpen,
  StickyNote,
  Bookmark,
  HardDrive,
  Calendar,
  Star,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BookCardsProps {
  books: DBBook[];
  onReadBook: (book: DBBook) => void;
  onDeleteBook: (book: DBBook) => void;
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

export function BookCards({ books, onReadBook, onDeleteBook }: BookCardsProps) {
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBook(book);
                  }}
                  className="h-8 w-8 p-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity shrink-0"
                  aria-label={`Delete ${book.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatBytes(book.fileSize)}
                </span>
                {(book.notesCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <StickyNote className="w-3 h-3" />
                    {book.notesCount} {book.notesCount === 1 ? "note" : "notes"}
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
  );
}
