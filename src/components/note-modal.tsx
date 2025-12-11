import type React from "react";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
  currentPage: number;
}

export function NoteModal({
  isOpen,
  onClose,
  onSave,
  currentPage,
}: NoteModalProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Focus textarea after animation
      const timer = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
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

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements =
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, textarea, [tabindex]:not([tabindex="-1"])'
          );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = useCallback(() => {
    if (content.trim()) {
      onSave(content.trim());
      setContent("");
      onClose();
    }
  }, [content, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="bg-popover text-popover-foreground border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
      >
        {/* Mobile drag indicator */}
        <div
          className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4 sm:hidden"
          aria-hidden="true"
        />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3
              id="note-modal-title"
              className="text-base sm:text-lg font-semibold"
            >
              Add note
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Page {currentPage}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 hover:bg-secondary active:bg-secondary/80 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your note..."
          className="w-full h-32 sm:h-28 p-3 sm:p-4 bg-secondary border-0 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm leading-relaxed"
          aria-label="Note content"
        />

        <p className="text-[10px] text-muted-foreground mt-2 hidden sm:block">
          Press{" "}
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl</kbd>+
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>{" "}
          to save
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-11 sm:h-9 w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!content.trim()}
            className="h-11 sm:h-9 w-full sm:w-auto"
          >
            Save note
          </Button>
        </div>
      </div>
    </div>
  );
}
