import { useState, useEffect } from "react";
import { Folder, FolderPlus, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchMediaFolders,
  createMediaFolder,
  addItemToMediaFolder,
} from "@/lib/api/client";
import type { DBMediaFolder, MediaItemType } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddToFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemType: MediaItemType;
  itemTitle: string;
}

export function AddToFolderModal({
  open,
  onOpenChange,
  itemId,
  itemType,
  itemTitle,
}: AddToFolderModalProps) {
  const [folders, setFolders] = useState<DBMediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    if (open) {
      loadFolders();
    }
  }, [open]);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const data = await fetchMediaFolders();
      setFolders(data);
    } catch (error) {
      console.error("Failed to load folders:", error);
      toast.error("Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToFolder = async (folderId: string) => {
    try {
      setAdding(folderId);
      await addItemToMediaFolder(folderId, itemType, itemId);
      toast.success(`Added to folder`);
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Failed to add to folder:", error);
      const message = error instanceof Error ? error.message : "Failed to add to folder";
      if (message.includes("already exists")) {
        toast.error("Item is already in this folder");
      } else {
        toast.error(message);
      }
    } finally {
      setAdding(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      setCreatingFolder(true);
      const folder = await createMediaFolder({ name: newFolderName.trim() });
      setFolders((prev) => [...prev, folder]);
      setNewFolderName("");
      setShowNewFolder(false);
      // Auto-add to the new folder
      await handleAddToFolder(folder.id);
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast.error("Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Add to Folder
          </DialogTitle>
          <DialogDescription className="truncate">
            Add &ldquo;{itemTitle}&rdquo; to a folder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : folders.length === 0 && !showNewFolder ? (
            <div className="text-center py-6 text-muted-foreground">
              <Folder className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No folders yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowNewFolder(true)}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Folder
              </Button>
            </div>
          ) : (
            <>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleAddToFolder(folder.id)}
                  disabled={adding !== null}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                    "hover:bg-accent disabled:opacity-50"
                  )}
                >
                  <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{folder.name}</p>
                    {folder.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {folder.description}
                      </p>
                    )}
                  </div>
                  {adding === folder.id && (
                    <Check className="h-4 w-4 text-green-500 animate-pulse" />
                  )}
                </button>
              ))}

              {showNewFolder ? (
                <div className="flex gap-2 items-center pt-2">
                  <Input
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                  >
                    {creatingFolder ? "..." : "Add"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewFolder(false);
                      setNewFolderName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowNewFolder(true)}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
