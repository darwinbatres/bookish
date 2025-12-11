import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Folder,
  Edit2,
  Trash2,
  MoreVertical,
  Loader2,
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
  DialogTrigger,
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
import { toast } from "sonner";
import type { DBCollection } from "@/types";

// Collection colors
const COLLECTION_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#0ea5e9", // Sky
  "#64748b", // Slate
];

interface CollectionFormData {
  name: string;
  description: string;
  color: string;
}

interface CollectionsViewProps {
  onSelectCollection?: (collection: DBCollection | null) => void;
  selectedCollectionId?: string | null;
  /** Increment to trigger a refresh of collections list */
  refreshKey?: number;
}

export function CollectionsView({
  onSelectCollection,
  selectedCollectionId,
  refreshKey,
}: CollectionsViewProps) {
  const [collections, setCollections] = useState<DBCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] =
    useState<DBCollection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBCollection | null>(null);
  const [formData, setFormData] = useState<CollectionFormData>({
    name: "",
    description: "",
    color: COLLECTION_COLORS[0],
  });

  // Fetch collections
  const fetchCollections = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const response = await fetch("/api/collections");
      if (!response.ok) throw new Error("Failed to fetch collections");
      const data = await response.json();
      setCollections(data);
    } catch (error) {
      console.error("[Collections] Failed to fetch:", error);
      toast.error("Failed to load collections");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and refresh when external key changes
  useEffect(() => {
    fetchCollections(true);
  }, [fetchCollections, refreshKey]);

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", description: "", color: COLLECTION_COLORS[0] });
    setEditingCollection(null);
  };

  // Handle dialog open
  const handleDialogOpen = (collection?: DBCollection) => {
    if (collection) {
      setEditingCollection(collection);
      setFormData({
        name: collection.name,
        description: collection.description || "",
        color: collection.color,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  // Create/Update collection
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Collection name is required");
      return;
    }

    try {
      const url = editingCollection
        ? `/api/collections/${editingCollection.id}`
        : "/api/collections";
      const method = editingCollection ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save collection");

      toast.success(
        editingCollection ? "Collection updated" : "Collection created"
      );
      handleDialogClose();
      // Refresh collections list immediately
      await fetchCollections(false);
    } catch (error) {
      console.error("[Collections] Failed to save:", error);
      toast.error("Failed to save collection");
    }
  };

  // Delete collection
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const response = await fetch(`/api/collections/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete collection");

      toast.success("Collection deleted");
      setDeleteTarget(null);

      // If this was selected, clear selection
      if (selectedCollectionId === deleteTarget.id) {
        onSelectCollection?.(null);
      }

      // Refresh collections list immediately
      await fetchCollections(false);
    } catch (error) {
      console.error("[Collections] Failed to delete:", error);
      toast.error("Failed to delete collection");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Collections
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDialogOpen()}
              aria-label="Add collection"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCollection ? "Edit Collection" : "New Collection"}
              </DialogTitle>
              <DialogDescription>
                Organize your books into collections for easier browsing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Technical Books"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="A brief description"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLLECTION_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, color }))
                      }
                      className={`w-8 h-8 rounded-full transition-transform ${
                        formData.color === color
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {editingCollection ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* All Books option */}
      <button
        onClick={() => onSelectCollection?.(null)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          !selectedCollectionId
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60"
        }`}
      >
        <Folder className="w-4 h-4" />
        <span>All Books</span>
      </button>

      {/* Collections list */}
      <div className="space-y-1">
        {collections.map((collection) => (
          <div
            key={collection.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedCollectionId === collection.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <button
              onClick={() => onSelectCollection?.(collection)}
              className="flex-1 flex items-center gap-2 text-left"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: collection.color }}
              />
              <span className="truncate">{collection.name}</span>
              {collection.bookCount !== undefined &&
                collection.bookCount > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {collection.bookCount}
                  </span>
                )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                  <span className="sr-only">Collection options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDialogOpen(collection)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteTarget(collection)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {collections.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No collections yet. Create one to organize your books.
        </p>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? Books in
              this collection won't be deleted, they'll just be uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
