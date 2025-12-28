import { useState, useEffect } from "react";
import { Folder } from "lucide-react";
import { getDownloadUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface FolderCoverProps {
  coverUrl?: string;
  name: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Displays a media folder cover image or a fallback folder icon
 * Automatically handles S3 signed URLs for cover images
 */
export function FolderCover({
  coverUrl,
  name,
  className,
  iconClassName,
}: FolderCoverProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!coverUrl) {
      setSignedUrl(null);
      setHasError(false);
      return;
    }

    // If it's an S3 key (starts with folder-covers/), get a signed URL
    if (coverUrl.startsWith("folder-covers/")) {
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
        "bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center overflow-hidden",
        className
      )}
    >
      {showFallback ? (
        <Folder
          className={cn("text-orange-500", iconClassName)}
          aria-hidden="true"
        />
      ) : (
        <img
          src={signedUrl}
          alt={`Cover for ${name}`}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      )}
    </div>
  );
}
