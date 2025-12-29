/**
 * ImageCover Component
 * Displays image thumbnails with lazy loading and fallback
 * Created: December 2024
 */

import { useState, useEffect } from "react";
import { ImageIcon } from "lucide-react";
import { getImageStreamUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface ImageCoverProps {
  /** S3 key or thumbnail URL */
  thumbnailUrl?: string;
  /** S3 key for full image (fallback) */
  s3Key?: string;
  /** Alt text for the image */
  title: string;
  /** Additional CSS classes */
  className?: string;
  /** Classes for the fallback icon */
  iconClassName?: string;
  /** Aspect ratio variant */
  aspectRatio?: "square" | "video" | "portrait";
}

export function ImageCover({
  thumbnailUrl,
  s3Key,
  title,
  className,
  iconClassName,
  aspectRatio = "square",
}: ImageCoverProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      setLoading(true);
      setError(false);

      // Use thumbnail if available, otherwise use s3Key
      const keyToUse = thumbnailUrl || s3Key;
      if (!keyToUse) {
        setLoading(false);
        return;
      }

      // If it's already a full URL (external), use directly
      if (keyToUse.startsWith("http://") || keyToUse.startsWith("https://")) {
        setImageUrl(keyToUse);
        setLoading(false);
        return;
      }

      // Otherwise get stream URL from API
      try {
        const url = await getImageStreamUrl(keyToUse);
        setImageUrl(url);
      } catch (err) {
        console.error("Failed to load image:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [thumbnailUrl, s3Key]);

  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
  };

  return (
    <div
      className={cn(
        "bg-muted flex items-center justify-center overflow-hidden",
        aspectClasses[aspectRatio],
        className
      )}
    >
      {loading ? (
        <div className="w-full h-full bg-muted animate-pulse" />
      ) : error || !imageUrl ? (
        <ImageIcon
          className={cn("text-muted-foreground opacity-50", iconClassName)}
        />
      ) : (
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}
