import { useState, useEffect } from "react";
import { Music } from "lucide-react";
import { getDownloadUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface AudioCoverProps {
  coverUrl?: string;
  title: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Displays an audio track cover image or a fallback music icon
 * Automatically handles S3 signed URLs for cover images
 */
export function AudioCover({
  coverUrl,
  title,
  className,
  iconClassName,
}: AudioCoverProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!coverUrl) {
      setSignedUrl(null);
      setHasError(false);
      return;
    }

    // If it's an S3 key (starts with audio-covers/), get a signed URL
    if (coverUrl.startsWith("audio-covers/")) {
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
        "bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden",
        className
      )}
    >
      {showFallback ? (
        <Music
          className={cn("text-primary/40", iconClassName)}
          aria-hidden="true"
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
