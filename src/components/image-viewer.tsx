/**
 * ImageViewer Component
 * Fullscreen lightbox for image viewing with navigation
 * Created: December 2024
 */

import { useEffect, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Heart,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadImageFile, updateImage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DBImage } from "@/types";

interface ImageViewerProps {
  image: DBImage;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function ImageViewer({
  image,
  onClose,
  onPrev,
  onNext,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [isFavorite, setIsFavorite] = useState(image.isFavorite);

  const imageUrl = `/api/images/stream?s3Key=${encodeURIComponent(image.s3Key)}`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          onPrev?.();
          break;
        case "ArrowRight":
          onNext?.();
          break;
        case "+":
        case "=":
          setZoom((z) => Math.min(z + 0.25, 3));
          break;
        case "-":
          setZoom((z) => Math.max(z - 0.25, 0.25));
          break;
        case "0":
          setZoom(1);
          setRotation(0);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  const handleDownload = async () => {
    await downloadImageFile(image);
  };

  const handleToggleFavorite = async () => {
    try {
      await updateImage(image.id, { isFavorite: !isFavorite });
      setIsFavorite(!isFavorite);
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <h3 className="text-white font-medium truncate max-w-[50%]">
          {image.title}
        </h3>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}>
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}>
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={handleToggleFavorite}
          >
            <Heart className={cn("h-5 w-5", isFavorite && "fill-red-500 text-red-500")} />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setShowInfo(!showInfo)}>
            <Info className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleDownload}>
            <Download className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Image */}
      <img
        src={imageUrl}
        alt={image.title}
        className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-200"
        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Prev Button */}
      {onPrev && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Next Button */}
      {onNext && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Info Panel */}
      {showInfo && (
        <div
          className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur p-4 rounded-lg text-white text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-white/60 text-xs">Format</p>
              <p>{image.format.toUpperCase()}</p>
            </div>
            {image.width && image.height && (
              <div>
                <p className="text-white/60 text-xs">Dimensions</p>
                <p>{image.width} x {image.height}</p>
              </div>
            )}
            {image.cameraModel && (
              <div>
                <p className="text-white/60 text-xs">Camera</p>
                <p>{image.cameraModel}</p>
              </div>
            )}
            {image.takenAt && (
              <div>
                <p className="text-white/60 text-xs">Date Taken</p>
                <p>{new Date(image.takenAt).toLocaleDateString()}</p>
              </div>
            )}
            {image.album && (
              <div>
                <p className="text-white/60 text-xs">Album</p>
                <p>{image.album}</p>
              </div>
            )}
            {image.tags && image.tags.length > 0 && (
              <div className="col-span-2">
                <p className="text-white/60 text-xs">Tags</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {image.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white/20 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
