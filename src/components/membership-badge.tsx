/**
 * MembershipBadge Component
 * Shows an indicator when an item is part of folders or playlists
 * Created: January 2025
 */

import { FolderOpen, ListMusic } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MembershipBadgeProps {
  folderCount?: number;
  playlistCount?: number;
  className?: string;
  size?: "sm" | "md";
}

export function MembershipBadge({
  folderCount = 0,
  playlistCount = 0,
  className,
  size = "sm",
}: MembershipBadgeProps) {
  const hasFolders = folderCount > 0;
  const hasPlaylists = playlistCount > 0;

  if (!hasFolders && !hasPlaylists) {
    return null;
  }

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const containerSize = size === "sm" ? "p-1 gap-1" : "p-1.5 gap-1.5";

  const tooltipContent = [];
  if (hasFolders) {
    tooltipContent.push(
      `In ${folderCount} folder${folderCount > 1 ? "s" : ""}`
    );
  }
  if (hasPlaylists) {
    tooltipContent.push(
      `In ${playlistCount} playlist${playlistCount > 1 ? "s" : ""}`
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center rounded-full bg-muted/80 backdrop-blur-sm",
              containerSize,
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {hasFolders && (
              <FolderOpen className={cn(iconSize, "text-blue-500")} />
            )}
            {hasPlaylists && (
              <ListMusic className={cn(iconSize, "text-purple-500")} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipContent.join(" • ")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
