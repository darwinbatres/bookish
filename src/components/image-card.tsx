/**
 * ImageCard Component
 * Displays an image with various view modes - matches VideoTrackCard styling exactly
 * Created: December 2024
 */

import { useState } from "react";
import {
  Heart,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  Edit,
  FolderPlus,
  Star,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageCover } from "@/components/image-cover";
import { MembershipBadge } from "@/components/membership-badge";
import { AddToFolderModal } from "@/components/add-to-folder-modal";
import { cn } from "@/lib/utils";
import type { DBImage, ImageViewMode } from "@/types";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return "—";
  return `${width} × ${height}`;
}

interface ImageCardProps {
  image: DBImage;
  viewMode?: ImageViewMode;
  onView: (image: DBImage) => void;
  onEdit: (image: DBImage) => void;
  onDelete: (image: DBImage) => void;
  onDownload: (image: DBImage) => void;
  onToggleFavorite: (image: DBImage) => void;
  onRefresh?: () => void;
}

export function ImageCard({
  image,
  viewMode = "list",
  onView,
  onEdit,
  onDelete,
  onDownload,
  onToggleFavorite,
  onRefresh,
}: ImageCardProps) {
  const [showFolderModal, setShowFolderModal] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(image);
  };

  // Cards view - horizontal layout matching Video cards exactly
  if (viewMode === "cards") {
    return (
      <article
        className={cn(
          "group flex bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
        )}
        onClick={() => onView(image)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onView(image);
          }
        }}
      >
        {/* Cover side */}
        <div className="w-24 sm:w-32 shrink-0 relative">
          <ImageCover
            thumbnailUrl={image.thumbnailUrl}
            s3Key={image.s3Key}
            title={image.title}
            className="w-full h-full"
            aspectRatio="square"
            iconClassName="w-10 h-10"
          />
          {image.isFavorite && (
            <div className="absolute top-2 left-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
          )}
          {(image.folderCount ?? 0) > 0 && (
            <MembershipBadge
              folderCount={image.folderCount}
              className="absolute top-2 right-2"
            />
          )}
          {/* View overlay */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            <Eye className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-sm truncate"
                title={image.title}
              >
                {image.title}
              </h3>
              {image.album && (
                <p className="text-xs text-muted-foreground truncate">
                  {image.album}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(image);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Image
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(image);
                  }}
                >
                  <Star
                    className={cn(
                      "mr-2 h-4 w-4",
                      image.isFavorite && "fill-current text-amber-500"
                    )}
                  />
                  {image.isFavorite
                    ? "Remove from Favorites"
                    : "Add to Favorites"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(image);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFolderModal(true);
                  }}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Add to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(image);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatBytes(image.fileSize)}
            </span>
            {image.width && image.height && (
              <span>{formatDimensions(image.width, image.height)}</span>
            )}
            <span className="uppercase font-medium">
              {image.format.toUpperCase()}
            </span>
          </div>

          {/* Info row at bottom - matches video progress area structure */}
          <div className="mt-auto pt-3 flex items-center gap-3">
            <div className="flex-1 text-xs text-muted-foreground">
              {image.viewCount > 0 ? `${image.viewCount} views` : "Not viewed"}
            </div>
            <span className="text-xs font-medium w-16 text-right">
              {image.width && image.height
                ? `${image.width}×${image.height}`
                : "—"}
            </span>
          </div>
        </div>

        <AddToFolderModal
          open={showFolderModal}
          onOpenChange={setShowFolderModal}
          itemId={image.id}
          itemType="image"
          itemTitle={image.title}
          onSuccess={onRefresh}
        />
      </article>
    );
  }

  // Grid view - vertical card layout matching Video grid exactly
  if (viewMode === "grid") {
    return (
      <article
        className={cn(
          "group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
        )}
        onClick={() => onView(image)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onView(image);
          }
        }}
      >
        {/* Cover/Header */}
        <div className="relative h-32">
          <ImageCover
            thumbnailUrl={image.thumbnailUrl}
            s3Key={image.s3Key}
            title={image.title}
            className="w-full h-full"
            iconClassName="w-12 h-12"
          />

          {image.isFavorite && (
            <div className="absolute top-2 left-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
          )}

          <div className="absolute top-2 right-2 flex gap-1 z-10">
            {(image.folderCount ?? 0) > 0 && (
              <MembershipBadge
                folderCount={image.folderCount}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(image);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Image
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(image);
                  }}
                >
                  <Star
                    className={cn(
                      "mr-2 h-4 w-4",
                      image.isFavorite && "fill-current text-amber-500"
                    )}
                  />
                  {image.isFavorite
                    ? "Remove from Favorites"
                    : "Add to Favorites"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(image);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFolderModal(true);
                  }}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Add to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(image);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* View overlay */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            <Eye className="h-10 w-10 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col">
          <h3 className="font-semibold text-sm truncate" title={image.title}>
            {image.title}
          </h3>
          {image.album && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {image.album}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatBytes(image.fileSize)}
            </span>
            <span className="ml-auto">
              {image.width && image.height
                ? formatDimensions(image.width, image.height)
                : "--"}
            </span>
          </div>

          {/* Info row - matches video progress area structure exactly */}
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground">
                {image.viewCount > 0
                  ? `Viewed ${image.viewCount} time${image.viewCount > 1 ? "s" : ""}`
                  : "Not viewed"}
              </span>
              <span className="text-[10px] font-medium">
                {image.format.toUpperCase()}
              </span>
            </div>
            {/* Static bar matching Video's progress bar */}
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-foreground/20 rounded-full w-full" />
            </div>
          </div>
        </div>

        <AddToFolderModal
          open={showFolderModal}
          onOpenChange={setShowFolderModal}
          itemId={image.id}
          itemType="image"
          itemTitle={image.title}
          onSuccess={onRefresh}
        />
      </article>
    );
  }

  // Compact view - minimal horizontal row matching Video compact exactly
  if (viewMode === "compact") {
    return (
      <div
        className={cn(
          "group flex items-center gap-3 px-3 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
        )}
        onClick={() => onView(image)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onView(image);
          }
        }}
      >
        {/* Small thumbnail - same size as video (w-8 h-10) */}
        <div className="relative shrink-0 w-8 h-10 rounded overflow-hidden">
          <ImageCover
            thumbnailUrl={image.thumbnailUrl}
            s3Key={image.s3Key}
            title={image.title}
            className="w-full h-full"
            iconClassName="w-4 h-4"
          />
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              "bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            <Eye className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Favorite Star - right after thumbnail like Video */}
        {image.isFavorite && (
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
        )}

        {/* Membership Badge */}
        {(image.folderCount ?? 0) > 0 && (
          <MembershipBadge
            folderCount={image.folderCount}
            className="shrink-0"
          />
        )}

        {/* Title & Album */}
        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-medium truncate block"
            title={image.title}
          >
            {image.title}
          </span>
          {image.album && (
            <span className="text-xs text-muted-foreground truncate block">
              {image.album}
            </span>
          )}
        </div>

        {/* Metadata - hidden on small screens */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          {image.width && image.height && (
            <span>{formatDimensions(image.width, image.height)}</span>
          )}
        </div>

        {/* Info section - matches progress area position in Video/Audio */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-16 flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground truncate flex-1">
              {formatBytes(image.fileSize)}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase w-7 text-right">
              {image.format}
            </span>
          </div>

          {/* Actions on hover - same sizes as Video (h-7 w-7) */}
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFavoriteClick}
              className="h-7 w-7 p-0"
              aria-label={
                image.isFavorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              <Heart
                className={cn(
                  "w-3.5 h-3.5",
                  image.isFavorite && "fill-amber-500 text-amber-500"
                )}
              />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(image);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Image
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(image);
                  }}
                >
                  <Star
                    className={cn(
                      "w-4 h-4 mr-2",
                      image.isFavorite && "fill-current text-amber-500"
                    )}
                  />
                  {image.isFavorite
                    ? "Remove from Favorites"
                    : "Add to Favorites"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(image);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFolderModal(true);
                  }}
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Add to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(image);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <AddToFolderModal
          open={showFolderModal}
          onOpenChange={setShowFolderModal}
          itemId={image.id}
          itemType="image"
          itemTitle={image.title}
          onSuccess={onRefresh}
        />
      </div>
    );
  }

  // Default: List view - horizontal row matching Video list style exactly
  return (
    <article
      role="listitem"
      className={cn(
        "group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-border hover:border-muted-foreground/30 active:bg-secondary/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      )}
      onClick={() => onView(image)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(image);
        }
      }}
      tabIndex={0}
    >
      {/* Cover thumbnail - w-16 h-10 like Video */}
      <ImageCover
        thumbnailUrl={image.thumbnailUrl}
        s3Key={image.s3Key}
        title={image.title}
        className="w-16 h-10 rounded-lg shrink-0 hidden sm:flex"
        iconClassName="w-5 h-5"
      />

      {/* Image info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-foreground truncate pr-2 flex items-center gap-1.5">
          {image.isFavorite && (
            <Star
              className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0"
              aria-label="Favorite"
            />
          )}
          <span className="truncate">{image.title}</span>
        </h3>
        {image.album && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {image.album}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <span className="text-xs text-muted-foreground uppercase font-medium">
            IMAGE
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-xs text-muted-foreground">
            {image.width && image.height
              ? formatDimensions(image.width, image.height)
              : "Unknown dimensions"}
          </span>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <HardDrive className="w-3 h-3" aria-hidden="true" />
            {formatBytes(image.fileSize)}
          </span>
          {(image.folderCount ?? 0) > 0 && (
            <>
              <span className="hidden sm:inline text-muted-foreground/40">
                •
              </span>
              <span className="hidden sm:inline">
                <MembershipBadge folderCount={image.folderCount} />
              </span>
            </>
          )}
        </div>
        {/* Mobile-only metadata row */}
        <div className="flex sm:hidden items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {formatBytes(image.fileSize)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={(e) => {
              e.stopPropagation();
              onView(image);
            }}
            className="h-9 sm:h-8 px-4 sm:px-3 text-xs font-semibold"
          >
            View
          </Button>

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                className="h-9 sm:h-8 w-9 sm:w-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                aria-label={`More options for ${image.title}`}
              >
                <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => onEdit(image)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleFavorite(image)}>
                <Star
                  className={cn(
                    "w-4 h-4 mr-2",
                    image.isFavorite && "fill-current text-amber-500"
                  )}
                />
                {image.isFavorite
                  ? "Remove from Favorites"
                  : "Add to Favorites"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload(image)}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFolderModal(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add to Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(image)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AddToFolderModal
        open={showFolderModal}
        onOpenChange={setShowFolderModal}
        itemId={image.id}
        itemType="image"
        itemTitle={image.title}
        onSuccess={onRefresh}
      />
    </article>
  );
}
