import { useState, useEffect } from "react";
import { getDownloadUrl } from "@/lib/api/client";
import { FormatIcon } from "./book-upload";
import { cn } from "@/lib/utils";
import type { BookFormat } from "@/types";

interface BookCoverProps {
  coverUrl?: string;
  format: BookFormat;
  title: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Displays a book cover image or a fallback format icon
 * Automatically handles S3 signed URLs for cover images
 */
export function BookCover({
  coverUrl,
  format,
  title,
  className,
  iconClassName,
}: BookCoverProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!coverUrl) {
      setSignedUrl(null);
      setHasError(false);
      return;
    }

    // If it's an S3 key (starts with covers/), get a signed URL
    if (coverUrl.startsWith("covers/")) {
      getDownloadUrl(coverUrl)
        .then(({ downloadUrl }) => {
          setSignedUrl(downloadUrl);
          setHasError(false);
        })
        .catch(() => {
          setSignedUrl(null);
          setHasError(true);
        });
    } else {
      // It's already a direct URL
      setSignedUrl(coverUrl);
      setHasError(false);
    }
  }, [coverUrl]);

  const showFallback = !signedUrl || hasError;

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-primary/10 to-secondary flex items-center justify-center overflow-hidden",
        className
      )}
    >
      {showFallback ? (
        <FormatIcon
          format={format}
          className={cn("text-muted-foreground/50", iconClassName)}
        />
      ) : (
        <img
          src={signedUrl}
          alt={`Cover of ${title}`}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      )}
    </div>
  );
}
