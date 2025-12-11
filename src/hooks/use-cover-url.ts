import { useState, useEffect } from "react";
import { getDownloadUrl } from "@/lib/api/client";

/**
 * Hook to get a signed URL for a book cover image
 * Handles both S3 keys (covers/...) and direct URLs
 */
export function useCoverUrl(coverUrl: string | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!coverUrl) {
      setSignedUrl(null);
      return;
    }

    // If it's an S3 key (starts with covers/), get a signed URL
    if (coverUrl.startsWith("covers/")) {
      getDownloadUrl(coverUrl)
        .then(({ downloadUrl }) => setSignedUrl(downloadUrl))
        .catch(() => setSignedUrl(null));
    } else {
      // It's already a direct URL
      setSignedUrl(coverUrl);
    }
  }, [coverUrl]);

  return signedUrl;
}
