import type { DBImage } from "@/types";

/**
 * Common action handlers for image components
 */
export interface ImageActions {
  onView: (image: DBImage) => void;
  onEdit: (image: DBImage) => void;
  onDelete: (image: DBImage) => void;
  onDownload: (image: DBImage) => void;
  onToggleFavorite: (image: DBImage) => void;
}
