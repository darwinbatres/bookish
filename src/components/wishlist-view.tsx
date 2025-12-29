import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  ShoppingCart,
  Edit2,
  Trash2,
  MoreVertical,
  Loader2,
  ExternalLink,
  Star,
  BookPlus,
  Music,
  Video,
  BookOpen,
  AlertTriangle,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SearchInput,
  PaginationControls,
  ViewModeSwitcher,
} from "@/components/library";
import {
  fetchWishlistPaginated,
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  checkWishlistDuplicates,
  DuplicateMatch,
} from "@/lib/api/client";
import type {
  DBWishlistItem,
  WishlistPriority,
  WishlistMediaType,
  LibraryViewMode,
} from "@/types";

// LocalStorage keys
const PAGE_SIZE_KEY = "bookish-library-page-size";
const VIEW_MODE_KEY = "bookish-wishlist-view-mode";
const MEDIA_TYPE_FILTER_KEY = "bookish-wishlist-media-type";

function getStoredPageSize(): number {
  if (typeof window === "undefined") return 20;
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 20;
}

function getStoredViewMode(): LibraryViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  if (stored && ["list", "grid", "cards", "compact"].includes(stored)) {
    return stored as LibraryViewMode;
  }
  return "list";
}

function getStoredMediaTypeFilter(): WishlistMediaType | "all" {
  if (typeof window === "undefined") return "all";
  const stored = localStorage.getItem(MEDIA_TYPE_FILTER_KEY);
  if (stored && ["all", "book", "audio", "video", "image"].includes(stored)) {
    return stored as WishlistMediaType | "all";
  }
  return "all";
}

const PRIORITY_LABELS: Record<WishlistPriority, string> = {
  0: "Low",
  1: "Medium",
  2: "High",
};

const PRIORITY_COLORS: Record<WishlistPriority, string> = {
  0: "bg-slate-500/20 text-slate-600 dark:text-slate-400",
  1: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  2: "bg-red-500/20 text-red-600 dark:text-red-400",
};

const MEDIA_TYPE_ICONS: Record<WishlistMediaType, typeof BookOpen> = {
  book: BookOpen,
  audio: Music,
  video: Video,
  image: ImageIcon,
};

const MEDIA_TYPE_COLORS: Record<WishlistMediaType, string> = {
  book: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  audio: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  video: "bg-green-500/20 text-green-600 dark:text-green-400",
  image: "bg-pink-500/20 text-pink-600 dark:text-pink-400",
};

/**
 * Parse a wishlist input that may contain both a title and a URL.
 * Handles formats like:
 * - "Head First Go https://example.com/book"
 * - "https://example.com/book Head First Go"
 * - "Head First Go\nhttps://example.com/book"
 * - Just a title with no URL
 * - Just a URL (extracts domain/path as title)
 *
 * Uses the URL Web API for robust URL detection (industry standard).
 * @see https://developer.mozilla.org/en-US/docs/Web/API/URL
 */
function parseWishlistInput(input: string): { title: string; url: string } {
  const trimmed = input.trim();
  if (!trimmed) return { title: "", url: "" };

  // URL regex pattern - matches http(s):// URLs
  // This is a simplified but robust pattern that handles most real-world URLs
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const matches = trimmed.match(urlPattern);

  if (!matches || matches.length === 0) {
    // No URL found, return the input as title
    return { title: trimmed, url: "" };
  }

  // Take the first URL found
  const url = matches[0];

  // Remove the URL from the input to get the title
  let title = trimmed.replace(url, "").trim();

  // If title is empty (input was just a URL), try to extract something useful
  if (!title) {
    try {
      const parsed = new URL(url);
      // Try to get the last meaningful path segment
      const pathSegments = parsed.pathname.split("/").filter(Boolean);
      if (pathSegments.length > 0) {
        // Decode and clean up the last path segment
        const lastSegment = decodeURIComponent(
          pathSegments[pathSegments.length - 1]
        );
        // Convert kebab/snake case to title case
        title = lastSegment
          .replace(/[-_]/g, " ")
          .replace(/\.[^.]+$/, "") // Remove file extension if present
          .trim();
      }
      // If still empty, use the hostname
      if (!title) {
        title = parsed.hostname.replace(/^www\./, "");
      }
    } catch {
      // Invalid URL format, just use original input
      title = trimmed;
    }
  }

  return { title, url };
}

