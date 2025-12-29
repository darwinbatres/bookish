/**
 * ImageEditModal Component
 * Edit image metadata (fields: title, album, description, tags)
 * Created: December 2024
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageCover } from "@/components/image-cover";
import { updateImage } from "@/lib/api";
import type { DBImage } from "@/types";

interface ImageEditModalProps {
  image: DBImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (image: DBImage) => void;
}

export function ImageEditModal({
  image,
  open,
  onOpenChange,
  onSuccess,
}: ImageEditModalProps) {
  const [title, setTitle] = useState("");
  const [album, setAlbum] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (image) {
      setTitle(image.title);
      setAlbum(image.album || "");
      setDescription(image.description || "");
      setTagsInput(image.tags?.join(", ") || "");
    }
  }, [image]);

  const handleSave = async () => {
    if (!image) return;

    setIsSaving(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const updated = await updateImage(image.id, {
        title: title.trim(),
        album: album.trim() || undefined,
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      toast.success("Image updated");
      onSuccess?.(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update image"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
          <DialogDescription>
            Update image details and metadata
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-6 py-4">
          <div className="sm:sticky sm:top-0 flex justify-center">
            <ImageCover
              thumbnailUrl={image.thumbnailUrl}
              s3Key={image.s3Key}
              title={image.title}
              aspectRatio="square"
              className="w-24 h-24 rounded-lg overflow-hidden"
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Image title"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="album">Album / Collection</Label>
              <Input
                id="album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="e.g. Vacation 2024"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Separate with commas"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                e.g. nature, landscape, sunset
              </p>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 pt-2">
              <p>File: {image.format.toUpperCase()} • {image.width && image.height ? image.width + " × " + image.height : "—"}</p>
              {image.cameraModel && <p>Camera: {image.cameraModel}</p>}
              {image.takenAt && <p>Taken: {new Date(image.takenAt).toLocaleString()}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
