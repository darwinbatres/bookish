import { useState, useEffect, useCallback } from "react";
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
  LayoutGrid,
  LayoutList,
  List,
  CreditCard,
  X,
  Save,
  Filter,
  ChevronDown,
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
import {
  fetchMediaFoldersPaginated,
  createMediaFolder,
  updateMediaFolder,
  deleteMediaFolder,
  fetchMediaFolderItemsPaginated,
  removeItemFromMediaFolder,
  getAudioStreamUrl,
  getVideoStreamUrl,
} from "@/lib/api/client";
import { BookCover } from "@/components/book-cover";
import { AudioCover } from "@/components/audio-cover";
import { VideoCover } from "@/components/video-cover";
import { SearchInput, PaginationControls } from "@/components/library";
import type {
  DBMediaFolder,
  DBMediaFolderItemWithDetails,
  DBBook,
  DBAudioTrack,
  DBVideoTrack,
  BookFormat,
} from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Dynamically import markdown editor to avoid SSR issues
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  { ssr: false }
);

// View modes for folder items and folder list (matching library)
type ViewMode = "list" | "grid" | "cards" | "compact";

// LocalStorage keys for persistent preferences
const PAGE_SIZE_KEY = "bookish-library-page-size";
const FOLDERS_VIEW_MODE_KEY = "bookish-folders-view-mode";
const FOLDER_ITEMS_VIEW_MODE_KEY = "bookish-folder-items-view-mode";

function getStoredPageSize(): number {
  if (typeof window === "undefined") return 20;
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 20;
}

function getStoredFoldersViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(FOLDERS_VIEW_MODE_KEY);
  if (stored && ["list", "grid", "cards", "compact"].includes(stored)) {
    return stored as ViewMode;
  }
  return "list";
}

function getStoredItemsViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  const stored = localStorage.getItem(FOLDER_ITEMS_VIEW_MODE_KEY);
  if (stored && ["list", "grid", "cards", "compact"].includes(stored)) {
    return stored as ViewMode;
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
  const [itemViewMode, setItemViewMode] = useState<ViewMode>(
    getStoredItemsViewMode
  );

  // View mode for folders list (persisted)
  const [foldersViewMode, setFoldersViewMode] = useState<ViewMode>(
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

  // View mode change handlers (persist to localStorage)
  const handleFoldersViewModeChange = useCallback((mode: ViewMode) => {
    setFoldersViewMode(mode);
    localStorage.setItem(FOLDERS_VIEW_MODE_KEY, mode);
  }, []);

  const handleItemsViewModeChange = useCallback((mode: ViewMode) => {
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
    [itemsPage, itemsLimit, filterType]
  );

  // Load folders when dependencies change
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setFoldersPage(1);
  }, [search]);

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
      // Reset to first page to show the new folder (sorted by name)
      setFoldersPage(1);
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
      const updated = await updateMediaFolder(editFolder.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      });
      setFolders((prev) =>
        prev.map((f) => (f.id === updated.id ? updated : f))
      );
      if (selectedFolder?.id === updated.id) {
        setSelectedFolder(updated);
      }
      toast.success("Folder updated");
      setEditFolder(null);
      setFormName("");
      setFormDescription("");
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
  };

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
                  <div className="flex items-center gap-2">
                    {/* View mode switcher */}
                    <div className="flex items-center border border-border rounded-lg p-0.5 bg-background">
                      <Button
                        variant={
                          foldersViewMode === "list" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleFoldersViewModeChange("list")}
                        title="List view"
                      >
                        <LayoutList className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={
                          foldersViewMode === "grid" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleFoldersViewModeChange("grid")}
                        title="Grid view"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={
                          foldersViewMode === "cards" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleFoldersViewModeChange("cards")}
                        title="Card view"
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={
                          foldersViewMode === "compact" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleFoldersViewModeChange("compact")}
                        title="Compact view"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search folders..."
                  />
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="shrink-0"
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    New Folder
                  </Button>
                </div>
              </div>
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
                      setSelectedFolder(null);
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
                      {selectedFolder.itemCount || 0} items
                    </p>
                  </div>
                </div>

                {/* View mode switcher */}
                <div className="flex items-center border border-border rounded-lg p-0.5 bg-background shrink-0">
                  <Button
                    variant={itemViewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleItemsViewModeChange("list")}
                    title="List view"
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={itemViewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleItemsViewModeChange("grid")}
                    title="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={itemViewMode === "cards" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleItemsViewModeChange("cards")}
                    title="Card view"
                  >
                    <CreditCard className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={itemViewMode === "compact" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleItemsViewModeChange("compact")}
                    title="Compact view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
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

              {/* Folder Items */}
              {loadingItems ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
                  ))}
                </div>
              ) : folderItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card">
                  <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>This folder is empty.</p>
                  <p className="text-sm mt-1">
                    Add items from your library using the &ldquo;Add to
                    Folder&rdquo; option.
                  </p>
                </div>
              ) : itemViewMode === "grid" ? (
                /* Grid View */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {folderItems.map((item) => (
                    <div
                      key={item.id}
                      className="group relative flex flex-col rounded-lg border overflow-hidden bg-card hover:shadow-md transition-all cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      {/* Cover */}
                      <div className="relative aspect-[3/4]">
                        {item.itemType === "book" && (
                          <BookCover
                            coverUrl={item.itemCoverUrl}
                            format={(item.itemFormat as BookFormat) || "pdf"}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                          />
                        )}
                        {item.itemType === "audio" && (
                          <AudioCover
                            coverUrl={item.itemCoverUrl}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                          />
                        )}
                        {item.itemType === "video" && (
                          <VideoCover
                            coverUrl={item.itemCoverUrl}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                          />
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="h-10 w-10 text-white" fill="white" />
                        </div>
                        {/* Type badge */}
                        <div className="absolute top-2 left-2 p-1 rounded bg-black/60">
                          {getItemIcon(item.itemType)}
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-3 flex-1">
                        <p className="font-medium text-sm truncate">
                          {item.itemTitle || "Untitled"}
                        </p>
                        {item.itemAuthor && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.itemAuthor}
                          </p>
                        )}
                      </div>
                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-black/70"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4 text-white" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
              ) : itemViewMode === "list" ? (
                /* List View */
                <div className="space-y-2">
                  {folderItems.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      {/* Cover thumbnail */}
                      <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden">
                        {item.itemType === "book" && (
                          <BookCover
                            coverUrl={item.itemCoverUrl}
                            format={(item.itemFormat as BookFormat) || "pdf"}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                            iconClassName="h-5 w-5"
                          />
                        )}
                        {item.itemType === "audio" && (
                          <AudioCover
                            coverUrl={item.itemCoverUrl}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                            iconClassName="h-5 w-5"
                          />
                        )}
                        {item.itemType === "video" && (
                          <VideoCover
                            coverUrl={item.itemCoverUrl}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                            iconClassName="h-5 w-5"
                          />
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="h-5 w-5 text-white" fill="white" />
                        </div>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getItemIcon(item.itemType)}
                          <p className="font-medium truncate">
                            {item.itemTitle || "Untitled"}
                          </p>
                        </div>
                        {item.itemAuthor && (
                          <p className="text-sm text-muted-foreground truncate">
                            {item.itemAuthor}
                          </p>
                        )}
                      </div>
                      {/* Progress indicator */}
                      {item.itemProgress &&
                        item.itemTotal &&
                        item.itemTotal > 0 && (
                          <div className="hidden sm:block text-right text-sm text-muted-foreground">
                            {Math.round(
                              (item.itemProgress / item.itemTotal) * 100
                            )}
                            %
                          </div>
                        )}
                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
              ) : itemViewMode === "cards" ? (
                /* Cards View */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {folderItems.map((item) => (
                    <div
                      key={item.id}
                      className="group flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      {/* Cover */}
                      <div className="relative w-20 h-28 shrink-0 rounded overflow-hidden">
                        {item.itemType === "book" && (
                          <BookCover
                            coverUrl={item.itemCoverUrl}
                            format={(item.itemFormat as BookFormat) || "pdf"}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                          />
                        )}
                        {item.itemType === "audio" && (
                          <AudioCover
                            coverUrl={item.itemCoverUrl}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                          />
                        )}
                        {item.itemType === "video" && (
                          <VideoCover
                            coverUrl={item.itemCoverUrl}
                            title={item.itemTitle || "Untitled"}
                            className="w-full h-full"
                          />
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="h-6 w-6 text-white" fill="white" />
                        </div>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {getItemIcon(item.itemType)}
                              <span className="font-medium text-sm truncate">
                                {item.itemTitle || "Untitled"}
                              </span>
                            </div>
                            {item.itemAuthor && (
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {item.itemAuthor}
                              </p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 -mt-1 -mr-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                        {/* Progress */}
                        {item.itemProgress &&
                          item.itemTotal &&
                          item.itemTotal > 0 && (
                            <div className="mt-auto pt-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Progress</span>
                                <span>
                                  {Math.round(
                                    (item.itemProgress / item.itemTotal) * 100
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{
                                    width: `${Math.round(
                                      (item.itemProgress / item.itemTotal) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRemoveItemTarget(item);
                        }}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-xl" />
                  ))}
                </div>
              ) : folders.length === 0 ? (
                /* Empty state */
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
              ) : (
                <>
                  {/* Folders Grid View */}
                  {foldersViewMode === "grid" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className={cn(
                            "group relative p-4 rounded-xl border bg-card transition-all cursor-pointer",
                            "hover:bg-accent/50 hover:shadow-md"
                          )}
                          onClick={() => setSelectedFolder(folder)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-orange-500/10">
                                <Folder className="w-6 h-6 text-orange-500" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{folder.name}</h3>
                                {folder.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {folder.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
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
                          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                            <span>{folder.itemCount || 0} items</span>
                            {folder.bookCount ? (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />{" "}
                                {folder.bookCount}
                              </span>
                            ) : null}
                            {folder.audioCount ? (
                              <span className="flex items-center gap-1">
                                <Music className="w-3 h-3" />{" "}
                                {folder.audioCount}
                              </span>
                            ) : null}
                            {folder.videoCount ? (
                              <span className="flex items-center gap-1">
                                <Video className="w-3 h-3" />{" "}
                                {folder.videoCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Folders List View */}
                  {foldersViewMode === "list" && (
                    <div className="space-y-3">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className={cn(
                            "group flex items-center gap-4 p-4 rounded-xl border bg-card transition-all cursor-pointer",
                            "hover:bg-accent/50 hover:shadow-md"
                          )}
                          onClick={() => setSelectedFolder(folder)}
                        >
                          <div className="p-3 rounded-lg bg-orange-500/10 shrink-0">
                            <Folder className="w-8 h-8 text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg">
                              {folder.name}
                            </h3>
                            {folder.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {folder.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{folder.itemCount || 0} items</span>
                              {folder.bookCount ? (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />{" "}
                                  {folder.bookCount} books
                                </span>
                              ) : null}
                              {folder.audioCount ? (
                                <span className="flex items-center gap-1">
                                  <Music className="w-3 h-3" />{" "}
                                  {folder.audioCount} audio
                                </span>
                              ) : null}
                              {folder.videoCount ? (
                                <span className="flex items-center gap-1">
                                  <Video className="w-3 h-3" />{" "}
                                  {folder.videoCount} video
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                              >
                                <MoreVertical className="h-4 w-4" />
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
                      ))}
                    </div>
                  )}

                  {/* Folders Cards View */}
                  {foldersViewMode === "cards" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className={cn(
                            "group relative p-5 rounded-xl border bg-card transition-all cursor-pointer",
                            "hover:bg-accent/50 hover:shadow-md"
                          )}
                          onClick={() => setSelectedFolder(folder)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-lg bg-orange-500/10 shrink-0">
                              <Folder className="w-10 h-10 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-lg">
                                  {folder.name}
                                </h3>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    asChild
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0 -mt-1 -mr-2"
                                    >
                                      <MoreVertical className="h-4 w-4" />
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
                              {folder.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {folder.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                                <span className="font-medium">
                                  {folder.itemCount || 0} items
                                </span>
                                {folder.bookCount ? (
                                  <span className="flex items-center gap-1 bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">
                                    <BookOpen className="w-3 h-3" />{" "}
                                    {folder.bookCount}
                                  </span>
                                ) : null}
                                {folder.audioCount ? (
                                  <span className="flex items-center gap-1 bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">
                                    <Music className="w-3 h-3" />{" "}
                                    {folder.audioCount}
                                  </span>
                                ) : null}
                                {folder.videoCount ? (
                                  <span className="flex items-center gap-1 bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-full">
                                    <Video className="w-3 h-3" />{" "}
                                    {folder.videoCount}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Folders Compact View */}
                  {foldersViewMode === "compact" && (
                    <div className="border rounded-lg divide-y">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className={cn(
                            "group flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer",
                            "hover:bg-accent/50"
                          )}
                          onClick={() => setSelectedFolder(folder)}
                        >
                          <Folder className="w-4 h-4 text-orange-500 shrink-0" />
                          <span className="font-medium truncate flex-1">
                            {folder.name}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                            <span>{folder.itemCount || 0}</span>
                            {folder.bookCount ? (
                              <span className="flex items-center gap-0.5">
                                <BookOpen className="w-3 h-3" />{" "}
                                {folder.bookCount}
                              </span>
                            ) : null}
                            {folder.audioCount ? (
                              <span className="flex items-center gap-0.5">
                                <Music className="w-3 h-3" />{" "}
                                {folder.audioCount}
                              </span>
                            ) : null}
                            {folder.videoCount ? (
                              <span className="flex items-center gap-0.5">
                                <Video className="w-3 h-3" />{" "}
                                {folder.videoCount}
                              </span>
                            ) : null}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                              >
                                <MoreVertical className="h-4 w-4" />
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
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name">Name</Label>
              <Input
                id="edit-folder-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Folder name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-folder-desc">Description</Label>
              <Input
                id="edit-folder-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolder(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFolder} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
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
    </div>
  );
}
