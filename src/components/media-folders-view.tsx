import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Folder,
  FolderPlus,
  MoreVertical,
  Edit,
  Trash2,
  BookOpen,
  Music,
  Video,
  ArrowLeft,
  FileText,
  Play,
  X,
  Save,
  Filter,
  ChevronDown,
  Upload,
  ImageIcon,
  Clipboard,
  Plus,
  HardDrive,
  Calendar,
  Star,
  Download,
  Heart,
  Bookmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuSeparator,
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
import { Progress } from "@/components/ui/progress";
import {
  fetchMediaFoldersPaginated,
  createMediaFolder,
  updateMediaFolder,
  deleteMediaFolder,
  fetchMediaFolderItemsPaginated,
  removeItemFromMediaFolder,
  getAudioStreamUrl,
  getVideoStreamUrl,
  getDownloadUrl,
  uploadMediaFolderCover,
  toggleBookFavorite,
  toggleAudioFavorite,
  toggleVideoFavorite,
  searchFolderItemsGlobally,
} from "@/lib/api/client";
import { BookCover } from "@/components/book-cover";
import { AudioCover } from "@/components/audio-cover";
import { VideoCover } from "@/components/video-cover";
import { FolderCover } from "@/components/folder-cover";
import { FolderUpload } from "@/components/folder-upload";
import { MembershipBadge } from "@/components/membership-badge";
import { AddToFolderModal } from "@/components/add-to-folder-modal";
import {
  SearchInput,
  PaginationControls,
  ViewModeSwitcher,
} from "@/components/library";
import type {
  DBMediaFolder,
  DBMediaFolderItemWithDetails,
  DBBook,
  DBAudioTrack,
  DBVideoTrack,
  BookFormat,
  LibraryViewMode,
} from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Dynamically import markdown editor to avoid SSR issues
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  { ssr: false }
);

// LocalStorage keys for persistent preferences
const PAGE_SIZE_KEY = "bookish-library-page-size";
const FOLDERS_VIEW_MODE_KEY = "bookish-folders-view-mode";
const FOLDER_ITEMS_VIEW_MODE_KEY = "bookish-folder-items-view-mode";

function getStoredPageSize(): number {
  if (typeof window === "undefined") return 20;
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 20;
}

function getStoredFoldersViewMode(): LibraryViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(FOLDERS_VIEW_MODE_KEY);
  if (stored && ["list", "grid", "cards", "compact"].includes(stored)) {
    return stored as LibraryViewMode;
  }
  return "list";
}

function getStoredItemsViewMode(): LibraryViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(FOLDER_ITEMS_VIEW_MODE_KEY);
  if (stored && ["list", "grid", "cards", "compact"].includes(stored)) {
    return stored as LibraryViewMode;
  }
  return "list";
}

interface MediaFoldersViewProps {
  /** Callback when user wants to read a book */
  onReadBook?: (book: DBBook) => void;
  /** Callback when user wants to play an audio track */
  onPlayTrack?: (
    track: DBAudioTrack,
    streamUrl: string,
    queue?: DBAudioTrack[],
    index?: number
  ) => void;
  /** Callback when user wants to play a video */
  onPlayVideo?: (video: DBVideoTrack, streamUrl: string) => void;
}

