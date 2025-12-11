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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/ui/page-layout";
import {
  fetchWishlist,
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
} from "@/lib/api/client";
import type { DBWishlistItem, WishlistPriority } from "@/types";

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

interface WishlistFormData {
  title: string;
  author: string;
  notes: string;
  priority: WishlistPriority;
  url: string;
}

const defaultFormData: WishlistFormData = {
  title: "",
  author: "",
  notes: "",
  priority: 1,
  url: "",
};

interface WishlistViewProps {
  isFullPage?: boolean;
}

export function WishlistView({ isFullPage = false }: WishlistViewProps) {
  const [items, setItems] = useState<DBWishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DBWishlistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBWishlistItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<WishlistFormData>(defaultFormData);

  const loadWishlist = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchWishlist();
      setItems(data);
    } catch (error) {
      console.error("[Wishlist] Failed to fetch:", error);
      toast.error("Failed to load wishlist");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: DBWishlistItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        author: item.author || "",
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
    setIsSaving(true);
    try {
      if (editingItem) {
        await updateWishlistItem(editingItem.id, {
          title: trimmedTitle,
          author: formData.author.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          priority: formData.priority,
          url: formData.url.trim() || undefined,
        });
        toast.success("Wishlist item updated");
      } else {
        await createWishlistItem({
          title: trimmedTitle,
          author: formData.author.trim() || undefined,
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

  const sortedItems = [...items].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (isLoading) {
    if (isFullPage) {
      return (
        <PageLayout
          title="Wishlist"
          subtitle="Books you want to read"
          maxWidth="6xl"
        >
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </PageLayout>
      );
    }
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Dialog for adding/editing wishlist items
  const addBookDialog = (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open) handleCloseDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-1" />
          Add Book
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookPlus className="w-4 h-4" />
            {editingItem ? "Edit Wishlist Item" : "Add to Wishlist"}
          </DialogTitle>
          <DialogDescription>
            {editingItem
              ? "Update the details for this book."
              : "Add a book you want to read in the future."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wishlist-title">Title *</Label>
            <Input
              id="wishlist-title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Book title"
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wishlist-author">Author</Label>
            <Input
              id="wishlist-author"
              value={formData.author}
              onChange={(e) =>
                setFormData({ ...formData, author: e.target.value })
              }
              placeholder="Author name"
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
            <Label htmlFor="wishlist-url">URL (optional)</Label>
            <Input
              id="wishlist-url"
              type="url"
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
              placeholder="https://example.com/book"
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
              placeholder="Why you want to read this book..."
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
            <Button type="submit" disabled={isSaving || !formData.title.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingItem ? "Updating..." : "Adding..."}
                </>
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
  );

  // Content for the wishlist items
  const wishlistContent = (
    <>
      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Your wishlist is empty</p>
          <p className="text-xs mt-1 opacity-70">
            Add books you want to read in the future
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item) => (
            <article
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border hover:border-muted-foreground/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm truncate">{item.title}</h3>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-medium rounded-full shrink-0",
                      PRIORITY_COLORS[item.priority]
                    )}
                  >
                    {PRIORITY_LABELS[item.priority]}
                  </span>
                </div>
                {item.author && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by {item.author}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                    {item.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {item.url && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      window.open(
                        item.url as string,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    aria-label="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenDialog(item)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteTarget(item)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );

  // Delete confirmation dialog (always rendered)
  const deleteDialog = (
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
  );

  // Full page mode uses PageLayout for consistent styling
  if (isFullPage) {
    return (
      <>
        <PageLayout
          title="Wishlist"
          subtitle={`${items.length} ${items.length === 1 ? "book" : "books"} to read`}
          headerAction={addBookDialog}
          maxWidth="6xl"
        >
          {wishlistContent}
        </PageLayout>
        {deleteDialog}
      </>
    );
  }

  // Embedded mode (e.g., in a panel)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Wishlist
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {items.length} {items.length === 1 ? "book" : "books"} to read
          </p>
        </div>
        {addBookDialog}
      </div>
      {wishlistContent}
      {deleteDialog}
    </div>
  );
}
