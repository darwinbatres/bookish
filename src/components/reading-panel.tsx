import type { DBBookmark, DBNote } from "@/types";
import { Bookmark, StickyNote, X, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
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

interface ReadingPanelProps {
  bookmarks: DBBookmark[];
  notes: DBNote[];
  isOpen: boolean;
  onClose: () => void;
  onGoToPage: (page: number) => void;
  onRemoveBookmark: (page: number) => void;
  onRemoveNote: (noteId: string) => void;
}

export function ReadingPanel({
  bookmarks,
  notes,
  isOpen,
  onClose,
  onGoToPage,
  onRemoveBookmark,
  onRemoveNote,
}: ReadingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<DBNote | null>(null);

  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleGoToPage = useCallback(
    (page: number) => {
      onGoToPage(page);
      if (window.innerWidth < 768) onClose();
    },
    [onGoToPage, onClose]
  );

  const handleDeleteNoteConfirm = useCallback(() => {
    if (deleteNoteTarget) {
      onRemoveNote(deleteNoteTarget.id);
      setDeleteNoteTarget(null);
    }
  }, [deleteNoteTarget, onRemoveNote]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="md:hidden fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        role="complementary"
        aria-label="Notes and bookmarks panel"
        className="fixed md:relative right-0 top-0 bottom-0 w-72 sm:w-80 md:w-64 lg:w-72 border-l border-border bg-card h-full overflow-y-auto flex flex-col z-50 md:z-auto shadow-2xl md:shadow-none animate-in slide-in-from-right md:animate-none duration-200"
      >
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h3 className="font-semibold text-sm">Notes & Bookmarks</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-1 hover:bg-secondary active:bg-secondary/80 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Bookmarks section */}
        <section
          className="p-4 border-b border-border"
          aria-labelledby="bookmarks-heading"
        >
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
            <span
              id="bookmarks-heading"
              className="text-xs font-semibold uppercase tracking-wide"
            >
              Bookmarks
            </span>
            <span
              className="text-[10px] text-muted-foreground ml-auto"
              aria-label={`${bookmarks.length} bookmarks`}
            >
              {bookmarks.length}
            </span>
          </div>

          {bookmarks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookmarks yet</p>
          ) : (
            <ul className="space-y-0.5">
              {bookmarks
                .sort((a, b) => a.page - b.page)
                .map((bookmark) => (
                  <li
                    key={bookmark.id}
                    className="flex items-center justify-between group py-2 sm:py-1"
                  >
                    <button
                      onClick={() => handleGoToPage(bookmark.page)}
                      className="text-sm text-muted-foreground hover:text-foreground active:text-foreground transition-colors py-1"
                    >
                      Page {bookmark.page}
                    </button>
                    <button
                      onClick={() => onRemoveBookmark(bookmark.page)}
                      className="p-2 sm:p-1 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-secondary rounded-md transition-all"
                      aria-label={`Remove bookmark from page ${bookmark.page}`}
                    >
                      <Trash2
                        className="w-4 h-4 sm:w-3 sm:h-3 text-muted-foreground hover:text-destructive"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* Notes section */}
        <section className="p-4 flex-1" aria-labelledby="notes-heading">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="w-3.5 h-3.5" aria-hidden="true" />
            <span
              id="notes-heading"
              className="text-xs font-semibold uppercase tracking-wide"
            >
              Notes
            </span>
            <span
              className="text-[10px] text-muted-foreground ml-auto"
              aria-label={`${notes.length} notes`}
            >
              {notes.length}
            </span>
          </div>

          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes yet</p>
          ) : (
            <ul className="space-y-2 sm:space-y-3">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="bg-secondary/60 rounded-lg p-3 sm:p-3 group relative"
                >
                  <button
                    onClick={() => handleGoToPage(note.page)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground mb-1.5 block py-0.5"
                  >
                    Page {note.page}
                  </button>
                  <p className="text-xs sm:text-sm text-foreground/80 line-clamp-3 leading-relaxed pr-6">
                    {note.content}
                  </p>
                  <button
                    onClick={() => setDeleteNoteTarget(note)}
                    className="absolute top-2 right-2 p-2 sm:p-1 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-secondary rounded-md transition-all"
                    aria-label="Delete note"
                  >
                    <Trash2
                      className="w-4 h-4 sm:w-3 sm:h-3 text-muted-foreground hover:text-destructive"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      {/* Delete Note Confirmation Dialog */}
      <AlertDialog
        open={!!deleteNoteTarget}
        onOpenChange={(open) => !open && setDeleteNoteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this note from page{" "}
              {deleteNoteTarget?.page}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNoteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