export function MediaFoldersView({
  onReadBook,
  onPlayTrack,
  onPlayVideo,
}: MediaFoldersViewProps) {
  const [folders, setFolders] = useState<DBMediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<DBMediaFolder | null>(
    null
  );
  const [folderItems, setFolderItems] = useState<
    DBMediaFolderItemWithDetails[]
  >([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Search for folders
  const [search, setSearch] = useState("");

  // Search for items within a folder
  const [itemsSearch, setItemsSearch] = useState("");

  // Global search results (items across all folders)
  const [globalSearchResults, setGlobalSearchResults] = useState<
    DBMediaFolderItemWithDetails[]
  >([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchPage, setGlobalSearchPage] = useState(1);
  const [globalSearchTotalPages, setGlobalSearchTotalPages] = useState(1);
  const [globalSearchTotalCount, setGlobalSearchTotalCount] = useState(0);

  // Pagination for folder items
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);
  const [itemsTotalCount, setItemsTotalCount] = useState(0);
  const [itemsLimit, setItemsLimit] = useState(getStoredPageSize);

  // Pagination for folders list
  const [foldersPage, setFoldersPage] = useState(1);
  const [foldersTotalPages, setFoldersTotalPages] = useState(1);
  const [foldersTotalCount, setFoldersTotalCount] = useState(0);
  const [foldersLimit, setFoldersLimit] = useState(getStoredPageSize);

  // Filter by item type
  const [filterType, setFilterType] = useState<
    "all" | "book" | "audio" | "video"
  >("all");

  // View mode for folder items (persisted)
  const [itemViewMode, setItemViewMode] = useState<LibraryViewMode>(
    getStoredItemsViewMode
  );

  // View mode for folders list (persisted)
  const [foldersViewMode, setFoldersViewMode] = useState<LibraryViewMode>(
    getStoredFoldersViewMode
  );

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editFolder, setEditFolder] = useState<DBMediaFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBMediaFolder | null>(null);
  const [removeItemTarget, setRemoveItemTarget] =
    useState<DBMediaFolderItemWithDetails | null>(null);
  const [addToFolderTarget, setAddToFolderTarget] =
    useState<DBMediaFolderItemWithDetails | null>(null);

  // View mode change handlers (persist to localStorage)
  const handleFoldersViewModeChange = useCallback((mode: LibraryViewMode) => {
    setFoldersViewMode(mode);
    localStorage.setItem(FOLDERS_VIEW_MODE_KEY, mode);
  }, []);

  const handleItemsViewModeChange = useCallback((mode: LibraryViewMode) => {
    setItemViewMode(mode);
    localStorage.setItem(FOLDER_ITEMS_VIEW_MODE_KEY, mode);
  }, []);

  // Page size change handlers (persist to localStorage)
  const handleFoldersLimitChange = useCallback((newLimit: number) => {
    setFoldersLimit(newLimit);
    setFoldersPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, String(newLimit));
  }, []);

  const handleItemsLimitChange = useCallback((newLimit: number) => {
    setItemsLimit(newLimit);
    setItemsPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, String(newLimit));
  }, []);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Cover image state for edit modal
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [maxCoverSizeMB, setMaxCoverSizeMB] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const maxCoverSize = maxCoverSizeMB * 1024 * 1024;

  // Fetch cover max size from settings
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((settings) => {
        if (settings.cover?.maxSizeMB) {
          setMaxCoverSizeMB(settings.cover.maxSizeMB);
        }
      })
      .catch(() => {});
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchMediaFoldersPaginated({
        page: foldersPage,
        limit: foldersLimit,
        search: search || undefined,
        sortBy: "name",
        sortOrder: "asc",
      });
      setFolders(result.data);
      setFoldersPage(result.pagination.page);
      setFoldersTotalPages(result.pagination.totalPages);
      setFoldersTotalCount(result.pagination.totalItems);
    } catch (error) {
      console.error("Failed to load folders:", error);
      toast.error("Failed to load media folders");
    } finally {
      setLoading(false);
    }
  }, [foldersPage, foldersLimit, search]);

  const loadFolderItems = useCallback(
    async (folderId: string) => {
      try {
        setLoadingItems(true);
        const result = await fetchMediaFolderItemsPaginated(folderId, {
          page: itemsPage,
          limit: itemsLimit,
          itemType: filterType === "all" ? undefined : filterType,
          search: itemsSearch || undefined,
        });
        setFolderItems(result.data);
        setItemsPage(result.pagination.page);
        setItemsTotalPages(result.pagination.totalPages);
        setItemsTotalCount(result.pagination.totalItems);
      } catch (error) {
        console.error("Failed to load folder items:", error);
        toast.error("Failed to load folder contents");
      } finally {
        setLoadingItems(false);
      }
    },
    [itemsPage, itemsLimit, filterType, itemsSearch]
  );

  // Search items across all folders (global search)
  const searchItemsGlobally = useCallback(async () => {
    if (!search.trim()) {
      setGlobalSearchResults([]);
      setGlobalSearchTotalCount(0);
      setGlobalSearchTotalPages(1);
      return;
    }
    try {
      setGlobalSearchLoading(true);
      const result = await searchFolderItemsGlobally({
        search: search.trim(),
        page: globalSearchPage,
        limit: foldersLimit, // Use same limit as folders
      });
      setGlobalSearchResults(result.data);
      setGlobalSearchPage(result.pagination.page);
      setGlobalSearchTotalPages(result.pagination.totalPages);
      setGlobalSearchTotalCount(result.pagination.totalItems);
    } catch (error) {
      console.error("Failed to search items:", error);
      // Don't show toast - silent fail for global search
    } finally {
      setGlobalSearchLoading(false);
    }
  }, [search, globalSearchPage, foldersLimit]);

  // Load folders when dependencies change
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Search items globally when search changes (only when not in a folder)
  useEffect(() => {
    if (!selectedFolder) {
      searchItemsGlobally();
    }
  }, [selectedFolder, searchItemsGlobally]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setFoldersPage(1);
    setGlobalSearchPage(1);
  }, [search]);

  // Reset to page 1 when items search changes
  useEffect(() => {
    setItemsPage(1);
  }, [itemsSearch]);

  useEffect(() => {
    if (selectedFolder) {
      loadFolderItems(selectedFolder.id);
    } else {
      setFolderItems([]);
      setItemsTotalPages(1);
      setItemsTotalCount(0);
    }
  }, [selectedFolder, loadFolderItems]);

  // Reload when filter type changes
  useEffect(() => {
    if (selectedFolder) {
      setItemsPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleCreateFolder = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSaving(true);
    try {
      await createMediaFolder({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      });
      toast.success("Folder created");
      setShowCreateModal(false);
      setFormName("");
      setFormDescription("");
      // Reset to first page and reload to show the new folder
      setFoldersPage(1);
      // Force reload the folders list
      await loadFolders();
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast.error("Failed to create folder");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateFolder = async () => {
    if (!editFolder || !formName.trim()) return;
    setIsSaving(true);
    try {
      let newCoverUrl: string | undefined = undefined;

      // Handle cover upload
      if (coverFile) {
        setIsUploadingCover(true);
        try {
          const s3Key = await uploadMediaFolderCover(editFolder.id, coverFile);
          newCoverUrl = s3Key;
        } catch (error) {
          console.error("[MediaFolders] Failed to upload cover:", error);
          toast.error("Failed to upload cover image");
          setIsUploadingCover(false);
          setIsSaving(false);
          return;
        }
        setIsUploadingCover(false);
      } else if (removeCover) {
        newCoverUrl = "";
      }

      const updated = await updateMediaFolder(editFolder.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        ...(newCoverUrl !== undefined && {
          coverUrl: newCoverUrl || undefined,
        }),
      });

      // Force reload to get fresh data including cover URL
      await loadFolders();

      if (selectedFolder?.id === updated.id) {
        setSelectedFolder(updated);
      }
      toast.success("Folder updated");
      setEditFolder(null);
      setFormName("");
      setFormDescription("");
      setCoverFile(null);
      setCoverPreview(null);
      setExistingCoverUrl(null);
      setRemoveCover(false);
    } catch (error) {
      console.error("Failed to update folder:", error);
      toast.error("Failed to update folder");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMediaFolder(deleteTarget.id);
      if (selectedFolder?.id === deleteTarget.id) {
        setSelectedFolder(null);
      }
      toast.success("Folder deleted");
      setDeleteTarget(null);
      // Go back a page if this was the last item on the page
      if (folders.length === 1 && foldersPage > 1) {
        setFoldersPage(foldersPage - 1);
      } else {
        // Force reload by toggling a dependency
        loadFolders();
      }
    } catch (error) {
      console.error("Failed to delete folder:", error);
      toast.error("Failed to delete folder");
    }
  };

  const openEditModal = (folder: DBMediaFolder) => {
    setEditFolder(folder);
    setFormName(folder.name);
    setFormDescription(folder.description || "");
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(false);

    // Load existing cover
    if (folder.coverUrl) {
      if (folder.coverUrl.startsWith("folder-covers/")) {
        getDownloadUrl(folder.coverUrl)
          .then(({ downloadUrl }) => setExistingCoverUrl(downloadUrl))
          .catch(() => setExistingCoverUrl(null));
      } else {
        setExistingCoverUrl(folder.coverUrl);
      }
    } else {
      setExistingCoverUrl(null);
    }
  };

  // Cover image handlers for edit modal
  const processImageFile = useCallback(
    (file: File) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("Invalid file type", {
          description: "Please select a JPEG, PNG, WebP, or GIF image.",
        });
        return;
      }

      if (file.size > maxCoverSize) {
        toast.error("File too large", {
          description: `Cover image must be less than ${maxCoverSizeMB}MB.`,
        });
        return;
      }

      setCoverFile(file);
      setRemoveCover(false);

      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [maxCoverSize, maxCoverSizeMB, ALLOWED_IMAGE_TYPES]
  );

  const handleCoverFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processImageFile(file);
    },
    [processImageFile]
  );

  const handleRemoveCover = useCallback(() => {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Global paste handler for cover image (only when edit modal is open)
  useEffect(() => {
    if (!editFolder) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processImageFile(file);
            toast.success("Image pasted from clipboard");
          }
          return;
        }
      }
    };

    document.addEventListener("paste", handleGlobalPaste);
    return () => document.removeEventListener("paste", handleGlobalPaste);
  }, [editFolder, processImageFile]);

  const getItemIcon = (type: string) => {
    switch (type) {
      case "book":
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      case "audio":
        return <Music className="w-4 h-4 text-violet-500" />;
      case "video":
        return <Video className="w-4 h-4 text-rose-500" />;
      default:
        return null;
    }
  };

  // Handle clicking on an item to play/read it
  const handleItemClick = async (item: DBMediaFolderItemWithDetails) => {
    try {
      if (item.itemType === "book" && onReadBook) {
        toast.loading("Loading book...");
        try {
          // Fetch full book info
          const response = await fetch(`/api/books/${item.itemId}`);
          if (!response.ok) throw new Error("Failed to load book");
          const book: DBBook = await response.json();
          toast.dismiss();
          onReadBook(book);
        } catch {
          toast.dismiss();
          toast.error("Failed to open book");
        }
      } else if (item.itemType === "audio" && onPlayTrack) {
        // Get the stream URL and play
        // We need to fetch the s3Key... for now we construct a minimal track
        // The API needs the s3Key, so we'll use itemId to call a simpler endpoint
        toast.loading("Loading audio...");
        try {
          // Fetch full audio track info to get s3Key
          const response = await fetch(`/api/audio/${item.itemId}`);
          if (!response.ok) throw new Error("Failed to load audio");
          const track: DBAudioTrack = await response.json();
          const streamUrl = await getAudioStreamUrl(track.s3Key);
          toast.dismiss();
          // Get all audio items in folder for queue
          const audioItems = folderItems.filter((i) => i.itemType === "audio");
          const idx = audioItems.findIndex((i) => i.itemId === item.itemId);
          // Build queue of audio tracks
          const queuePromises = audioItems.map(async (ai) => {
            const res = await fetch(`/api/audio/${ai.itemId}`);
            return res.json() as Promise<DBAudioTrack>;
          });
          const queue = await Promise.all(queuePromises);
          onPlayTrack(track, streamUrl, queue, idx);
        } catch {
          toast.dismiss();
          toast.error("Failed to play audio");
        }
      } else if (item.itemType === "video" && onPlayVideo) {
        toast.loading("Loading video...");
        try {
          // Fetch full video track info to get s3Key
          const response = await fetch(`/api/video/${item.itemId}`);
          if (!response.ok) throw new Error("Failed to load video");
          const video: DBVideoTrack = await response.json();
          const streamUrl = await getVideoStreamUrl(video.s3Key);
          toast.dismiss();
          onPlayVideo(video, streamUrl);
        } catch {
          toast.dismiss();
          toast.error("Failed to play video");
        }
      } else {
        toast.error("No player available for this media type");
      }
    } catch (error) {
      console.error("Failed to open item:", error);
      toast.error("Failed to open item");
    }
  };

  // Handle removing an item from folder
  const handleRemoveItem = async () => {
    if (!removeItemTarget || !selectedFolder) return;
    try {
      await removeItemFromMediaFolder(
        selectedFolder.id,
        removeItemTarget.itemId,
        removeItemTarget.itemType
      );
      setFolderItems((prev) =>
        prev.filter((i) => i.id !== removeItemTarget.id)
      );
      // Update folder item count
      setFolders((prev) =>
        prev.map((f) =>
          f.id === selectedFolder.id && f.itemCount
            ? { ...f, itemCount: f.itemCount - 1 }
            : f
        )
      );
      if (selectedFolder.itemCount) {
        setSelectedFolder({
          ...selectedFolder,
          itemCount: selectedFolder.itemCount - 1,
        });
      }
      toast.success("Item removed from folder");
      setRemoveItemTarget(null);
    } catch (error) {
      console.error("Failed to remove item:", error);
      toast.error("Failed to remove item");
    }
  };

  // Handle toggling favorite for an item
  const handleToggleFavorite = useCallback(
    async (item: DBMediaFolderItemWithDetails) => {
      const newFavorite = !item.itemIsFavorite;
      try {
        if (item.itemType === "book") {
          await toggleBookFavorite(item.itemId, newFavorite);
        } else if (item.itemType === "audio") {
          await toggleAudioFavorite(item.itemId, newFavorite);
        } else if (item.itemType === "video") {
          await toggleVideoFavorite(item.itemId, newFavorite);
        }
        // Update local state
        setFolderItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, itemIsFavorite: newFavorite } : i
          )
        );
        toast.success(
          newFavorite ? "Added to favorites" : "Removed from favorites"
        );
      } catch (error) {
        console.error("Failed to toggle favorite:", error);
        toast.error("Failed to update favorite");
      }
    },
    []
  );

  // Handle selecting a folder - clears items search
  const handleSelectFolder = useCallback((folder: DBMediaFolder | null) => {
    setItemsSearch("");
    setItemsPage(1);
    setSelectedFolder(folder);
  }, []);

  // Handle downloading an item
  const handleDownloadItem = useCallback(
    async (item: DBMediaFolderItemWithDetails) => {
      if (!item.itemS3Key) {
        toast.error("Download not available");
        return;
      }
      try {
        toast.info("Preparing download...");
        const { downloadUrl } = await getDownloadUrl(item.itemS3Key);
        const link = document.createElement("a");
        link.href = downloadUrl;
        const safeTitle = (item.itemTitle || "file")
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .trim();
        link.download = `${safeTitle}.${item.itemFormat || "file"}`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Download started");
      } catch (error) {
        console.error("Failed to download:", error);
        toast.error("Failed to download");
      }
    },
    []
  );

  // Handle saving notes
  const handleSaveNotes = async () => {
    if (!selectedFolder) return;
    setSavingNotes(true);
    try {
      const updated = await updateMediaFolder(selectedFolder.id, {
        description: notesContent,
      });
      setSelectedFolder(updated);
      setFolders((prev) =>
        prev.map((f) => (f.id === updated.id ? updated : f))
      );
      setEditingNotes(false);
      toast.success("Notes saved");
    } catch (error) {
      console.error("Failed to save notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  // Start editing notes
  const startEditingNotes = () => {
    setNotesContent(selectedFolder?.description || "");
    setNotesExpanded(true);
    setEditingNotes(true);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Header - changes based on whether we're viewing folder list or folder detail */}
          {!selectedFolder ? (
            <>
              {/* Folders List Header */}
              <div className="flex flex-col gap-4 mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                      Media Folders
                    </h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                      {foldersTotalCount} folder
                      {foldersTotalCount !== 1 ? "s" : ""}
                      {search && ` matching "${search}"`}
                    </p>
                  </div>
                </div>

                {/* Search and view controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search folders..."
                  />
                  <ViewModeSwitcher
                    currentMode={foldersViewMode}
                    onChange={handleFoldersViewModeChange}
                  />
                </div>
              </div>

              {/* New Folder Button - matching upload section pattern */}
              <div className="mb-6 sm:mb-8">
                <div
                  className="border-2 border-dashed border-border rounded-xl p-4 sm:p-6 transition-colors hover:border-muted-foreground/40 cursor-pointer bg-card/50"
                  onClick={() => setShowCreateModal(true)}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-semibold text-foreground">
                        New Folder
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Create a folder to organize your books, audio, and
                        videos
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Global Search Results - Items matching search across all folders */}
              {search.trim() && (
                <div className="mb-6 sm:mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-foreground">
                      Items in Folders
                      {globalSearchTotalCount > 0 && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {globalSearchTotalCount} matching "{search}"
                        </span>
                      )}
                    </h3>
                  </div>

                  {globalSearchLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : globalSearchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                      No items found matching "{search}" in any folder
                    </p>
                  ) : (
                    <>
                      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                        {globalSearchResults.map((item) => (
                          <div
                            key={item.id}
                            className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/30"
                          >
                            {/* Item cover */}
                            <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                              {item.itemType === "book" && (
                                <BookCover
                                  coverUrl={item.itemCoverUrl}
                                  format={item.itemFormat as BookFormat}
                                  title={item.itemTitle || "Book"}
                                  className="w-full h-full"
                                />
                              )}
                              {item.itemType === "audio" && (
                                <AudioCover
                                  coverUrl={item.itemCoverUrl}
                                  title={item.itemTitle || "Audio"}
                                  className="w-full h-full"
                                />
                              )}
                              {item.itemType === "video" && (
                                <VideoCover
                                  coverUrl={item.itemCoverUrl}
                                  title={item.itemTitle || "Video"}
                                  className="w-full h-full"
                                />
                              )}
                            </div>

                            {/* Item info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {getItemIcon(item.itemType)}
                                <span className="text-sm font-medium truncate">
                                  {item.itemTitle || "Untitled"}
                                </span>
                                {item.itemIsFavorite && (
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate">
                                  {item.folderName && (
                                    <>
                                      <Folder className="w-3 h-3 inline mr-1" />
                                      {item.folderName}
                                    </>
                                  )}
                                </span>
                                {item.itemAuthor && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">
                                      {item.itemAuthor}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Type badge */}
                            <span className="text-xs uppercase text-muted-foreground shrink-0">
                              {item.itemType}
                            </span>

                            {/* Open Folder button */}
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                // Find the folder and open it
                                const folder = folders.find(
                                  (f) => f.id === item.folderId
                                );
                                if (folder) {
                                  handleSelectFolder(folder);
                                } else {
                                  // Folder not in current list, fetch and open
                                  fetch(`/api/media-folders/${item.folderId}`)
                                    .then((res) => res.json())
                                    .then((folder) => {
                                      if (folder && folder.id) {
                                        handleSelectFolder(folder);
                                      }
                                    })
                                    .catch(() => {
                                      toast.error("Failed to open folder");
                                    });
                                }
                              }}
                              className="h-8 px-3 text-xs font-semibold shrink-0"
                            >
                              Open Folder
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Pagination for global search results */}
                      {globalSearchTotalPages > 1 && (
                        <div className="mt-4">
                          <PaginationControls
                            currentPage={globalSearchPage}
                            totalPages={globalSearchTotalPages}
                            onPageChange={setGlobalSearchPage}
                            limit={foldersLimit}
                            onLimitChange={handleFoldersLimitChange}
                            totalItems={globalSearchTotalCount}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Folder Detail Header */
            <div className="space-y-6">
              {/* Header with back button and folder info */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      handleSelectFolder(null);
                      setEditingNotes(false);
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {selectedFolder.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {itemsTotalCount} item
                      {itemsTotalCount !== 1 ? "s" : ""}
                      {itemsSearch && ` matching "${itemsSearch}"`}
                    </p>
                  </div>
                </div>

                {/* Search and view controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <SearchInput
                    value={itemsSearch}
                    onChange={setItemsSearch}
                    placeholder="Search items..."
                  />
                  <ViewModeSwitcher
                    currentMode={itemViewMode}
                    onChange={handleItemsViewModeChange}
                  />
                </div>
              </div>

              {/* Notes Section - Collapsible */}
              <div className="rounded-lg border bg-card overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left"
                  onClick={() => {
                    if (!editingNotes) {
                      setNotesExpanded(!notesExpanded);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Folder Notes</span>
                    {!notesExpanded && selectedFolder.description && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (click to expand)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingNotes ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNotes(false);
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveNotes();
                          }}
                          disabled={savingNotes}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {savingNotes ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingNotes();
                          }}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <div
                          className={`p-1.5 rounded-full bg-muted hover:bg-accent transition-all ${
                            notesExpanded ? "rotate-180" : ""
                          }`}
                        >
                          <ChevronDown className="w-4 h-4 text-foreground" />
                        </div>
                      </>
                    )}
                  </div>
                </button>
                {(notesExpanded || editingNotes) && (
                  <div className="p-4 border-t" data-color-mode="auto">
                    {editingNotes ? (
                      <MDEditor
                        value={notesContent}
                        onChange={(val) => setNotesContent(val || "")}
                        preview="edit"
                        height={200}
                        textareaProps={{
                          placeholder:
                            "Write notes about this folder... (Markdown supported)",
                        }}
                      />
                    ) : selectedFolder.description ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MDPreview source={selectedFolder.description} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No notes yet. Click Edit to add notes.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Filter Bar & Item Count */}
              <div className="flex flex-col gap-3 mb-4">
                {/* Upload Button - full width on mobile */}
                <FolderUpload
                  folderId={selectedFolder.id}
                  onItemAdded={() => loadFolderItems(selectedFolder.id)}
                  compact
                />

                {/* Filters and count row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <Button
                        variant={filterType === "all" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setFilterType("all")}
                      >
                        All
                      </Button>
                      <Button
                        variant={filterType === "book" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setFilterType("book")}
                      >
                        <BookOpen className="w-3 h-3 mr-1" />
                        Books
                      </Button>
                      <Button
                        variant={filterType === "audio" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setFilterType("audio")}
                      >
                        <Music className="w-3 h-3 mr-1" />
                        Audio
                      </Button>
                      <Button
                        variant={filterType === "video" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setFilterType("video")}
                      >
                        <Video className="w-3 h-3 mr-1" />
                        Video
                      </Button>
                    </div>
                  </div>
                  {itemsTotalCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Showing {(itemsPage - 1) * itemsLimit + 1}-
                      {Math.min(itemsPage * itemsLimit, itemsTotalCount)} of{" "}
                      {itemsTotalCount} items
                    </p>
                  )}
                </div>
              </div>

              {/* Folder Items */}
              {loadingItems ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="aspect-3/4 rounded-lg" />
                  ))}
                </div>
              ) : folderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 border-2 border-dashed rounded-xl bg-card/50">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground mb-1">
                    This folder is empty
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                    Upload files directly or add existing items from your
                    library.
                  </p>
                  <FolderUpload
                    folderId={selectedFolder.id}
                    onItemAdded={() => loadFolderItems(selectedFolder.id)}
                  />
                </div>
              ) : itemViewMode === "grid" ? (
                /* Grid View - matching audio-grid style */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {folderItems.map((item) => {
                    const progress =
                      item.itemProgress && item.itemTotal && item.itemTotal > 0
                        ? Math.round((item.itemProgress / item.itemTotal) * 100)
                        : 0;

                    return (
                      <article
                        key={item.id}
                        role="listitem"
                        className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
                        onClick={() => handleItemClick(item)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleItemClick(item);
                          }
                        }}
                      >
                        {/* Cover - fixed height like audio-grid */}
                        <div className="relative h-32">
                          {item.itemType === "book" && (
                            <BookCover
                              coverUrl={item.itemCoverUrl}
                              format={(item.itemFormat as BookFormat) || "pdf"}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-12 h-12"
                            />
                          )}
                          {item.itemType === "audio" && (
                            <AudioCover
                              coverUrl={item.itemCoverUrl}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-12 h-12"
                            />
                          )}
                          {item.itemType === "video" && (
                            <VideoCover
                              coverUrl={item.itemCoverUrl}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-12 h-12"
                            />
                          )}

                          {/* Favorite star */}
                          {item.itemIsFavorite && (
                            <div className="absolute top-2 left-2">
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            </div>
                          )}

                          {/* Top right: membership + dropdown */}
                          <div className="absolute top-2 right-2 flex gap-1 z-10">
                            {(item.itemFolderCount ?? 0) > 1 && (
                              <MembershipBadge
                                folderCount={item.itemFolderCount}
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
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(item);
                                  }}
                                >
                                  <Star
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      item.itemIsFavorite &&
                                        "fill-amber-500 text-amber-500"
                                    )}
                                  />
                                  {item.itemIsFavorite
                                    ? "Remove from Favorites"
                                    : "Add to Favorites"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadItem(item);
                                  }}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddToFolderTarget(item);
                                  }}
                                >
                                  <FolderPlus className="mr-2 h-4 w-4" />
                                  Add to Folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemoveItemTarget(item);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove from Folder
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Play
                              className="h-10 w-10 text-white"
                              fill="white"
                            />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 flex flex-col">
                          <h3
                            className="font-semibold text-sm truncate"
                            title={item.itemTitle || "Untitled"}
                          >
                            {item.itemTitle || "Untitled"}
                          </h3>
                          {item.itemAuthor && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {item.itemAuthor}
                            </p>
                          )}

                          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {getItemIcon(item.itemType)}
                              <span className="uppercase">{item.itemType}</span>
                            </span>
                            {(item.itemBookmarksCount ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <Bookmark className="w-3 h-3" />
                                {item.itemBookmarksCount}
                              </span>
                            )}
                          </div>

                          {/* Progress */}
                          <div className="mt-auto pt-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-muted-foreground">
                                {item.itemFormat?.toUpperCase() || ""}
                              </span>
                              <span className="text-[10px] font-medium">
                                {progress}%
                              </span>
                            </div>
                            <Progress value={progress} className="h-1" />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : itemViewMode === "list" ? (
                /* List View - matching BookTable style */
                <div
                  className="space-y-2 sm:space-y-3"
                  role="list"
                  aria-label="Items in folder"
                >
                  {folderItems.map((item) => {
                    const progress =
                      item.itemProgress && item.itemTotal && item.itemTotal > 0
                        ? Math.round((item.itemProgress / item.itemTotal) * 100)
                        : 0;

                    return (
                      <article
                        key={item.id}
                        role="listitem"
                        className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-border hover:border-muted-foreground/30 active:bg-secondary/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                        onClick={() => handleItemClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleItemClick(item);
                          }
                        }}
                        tabIndex={0}
                      >
                        {/* Cover thumbnail - hidden on mobile */}
                        <div className="w-12 h-12 rounded-lg shrink-0 hidden sm:flex overflow-hidden">
                          {item.itemType === "book" && (
                            <BookCover
                              coverUrl={item.itemCoverUrl}
                              format={(item.itemFormat as BookFormat) || "pdf"}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-5 h-5"
                            />
                          )}
                          {item.itemType === "audio" && (
                            <AudioCover
                              coverUrl={item.itemCoverUrl}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-5 h-5"
                            />
                          )}
                          {item.itemType === "video" && (
                            <VideoCover
                              coverUrl={item.itemCoverUrl}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-5 h-5"
                            />
                          )}
                        </div>

                        {/* Item info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-foreground truncate pr-2 flex items-center gap-1.5">
                            {getItemIcon(item.itemType)}
                            {item.itemIsFavorite && (
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                            {(item.itemFolderCount ?? 0) > 1 && (
                              <MembershipBadge
                                folderCount={item.itemFolderCount}
                                size="sm"
                                className="shrink-0"
                              />
                            )}
                            <span className="truncate">
                              {item.itemTitle || "Untitled"}
                            </span>
                          </h3>
                          {item.itemAuthor && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {item.itemAuthor}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            <span className="text-xs text-muted-foreground uppercase font-medium">
                              {item.itemType.toUpperCase()}
                            </span>
                            {item.itemFormat && (
                              <>
                                <span className="text-muted-foreground/40">
                                  •
                                </span>
                                <span className="text-xs text-muted-foreground uppercase">
                                  {item.itemFormat}
                                </span>
                              </>
                            )}
                            {(item.itemBookmarksCount ?? 0) > 0 && (
                              <>
                                <span className="text-muted-foreground/40">
                                  •
                                </span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Bookmark className="w-3 h-3" />
                                  {item.itemBookmarksCount}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                          {/* Progress bar */}
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-initial sm:w-32">
                            <div
                              className="flex-1 sm:flex-initial sm:w-20 h-1.5 sm:h-1 bg-secondary rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Progress: ${progress}%`}
                            >
                              <div
                                className="h-full bg-foreground/70 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground w-8 text-right">
                              {progress}%
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                              className="h-9 sm:h-8 px-4 sm:px-3 text-xs font-semibold"
                            >
                              {item.itemType === "book"
                                ? "Read"
                                : item.itemType === "audio"
                                  ? "Play"
                                  : "Watch"}
                            </Button>

                            {/* More actions dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-9 sm:h-8 w-9 sm:w-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                                  aria-label={`More options for ${item.itemTitle}`}
                                >
                                  <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onClick={() => handleToggleFavorite(item)}
                                >
                                  <Star
                                    className={cn(
                                      "w-4 h-4 mr-2",
                                      item.itemIsFavorite &&
                                        "fill-amber-500 text-amber-500"
                                    )}
                                  />
                                  {item.itemIsFavorite
                                    ? "Remove from Favorites"
                                    : "Add to Favorites"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDownloadItem(item)}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setAddToFolderTarget(item)}
                                >
                                  <FolderPlus className="w-4 h-4 mr-2" />
                                  Add to Folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setRemoveItemTarget(item)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove from Folder
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : itemViewMode === "cards" ? (
                /* Cards View - matching book-cards style */
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  role="list"
                >
                  {folderItems.map((item) => {
                    const progress =
                      item.itemProgress && item.itemTotal && item.itemTotal > 0
                        ? Math.round((item.itemProgress / item.itemTotal) * 100)
                        : 0;

                    return (
                      <article
                        key={item.id}
                        role="listitem"
                        className="group flex bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
                        onClick={() => handleItemClick(item)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleItemClick(item);
                          }
                        }}
                      >
                        {/* Cover side */}
                        <div className="w-24 sm:w-32 shrink-0 relative">
                          {item.itemType === "book" && (
                            <BookCover
                              coverUrl={item.itemCoverUrl}
                              format={(item.itemFormat as BookFormat) || "pdf"}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-10 h-10"
                            />
                          )}
                          {item.itemType === "audio" && (
                            <AudioCover
                              coverUrl={item.itemCoverUrl}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-10 h-10"
                            />
                          )}
                          {item.itemType === "video" && (
                            <VideoCover
                              coverUrl={item.itemCoverUrl}
                              title={item.itemTitle || "Untitled"}
                              className="w-full h-full"
                              iconClassName="w-10 h-10"
                            />
                          )}
                          {item.itemIsFavorite && (
                            <div className="absolute top-2 left-2">
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            </div>
                          )}
                          {(item.itemFolderCount ?? 0) > 1 && (
                            <MembershipBadge
                              folderCount={item.itemFolderCount}
                              className="absolute top-2 right-2"
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 flex flex-col min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3
                                className="font-semibold text-sm truncate"
                                title={item.itemTitle || "Untitled"}
                              >
                                {item.itemTitle || "Untitled"}
                              </h3>
                              {item.itemAuthor && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {item.itemAuthor}
                                </p>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 shrink-0 -mr-2 -mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(item);
                                  }}
                                >
                                  <Star
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      item.itemIsFavorite &&
                                        "fill-amber-500 text-amber-500"
                                    )}
                                  />
                                  {item.itemIsFavorite
                                    ? "Remove from Favorites"
                                    : "Add to Favorites"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadItem(item);
                                  }}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddToFolderTarget(item);
                                  }}
                                >
                                  <FolderPlus className="mr-2 h-4 w-4" />
                                  Add to Folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemoveItemTarget(item);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove from Folder
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Meta info */}
                          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            {getItemIcon(item.itemType)}
                            <span className="uppercase">{item.itemType}</span>
                            {item.itemFormat && (
                              <>
                                <span className="text-muted-foreground/40">
                                  •
                                </span>
                                <span className="uppercase">
                                  {item.itemFormat}
                                </span>
                              </>
                            )}
                            {(item.itemBookmarksCount ?? 0) > 0 && (
                              <>
                                <span className="text-muted-foreground/40">
                                  •
                                </span>
                                <span className="flex items-center gap-1">
                                  <Bookmark className="w-3 h-3" />
                                  {item.itemBookmarksCount}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Progress */}
                          <div className="mt-auto pt-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-muted-foreground">
                                Progress
                              </span>
                              <span className="text-[10px] font-medium">
                                {progress}%
                              </span>
                            </div>
                            <Progress value={progress} className="h-1" />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                /* Compact View */
                <div className="border rounded-lg divide-y bg-card">
                  {folderItems.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      {getItemIcon(item.itemType)}
                      {item.itemIsFavorite && (
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                      {(item.itemFolderCount ?? 0) > 1 && (
                        <MembershipBadge
                          folderCount={item.itemFolderCount}
                          size="sm"
                          className="shrink-0"
                        />
                      )}
                      <span className="flex-1 truncate text-sm">
                        {item.itemTitle || "Untitled"}
                      </span>
                      {item.itemAuthor && (
                        <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-32">
                          {item.itemAuthor}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground capitalize shrink-0">
                        {item.itemType}
                      </span>
                      {/* Favorite toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(item);
                        }}
                        aria-label={
                          item.itemIsFavorite
                            ? "Remove from favorites"
                            : "Add to favorites"
                        }
                      >
                        <Heart
                          className={cn(
                            "h-4 w-4",
                            item.itemIsFavorite &&
                              "fill-amber-500 text-amber-500"
                          )}
                        />
                      </Button>
                      {/* More actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(item);
                            }}
                          >
                            <Star
                              className={cn(
                                "mr-2 h-4 w-4",
                                item.itemIsFavorite &&
                                  "fill-amber-500 text-amber-500"
                              )}
                            />
                            {item.itemIsFavorite
                              ? "Remove from Favorites"
                              : "Add to Favorites"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadItem(item);
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddToFolderTarget(item);
                            }}
                          >
                            <FolderPlus className="mr-2 h-4 w-4" />
                            Add to Folder
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemoveItemTarget(item);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove from Folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Folder Grid - shown when no folder is selected */}
          {!selectedFolder && (
            <>
              {/* Loading state */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-xl" />
                  ))}
                </div>
              ) : folders.length === 0 ? (
                /* Empty state - hide when items are found */
                search && globalSearchResults.length > 0 ? null : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 rounded-full bg-orange-500/10 mb-4">
                      <Folder className="w-12 h-12 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {search ? "No folders found" : "No folders yet"}
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-md mb-6">
                      {search
                        ? `No folders match "${search}". Try a different search term.`
                        : "Create your first folder to organize your books, audio, and videos."}
                    </p>
                    {!search && (
                      <Button onClick={() => setShowCreateModal(true)}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Create Folder
                      </Button>
                    )}
                  </div>
                )
              ) : (
                <>
                  {/* Folders Grid View */}
                  {foldersViewMode === "grid" && (
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      role="list"
                    >
                      {folders.map((folder) => (
                        <article
                          key={folder.id}
                          role="listitem"
                          className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
                          onClick={() => handleSelectFolder(folder)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectFolder(folder);
                            }
                          }}
                        >
                          {/* Cover/Header */}
                          <div className="relative h-32">
                            <FolderCover
                              coverUrl={folder.coverUrl}
                              name={folder.name}
                              className="w-full h-full"
                              iconClassName="w-12 h-12"
                            />
                            <div className="absolute top-2 right-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditModal(folder);
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget(folder);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 p-4 flex flex-col">
                            <h3
                              className="font-semibold text-sm truncate"
                              title={folder.name}
                            >
                              {folder.name}
                            </h3>
                            {folder.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {folder.description}
                              </p>
                            )}

                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                {folder.itemCount || 0} items
                              </span>
                              {folder.bookCount ? (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />
                                  {folder.bookCount}
                                </span>
                              ) : null}
                              {folder.audioCount ? (
                                <span className="flex items-center gap-1">
                                  <Music className="w-3 h-3" />
                                  {folder.audioCount}
                                </span>
                              ) : null}
                              {folder.videoCount ? (
                                <span className="flex items-center gap-1">
                                  <Video className="w-3 h-3" />
                                  {folder.videoCount}
                                </span>
                              ) : null}
                            </div>

                            {/* Progress */}
                            <div className="mt-auto pt-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(
                                    folder.updatedAt
                                  ).toLocaleDateString()}
                                </span>
                                <span className="text-[10px] font-medium">
                                  {folder.bookCount || 0}B /{" "}
                                  {folder.audioCount || 0}A /{" "}
                                  {folder.videoCount || 0}V
                                </span>
                              </div>
                              <Progress
                                value={folder.itemCount ? 100 : 0}
                                className="h-1"
                              />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {/* Folders List View */}
                  {foldersViewMode === "list" && (
                    <div
                      className="space-y-2 sm:space-y-3"
                      role="list"
                      aria-label="Folders in your library"
                    >
                      {folders.map((folder) => (
                        <article
                          key={folder.id}
                          role="listitem"
                          className={cn(
                            "group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-border hover:border-muted-foreground/30 active:bg-secondary/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                          )}
                          onClick={() => handleSelectFolder(folder)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectFolder(folder);
                            }
                          }}
                          tabIndex={0}
                        >
                          {/* Cover - hidden on mobile */}
                          <FolderCover
                            coverUrl={folder.coverUrl}
                            name={folder.name}
                            className="w-12 h-12 rounded-lg shrink-0 hidden sm:flex"
                            iconClassName="w-5 h-5"
                          />
                          {/* Folder info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-foreground truncate pr-2">
                              {folder.name}
                            </h3>
                            {folder.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {folder.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                              <span className="text-xs text-muted-foreground uppercase font-medium">
                                FOLDER
                              </span>
                              <span className="text-muted-foreground/40">
                                •
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {folder.itemCount || 0} items
                              </span>
                              {folder.bookCount ? (
                                <>
                                  <span className="hidden sm:inline text-muted-foreground/40">
                                    •
                                  </span>
                                  <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                                    <BookOpen className="w-3 h-3" />
                                    {folder.bookCount} books
                                  </span>
                                </>
                              ) : null}
                              {folder.audioCount ? (
                                <>
                                  <span className="hidden sm:inline text-muted-foreground/40">
                                    •
                                  </span>
                                  <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                                    <Music className="w-3 h-3" />
                                    {folder.audioCount} audio
                                  </span>
                                </>
                              ) : null}
                              {folder.videoCount ? (
                                <>
                                  <span className="hidden sm:inline text-muted-foreground/40">
                                    •
                                  </span>
                                  <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                                    <Video className="w-3 h-3" />
                                    {folder.videoCount} video
                                  </span>
                                </>
                              ) : null}
                            </div>
                            {/* Mobile-only metadata row */}
                            <div className="flex sm:hidden items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              {folder.bookCount ? (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />
                                  {folder.bookCount}
                                </span>
                              ) : null}
                              {folder.audioCount ? (
                                <span className="flex items-center gap-1">
                                  <Music className="w-3 h-3" />
                                  {folder.audioCount}
                                </span>
                              ) : null}
                              {folder.videoCount ? (
                                <span className="flex items-center gap-1">
                                  <Video className="w-3 h-3" />
                                  {folder.videoCount}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                            {/* Open button */}
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectFolder(folder);
                              }}
                              className="h-9 sm:h-8 px-4 sm:px-3 text-xs font-semibold"
                            >
                              Open
                            </Button>

                            {/* More actions dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-9 sm:h-8 w-9 sm:w-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                                  aria-label={`More options for ${folder.name}`}
                                >
                                  <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onClick={() => openEditModal(folder)}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(folder)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Folder
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {/* Folders Cards View */}
                  {foldersViewMode === "cards" && (
                    <div
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      role="list"
                    >
                      {folders.map((folder) => (
                        <article
                          key={folder.id}
                          role="listitem"
                          className={cn(
                            "group flex bg-card border border-border rounded-xl overflow-hidden hover:border-muted-foreground/30 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-ring"
                          )}
                          onClick={() => handleSelectFolder(folder)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectFolder(folder);
                            }
                          }}
                        >
                          {/* Cover side */}
                          <div className="w-24 sm:w-32 aspect-3/4 shrink-0 relative">
                            <FolderCover
                              coverUrl={folder.coverUrl}
                              name={folder.name}
                              className="w-full h-full"
                              iconClassName="w-10 h-10"
                            />
                          </div>

                          {/* Content */}
                          <div className="flex-1 p-4 flex flex-col min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3
                                  className="font-semibold text-sm truncate"
                                  title={folder.name}
                                >
                                  {folder.name}
                                </h3>
                                {folder.description && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {folder.description}
                                  </p>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditModal(folder);
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget(folder);
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
                                {folder.itemCount || 0} items
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(
                                  folder.updatedAt
                                ).toLocaleDateString()}
                              </span>
                            </div>

                            {/* Progress area - consistent with other cards */}
                            <div className="mt-auto pt-3 flex items-center gap-3">
                              <div className="flex-1">
                                <Progress
                                  value={folder.itemCount ? 100 : 0}
                                  className="h-1.5"
                                />
                              </div>
                              <span className="text-xs font-medium w-16 text-right">
                                {folder.bookCount || 0}/{folder.audioCount || 0}
                                /{folder.videoCount || 0}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {/* Folders Compact View */}
                  {foldersViewMode === "compact" && (
                    <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className={cn(
                            "group flex items-center gap-3 px-3 py-3 transition-colors cursor-pointer",
                            "hover:bg-secondary/30"
                          )}
                          onClick={() => handleSelectFolder(folder)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectFolder(folder);
                            }
                          }}
                        >
                          <FolderCover
                            coverUrl={folder.coverUrl}
                            name={folder.name}
                            className="w-8 h-10 rounded shrink-0"
                            iconClassName="w-4 h-4"
                          />

                          <div className="flex-1 min-w-0">
                            <span
                              className="text-sm font-medium truncate block"
                              title={folder.name}
                            >
                              {folder.name}
                            </span>
                            {folder.description && (
                              <span className="text-xs text-muted-foreground truncate block">
                                {folder.description}
                              </span>
                            )}
                          </div>

                          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                            {folder.bookCount ? (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                {folder.bookCount}
                              </span>
                            ) : null}
                            {folder.audioCount ? (
                              <span className="flex items-center gap-1">
                                <Music className="w-3 h-3" />
                                {folder.audioCount}
                              </span>
                            ) : null}
                            {folder.videoCount ? (
                              <span className="flex items-center gap-1">
                                <Video className="w-3 h-3" />
                                {folder.videoCount}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground w-7 text-right">
                              {folder.itemCount || 0}
                            </span>

                            <div
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openEditModal(folder)}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteTarget(folder)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pagination Footer - Sticky at bottom, matching Video Library style */}
      {!selectedFolder && foldersTotalCount > 0 && (
        <div className="shrink-0 border-t border-border bg-popover/80 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-3 safe-area-inset-bottom">
          <div className="max-w-6xl mx-auto">
            <PaginationControls
              currentPage={foldersPage}
              totalPages={foldersTotalPages}
              totalItems={foldersTotalCount}
              limit={foldersLimit}
              onPageChange={setFoldersPage}
              onLimitChange={handleFoldersLimitChange}
            />
          </div>
        </div>
      )}

      {/* Folder Items Pagination Footer - When viewing folder contents */}
      {selectedFolder && itemsTotalCount > 0 && (
        <div className="shrink-0 border-t border-border bg-popover/80 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-3 safe-area-inset-bottom">
          <div className="max-w-6xl mx-auto">
            <PaginationControls
              currentPage={itemsPage}
              totalPages={itemsTotalPages}
              totalItems={itemsTotalCount}
              limit={itemsLimit}
              onPageChange={setItemsPage}
              onLimitChange={handleItemsLimitChange}
            />
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Media Folder</DialogTitle>
            <DialogDescription>
              Create a new folder to organize your media files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Folder name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-desc">Description (optional)</Label>
              <Input
                id="folder-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What's this folder for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={isSaving}>
              {isSaving ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Modal */}
      <Dialog
        open={!!editFolder}
        onOpenChange={(open) => !open && setEditFolder(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-500" />
              Edit Folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cover Image Section */}
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden transition-all",
                    coverPreview || (!removeCover && existingCoverUrl)
                      ? "border-transparent"
                      : "border-border bg-secondary/30"
                  )}
                >
                  {coverPreview || (!removeCover && existingCoverUrl) ? (
                    <img
                      src={coverPreview || existingCoverUrl || ""}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleCoverFileChange}
                    className="hidden"
                    disabled={isSaving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {coverPreview || (!removeCover && existingCoverUrl)
                      ? "Change Cover"
                      : "Upload Cover"}
                  </Button>
                  {(coverPreview || (!removeCover && existingCoverUrl)) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCover}
                      disabled={isSaving}
                      className="w-full text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove Cover
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP, or GIF. Max {maxCoverSizeMB}MB.
                  </p>
                  <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                    <Clipboard className="w-3 h-3" />
                    Or paste from clipboard (Ctrl/Cmd+V)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-folder-name">Name</Label>
              <Input
                id="edit-folder-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Folder name"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-folder-desc">Description</Label>
              <Input
                id="edit-folder-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description"
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditFolder(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateFolder}
              disabled={isSaving || isUploadingCover}
            >
              {isUploadingCover
                ? "Uploading cover..."
                : isSaving
                  ? "Saving..."
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the folder &ldquo;{deleteTarget?.name}&rdquo;.
              Items in the folder will not be deleted, only removed from this
              folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Item Confirmation */}
      <AlertDialog
        open={!!removeItemTarget}
        onOpenChange={() => setRemoveItemTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &ldquo;{removeItemTarget?.itemTitle}&rdquo; from
              this folder. The {removeItemTarget?.itemType} itself will not be
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Folder Modal */}
      {addToFolderTarget && (
        <AddToFolderModal
          open={!!addToFolderTarget}
          onOpenChange={() => setAddToFolderTarget(null)}
          itemId={addToFolderTarget.itemId}
          itemType={addToFolderTarget.itemType}
          itemTitle={addToFolderTarget.itemTitle || "Untitled"}
          onSuccess={() => {
            if (selectedFolder) {
              loadFolderItems(selectedFolder.id);
            }
          }}
        />
      )}
    </div>
  );
}
