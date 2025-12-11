import type { DBBook } from "@/types";
import { BookCover } from "../book-cover";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  BookOpen,
  StickyNote,
  Bookmark,
  HardDrive,
  Star,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BookGridProps {
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

export function BookGrid({ books, onReadBook, onDeleteBook }: BookGridProps) {
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
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      role="list"
    >
      {books.map((book) => {
        const progress = calculateProgress(book.currentPage, book.totalPages);

        return (
          <article
            key={book.id}
            role="listitem"
            className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
            onClick={() => onReadBook(book)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onReadBook(book);
              }
            }}
          >
            {/* Cover/Header */}
            <div className="relative h-32">
              <BookCover
                coverUrl={book.coverUrl}
                format={book.format}
                title={book.title}
                className="w-full h-full"
                iconClassName="w-12 h-12"
              />
              {book.isFavorite && (
                <div className="absolute top-2 left-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBook(book);
                  }}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Delete ${book.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 flex flex-col">
              <h3 className="font-semibold text-sm truncate" title={book.title}>
                {book.title}
              </h3>
              {book.author && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {book.author}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
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

              {/* Progress */}
              <div className="mt-auto pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {book.totalPages
                      ? `${book.currentPage} / ${book.totalPages}`
                      : "Not started"}
                  </span>
                  <span className="text-[10px] font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1" />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
