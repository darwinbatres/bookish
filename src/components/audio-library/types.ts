import type { DBAudioTrack } from "@/types";

/**
 * Common action handlers for audio track views
 */
export interface AudioTrackActions {
  onPlay: (track: DBAudioTrack) => void;
  onPause: () => void;
  onEdit: (track: DBAudioTrack) => void;
  onDelete: (track: DBAudioTrack) => void;
  onDownload: (track: DBAudioTrack) => void;
  onToggleFavorite: (track: DBAudioTrack) => void;
}
