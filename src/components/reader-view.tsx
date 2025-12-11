import dynamic from "next/dynamic";
import type { DBBook } from "@/types";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dynamic imports to avoid SSR issues
const PdfReader = dynamic(
  () => import("./pdf-reader").then((mod) => mod.PdfReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const EpubReader = dynamic(
  () => import("./epub-reader").then((mod) => mod.EpubReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface ReaderViewProps {
  currentBook: DBBook | null;
  onBackToLibrary: () => void;
  onBookUpdate: () => void;
}

export function ReaderView({
  currentBook,
  onBackToLibrary,
  onBookUpdate,
}: ReaderViewProps) {
  if (!currentBook) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary flex items-center justify-center mb-4 sm:mb-5">
          <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1 sm:mb-1.5">
          No book selected
        </h3>
        <p className="text-muted-foreground text-sm mb-4 sm:mb-5">
          Choose a book from your library
        </p>
        <Button
          variant="outline"
          onClick={onBackToLibrary}
          className="font-semibold bg-transparent h-10 sm:h-9 px-5 sm:px-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Library
        </Button>
      </div>
    );
  }

  // Render the appropriate reader based on format
  const renderReader = () => {
    switch (currentBook.format) {
      case "epub":
        return (
          <EpubReader
            book={currentBook}
            onBookUpdate={onBookUpdate}
            onBack={onBackToLibrary}
          />
        );
      case "mobi":
        // MOBI support coming - for now show message
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary flex items-center justify-center mb-4 sm:mb-5">
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1 sm:mb-1.5">
              MOBI format coming soon
            </h3>
            <p className="text-muted-foreground text-sm mb-4 sm:mb-5">
              PDF and EPUB are fully supported. MOBI support is in development.
            </p>
            <Button
              variant="outline"
              onClick={onBackToLibrary}
              className="font-semibold bg-transparent h-10 sm:h-9 px-5 sm:px-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
          </div>
        );
      case "pdf":
      default:
        return (
          <PdfReader
            book={currentBook}
            onBookUpdate={onBookUpdate}
            onBack={onBackToLibrary}
          />
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">{renderReader()}</div>
  );
}
