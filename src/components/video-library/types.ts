import type { DBVideoTrack } from "@/types";

/**
 * Common action handlers for video track components
 */
export interface VideoTrackActions {
  onPlay: (track: DBVideoTrack) => void;
  onPause: () => void;
  onEdit: (track: DBVideoTrack) => void;
  onDelete: (track: DBVideoTrack) => void;
  onDownload: (track: DBVideoTrack) => void;
  onToggleFavorite: (track: DBVideoTrack) => void;
}
