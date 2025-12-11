import type { DBBook } from "@/types";
import { BookCover } from "../book-cover";
import { Button } from "@/components/ui/button";
import { Trash2, BookOpen, StickyNote, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BookCompactProps {
  books: DBBook[];
  onReadBook: (book: DBBook) => void;
  onDeleteBook: (book: DBBook) => void;
}

function calculateProgress(currentPage: number, totalPages?: number): number {
  if (!totalPages || totalPages === 0) return 0;
  return Math.round((currentPage / totalPages) * 100);
}

export function BookCompact({
  books,
  onReadBook,
  onDeleteBook,
}: BookCompactProps) {
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
      className="border border-border rounded-xl overflow-hidden divide-y divide-border"
      role="list"
    >
      {books.map((book) => {
        const progress = calculateProgress(book.currentPage, book.totalPages);

        return (
          <div
            key={book.id}
            role="listitem"
            className="group flex items-center gap-3 px-3 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
            onClick={() => onReadBook(book)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onReadBook(book);
              }
            }}
          >
            {/* Cover thumbnail */}
            <BookCover
              coverUrl={book.coverUrl}
              format={book.format}
              title={book.title}
              className="w-8 h-10 rounded shrink-0"
              iconClassName="w-4 h-4"
            />

            {book.isFavorite && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <span
                className="text-sm font-medium truncate block"
                title={book.title}
              >
                {book.title}
              </span>
              {book.author && (
                <span className="text-xs text-muted-foreground truncate block">
                  {book.author}
                </span>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              {(book.notesCount ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <StickyNote className="w-3 h-3" />
                  {book.notesCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 flex items-center gap-1.5">
                <Progress value={progress} className="h-1 flex-1" />
                <span className="text-[10px] text-muted-foreground w-7 text-right">
                  {progress}%
                </span>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBook(book);
                }}
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                aria-label={`Delete ${book.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
