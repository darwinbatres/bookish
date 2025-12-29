import { useEffect, useState } from "react";
import { fetchItemReferences, type ItemReferences } from "@/lib/api/client";
import { FolderOpen, ListMusic, Heart, Loader2 } from "lucide-react";

interface DeleteConfirmationInfoProps {
  itemType: "book" | "audio" | "video" | "image";
  itemId: string;
  isFavorite?: boolean;
}

export function DeleteConfirmationInfo({
  itemType,
  itemId,
  isFavorite,
}: DeleteConfirmationInfoProps) {
  const [references, setReferences] = useState<ItemReferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const refs = await fetchItemReferences(itemType, itemId);
        if (!cancelled) {
          setReferences(refs);
        }
      } catch (error) {
        console.error("Failed to fetch item references:", error);
        if (!cancelled) {
          setReferences({ folders: [], playlists: [] });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemType, itemId]);

  const hasReferences =
    isFavorite ||
    (references?.folders.length ?? 0) > 0 ||
    (references?.playlists.length ?? 0) > 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking references...</span>
      </div>
    );
  }

  if (!hasReferences) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
        This will also affect:
      </p>
      <ul className="text-sm text-muted-foreground space-y-1.5">
        {isFavorite && (
          <li className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500 fill-red-500 shrink-0" />
            <span>Marked as favorite</span>
          </li>
        )}
        {references && references.folders.length > 0 && (
          <li className="flex items-start gap-2">
            <FolderOpen className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="font-medium">
                In{" "}
                {references.folders.length === 1
                  ? "1 folder"
                  : `${references.folders.length} folders`}
              </span>
              <ul className="mt-1 space-y-0.5 pl-1">
                {references.folders.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-1.5 text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )}
        {references && references.playlists.length > 0 && (
          <li className="flex items-start gap-2">
            <ListMusic className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="font-medium">
                In{" "}
                {references.playlists.length === 1
                  ? "1 playlist"
                  : `${references.playlists.length} playlists`}
              </span>
              <ul className="mt-1 space-y-0.5 pl-1">
                {references.playlists.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-1.5 text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