interface WishlistFormData {
  title: string;
  author: string;
  mediaType: WishlistMediaType;
  notes: string;
  priority: WishlistPriority;
  url: string;
}

const defaultFormData: WishlistFormData = {
  title: "",
  author: "",
  mediaType: "book",
  notes: "",
  priority: 1,
  url: "",
};

/**
 * Format a date for display in the wishlist.
 * Uses relative time for recent dates, absolute for older ones.
 * Uses Intl.RelativeTimeFormat for i18n-friendly relative time (industry standard).
 */
function formatAddedDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // For very recent items, use relative time
  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }

  // For older items, show the date
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

interface WishlistViewProps {
  isFullPage?: boolean;
}

// Media type filter dropdown
function MediaTypeFilter({
  value,
  onChange,
}: {
  value: WishlistMediaType | "all";
  onChange: (value: WishlistMediaType | "all") => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as WishlistMediaType | "all")}
    >
      <SelectTrigger className="w-[130px]">
        <SelectValue placeholder="All types" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Types</SelectItem>
        <SelectItem value="book">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" />
            Books
          </div>
        </SelectItem>
        <SelectItem value="audio">
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5" />
            Audio
          </div>
        </SelectItem>
        <SelectItem value="video">
          <div className="flex items-center gap-2">
            <Video className="w-3.5 h-3.5" />
            Video
          </div>
        </SelectItem>
        <SelectItem value="image">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5" />
            Images
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// Item card component matching the folder/audio/video card pattern
function WishlistItemCard({
  item,
  viewMode,
  onEdit,
  onDelete,
}: {
  item: DBWishlistItem;
  viewMode: LibraryViewMode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const MediaIcon = MEDIA_TYPE_ICONS[item.mediaType];
  const mediaTypeLabel = item.mediaType.toUpperCase();

  // Compact view - minimal row matching book/audio compact pattern
  if (viewMode === "compact") {
    return (
      <article
        role="listitem"
        className="group flex items-center gap-3 px-3 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
        onClick={onEdit}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit();
          }
        }}
      >
        {/* Thumbnail */}
        <div
          className={cn(
            "w-8 h-10 rounded shrink-0 flex items-center justify-center",
            MEDIA_TYPE_COLORS[item.mediaType].split(" ")[0]
          )}
        >
          <MediaIcon
            className={cn(
              "w-4 h-4",
              MEDIA_TYPE_COLORS[item.mediaType].split(" ")[1]
            )}
          />
        </div>

        {/* Title & Author */}
        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-medium truncate block"
            title={item.title}
          >
            {item.title}
          </span>
          {item.author && (
            <span className="text-xs text-muted-foreground truncate block">
              {item.author}
            </span>
          )}
        </div>

        {/* Link indicator - hidden on small screens */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="text-muted-foreground/60">
            {formatAddedDate(item.createdAt)}
          </span>
          {item.url && (
            <span className="flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Link
            </span>
          )}
        </div>

        {/* Priority + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium rounded-full",
              PRIORITY_COLORS[item.priority]
            )}
          >
            {PRIORITY_LABELS[item.priority]}
          </span>

          {/* Actions on hover */}
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {item.url && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.open(
                    item.url as string,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="h-7 w-7 p-0"
                aria-label="Open link"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </article>
    );
  }

  // Grid view - card layout matching book/audio grid pattern
  if (viewMode === "grid") {
    return (
      <article
        className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
        onClick={onEdit}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit();
          }
        }}
      >
        {/* Cover/Header - colored background with icon */}
        <div className="relative h-32">
          <div
            className={cn(
              "w-full h-full flex items-center justify-center",
              MEDIA_TYPE_COLORS[item.mediaType].split(" ")[0]
            )}
          >
            <MediaIcon
              className={cn(
                "w-12 h-12",
                MEDIA_TYPE_COLORS[item.mediaType].split(" ")[1]
              )}
            />
          </div>

          {/* Dropdown menu overlay */}
          <div className="absolute top-2 right-2 flex gap-1 z-10">
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
                {item.url && (
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(
                        item.url as string,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Link
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col">
          <h3 className="font-semibold text-sm truncate" title={item.title}>
            {item.title}
          </h3>
          {item.author && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {item.author}
            </p>
          )}

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="uppercase font-medium">{mediaTypeLabel}</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{formatAddedDate(item.createdAt)}</span>
            {item.url && (
              <span className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Link
              </span>
            )}
          </div>

          {/* Priority at bottom */}
          <div className="mt-auto pt-3">
            <span
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded-full",
                PRIORITY_COLORS[item.priority]
              )}
            >
              {PRIORITY_LABELS[item.priority]} Priority
            </span>
          </div>
        </div>
      </article>
    );
  }

  // List view (default) and Cards view - matching folder/audio pattern
  return (
    <article
      role="listitem"
      className={cn(
        "group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-border hover:border-muted-foreground/30 active:bg-secondary/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        viewMode === "cards" && "p-4"
      )}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      tabIndex={0}
    >
      {/* Icon thumbnail - hidden on mobile */}
      <div
        className={cn(
          "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 hidden sm:flex",
          MEDIA_TYPE_COLORS[item.mediaType].split(" ")[0]
        )}
      >
        <MediaIcon
          className={cn(
            "w-5 h-5",
            MEDIA_TYPE_COLORS[item.mediaType].split(" ")[1]
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-foreground truncate pr-2">
          {item.title}
        </h3>
        {item.author && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {item.author}
          </p>
        )}
        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <span className="text-xs text-muted-foreground uppercase font-medium">
            {mediaTypeLabel}
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium rounded-full",
              PRIORITY_COLORS[item.priority]
            )}
          >
            {PRIORITY_LABELS[item.priority]}
          </span>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <span className="hidden sm:inline text-xs text-muted-foreground">
            Added {formatAddedDate(item.createdAt)}
          </span>
          {item.url && (
            <>
              <span className="hidden sm:inline text-muted-foreground/40">
                •
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    item.url as string,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Link
              </Button>
            </>
          )}
        </div>
        {/* Notes preview on cards view */}
        {viewMode === "cards" && item.notes && (
          <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2">
            {item.notes}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-2">
        {/* Edit button */}
        <Button
          size="sm"
          variant="default"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="h-9 sm:h-8 px-4 sm:px-3 text-xs font-semibold"
        >
          Edit
        </Button>

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => e.stopPropagation()}
              className="h-9 sm:h-8 w-9 sm:w-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
              aria-label={`More options for ${item.title}`}
            >
              <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {item.url && (
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    item.url as string,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Link
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

export function WishlistView({
  isFullPage: _isFullPage = false,
}: WishlistViewProps) {
  // Data state
  const [items, setItems] = useState<DBWishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // UI state
  const [viewMode, setViewMode] = useState<LibraryViewMode>(getStoredViewMode);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(getStoredPageSize);
  const [search, setSearch] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<
    WishlistMediaType | "all"
  >(getStoredMediaTypeFilter);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DBWishlistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBWishlistItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<WishlistFormData>(defaultFormData);

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Persist preferences
  const handleViewModeChange = useCallback((mode: LibraryViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, String(newLimit));
  }, []);

  const handleMediaTypeFilterChange = useCallback(
    (value: WishlistMediaType | "all") => {
      setMediaTypeFilter(value);
      setPage(1);
      localStorage.setItem(MEDIA_TYPE_FILTER_KEY, value);
    },
    []
  );

  // Load wishlist
  const loadWishlist = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetchWishlistPaginated({
        page,
        limit,
        search: search || undefined,
        mediaType: mediaTypeFilter === "all" ? undefined : mediaTypeFilter,
      });
      setItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.totalItems);
    } catch (error) {
      console.error("[Wishlist] Failed to fetch:", error);
      toast.error("Failed to load wishlist");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, mediaTypeFilter]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Duplicate detection when title changes (debounced)
  useEffect(() => {
    if (!formData.title.trim() || editingItem) {
      setDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      try {
        const matches = await checkWishlistDuplicates(formData.title.trim());
        setDuplicates(matches);
      } catch (error) {
        console.error("[Wishlist] Failed to check duplicates:", error);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.title, editingItem]);

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingItem(null);
    setDuplicates([]);
    setShowDuplicateWarning(false);
  };

  const handleOpenDialog = (item?: DBWishlistItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        author: item.author || "",
        mediaType: item.mediaType,
        notes: item.notes || "",
        priority: item.priority,
        url: item.url || "",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }

    // Show duplicate warning if there are matches and user hasn't confirmed
    if (!editingItem && duplicates.length > 0 && !showDuplicateWarning) {
      setShowDuplicateWarning(true);
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateWishlistItem(editingItem.id, {
          title: trimmedTitle,
          author: formData.author.trim() || undefined,
          mediaType: formData.mediaType,
          notes: formData.notes.trim() || undefined,
          priority: formData.priority,
          url: formData.url.trim() || undefined,
        });
        toast.success("Wishlist item updated");
      } else {
        await createWishlistItem({
          title: trimmedTitle,
          author: formData.author.trim() || undefined,
          mediaType: formData.mediaType,
          notes: formData.notes.trim() || undefined,
          priority: formData.priority,
          url: formData.url.trim() || undefined,
        });
        toast.success("Added to wishlist");
      }
      handleCloseDialog();
      loadWishlist();
    } catch (error) {
      console.error("[Wishlist] Failed to save:", error);
      toast.error(editingItem ? "Failed to update item" : "Failed to add item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteWishlistItem(deleteTarget.id);
      toast.success("Removed from wishlist");
      setDeleteTarget(null);
      loadWishlist();
    } catch (error) {
      console.error("[Wishlist] Failed to delete:", error);
      toast.error("Failed to remove item");
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading skeleton
  if (isLoading && items.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col gap-4 mb-6 sm:mb-8">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <Skeleton className="h-10 flex-1 sm:max-w-md" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Content rendering based on view mode
  const renderContent = () => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
          <h2 className="text-lg font-medium mb-2">
            {search || mediaTypeFilter !== "all"
              ? "No matching items"
              : "Your wishlist is empty"}
          </h2>
          <p className="text-sm">
            {search || mediaTypeFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Add media you want to acquire in the future"}
          </p>
        </div>
      );
    }

    const containerClass =
      viewMode === "grid"
        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        : viewMode === "cards"
          ? "grid grid-cols-1 md:grid-cols-2 gap-4"
          : viewMode === "compact"
            ? "border border-border rounded-xl overflow-hidden divide-y divide-border"
            : "space-y-2";

    return (
      <div className={containerClass}>
        {items.map((item) => (
          <WishlistItemCard
            key={item.id}
            item={item}
            viewMode={viewMode}
            onEdit={() => handleOpenDialog(item)}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}
      </div>
    );
  };

  const itemWord = totalItems === 1 ? "item" : "items";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Wishlist
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {totalItems} {itemWord}
                  {search && ` matching "${search}"`}
                </p>
              </div>
            </div>

            {/* Search and view controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search wishlist..."
              />
              <div className="flex items-center gap-2">
                <MediaTypeFilter
                  value={mediaTypeFilter}
                  onChange={handleMediaTypeFilterChange}
                />
                <ViewModeSwitcher
                  currentMode={viewMode}
                  onChange={handleViewModeChange}
                />
              </div>
            </div>
          </div>

          {/* Add Item Card - matching upload/new folder pattern */}
          <div className="mb-6 sm:mb-8">
            <div
              className="border-2 border-dashed border-border rounded-xl p-4 sm:p-6 transition-colors hover:border-muted-foreground/40 cursor-pointer bg-card/50"
              onClick={() => handleOpenDialog()}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-semibold text-foreground">
                    Add to Wishlist
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Track books, audio, videos, or images you want to acquire
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="shrink-0 border-t border-border bg-popover/80 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-3 safe-area-inset-bottom">
        <div className="max-w-6xl mx-auto">
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={handleLimitChange}
          />
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookPlus className="w-4 h-4" />
              {editingItem ? "Edit Wishlist Item" : "Add to Wishlist"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the details for this item."
                : "Add media you want to acquire in the future."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wishlist-title">Title *</Label>
              <div className="relative">
                <Input
                  id="wishlist-title"
                  value={formData.title}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Auto-parse URL from pasted text (e.g., "Head First Go https://...")
                    const parsed = parseWishlistInput(value);

                    // If a URL was extracted and the URL field is currently empty, auto-fill it
                    if (parsed.url && !formData.url) {
                      setFormData({
                        ...formData,
                        title: parsed.title,
                        url: parsed.url,
                      });
                      // Show a subtle toast only if we actually extracted a URL
                      if (parsed.title !== value) {
                        toast.success("URL detected and extracted", {
                          duration: 2000,
                          icon: "🔗",
                        });
                      }
                    } else {
                      // Normal update - no URL detected or URL field already has a value
                      setFormData({ ...formData, title: value });
                    }
                    setShowDuplicateWarning(false);
                  }}
                  placeholder="Title or paste Title + URL"
                  disabled={isSaving}
                  autoFocus
                />
                {isCheckingDuplicates && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Duplicate warning */}
            {!editingItem && duplicates.length > 0 && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  showDuplicateWarning
                    ? "bg-amber-500/10 border-amber-500/50"
                    : "bg-muted/50"
                )}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={cn(
                      "w-4 h-4 shrink-0 mt-0.5",
                      showDuplicateWarning
                        ? "text-amber-500"
                        : "text-muted-foreground"
                    )}
                  />
                  <div className="space-y-1">
                    <p
                      className={
                        showDuplicateWarning
                          ? "font-medium text-amber-700 dark:text-amber-400"
                          : ""
                      }
                    >
                      {showDuplicateWarning
                        ? "Are you sure? Similar items already exist:"
                        : "Similar items found in your library:"}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {duplicates.slice(0, 3).map((match) => (
                        <li
                          key={`${match.type}-${match.id}`}
                          className="flex items-center gap-1"
                        >
                          {match.type === "book" && (
                            <BookOpen className="w-3 h-3" />
                          )}
                          {match.type === "audio" && (
                            <Music className="w-3 h-3" />
                          )}
                          {match.type === "video" && (
                            <Video className="w-3 h-3" />
                          )}
                          {match.type === "wishlist" && (
                            <ShoppingCart className="w-3 h-3" />
                          )}
                          <span className="truncate">{match.title}</span>
                          {match.type === "wishlist" && (
                            <span className="text-muted-foreground/60 text-[10px]">
                              (wishlist)
                            </span>
                          )}
                          {match.author && (
                            <span className="text-muted-foreground/60">
                              by {match.author}
                            </span>
                          )}
                        </li>
                      ))}
                      {duplicates.length > 3 && (
                        <li className="text-muted-foreground/60">
                          +{duplicates.length - 3} more...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="wishlist-type">Media Type</Label>
              <Select
                value={formData.mediaType}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    mediaType: v as WishlistMediaType,
                  })
                }
                disabled={isSaving}
              >
                <SelectTrigger id="wishlist-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="book">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5" />
                      Book
                    </div>
                  </SelectItem>
                  <SelectItem value="audio">
                    <div className="flex items-center gap-2">
                      <Music className="w-3.5 h-3.5" />
                      Audio
                    </div>
                  </SelectItem>
                  <SelectItem value="video">
                    <div className="flex items-center gap-2">
                      <Video className="w-3.5 h-3.5" />
                      Video
                    </div>
                  </SelectItem>
                  <SelectItem value="image">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Image
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wishlist-author">Author / Artist</Label>
              <Input
                id="wishlist-author"
                value={formData.author}
                onChange={(e) =>
                  setFormData({ ...formData, author: e.target.value })
                }
                placeholder="Author or artist name"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wishlist-priority">Priority</Label>
              <Select
                value={String(formData.priority)}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    priority: Number(v) as WishlistPriority,
                  })
                }
                disabled={isSaving}
              >
                <SelectTrigger id="wishlist-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">
                    <div className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                      High Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="1">
                    <div className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      Medium Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="0">
                    <div className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 text-slate-400" />
                      Low Priority
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wishlist-url">
                URL{" "}
                {formData.url ? "" : "(optional — or paste with title above)"}
              </Label>
              <Input
                id="wishlist-url"
                type="url"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
                placeholder="https://example.com/item"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wishlist-notes">Notes</Label>
              <Input
                id="wishlist-notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Why you want this..."
                disabled={isSaving}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !formData.title.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editingItem ? "Updating..." : "Adding..."}
                  </>
                ) : showDuplicateWarning ? (
                  "Add Anyway"
                ) : editingItem ? (
                  "Update"
                ) : (
                  "Add to Wishlist"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from wishlist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &ldquo;{deleteTarget?.title}&rdquo; from your
              wishlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
