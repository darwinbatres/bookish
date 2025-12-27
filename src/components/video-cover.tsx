import { useState, useEffect } from "react";
import { Video } from "lucide-react";
import { getDownloadUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface VideoCoverProps {
  coverUrl?: string;
  title: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Displays a video track cover image or a fallback video icon
 * Automatically handles S3 signed URLs for cover images
 */
export function VideoCover({
  coverUrl,
  title,
  className,
  iconClassName,
}: VideoCoverProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!coverUrl) {
      setSignedUrl(null);
      setHasError(false);
      return;
    }

    // If it's an S3 key (starts with video-covers/), get a signed URL
    if (coverUrl.startsWith("video-covers/")) {
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
        "bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center overflow-hidden",
        className
      )}
    >
      {showFallback ? (
        <Video
          className={cn("text-rose-500/40", iconClassName)}
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
