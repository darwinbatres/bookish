import {
  Library,
  BarChart3,
  Settings,
  LogOut,
  ShoppingCart,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CollectionsView } from "./collections-view";
import type { DBCollection } from "@/types";

export type ViewType =
  | "library"
  | "favorites"
  | "wishlist"
  | "stats"
  | "settings";

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  username?: string;
  onLogout?: () => void;
  selectedCollection?: DBCollection | null;
  onSelectCollection?: (collection: DBCollection | null) => void;
  /** Key to trigger collections refresh */
  collectionsRefreshKey?: number;
}

const navItems: Array<{ id: ViewType; label: string; icon: typeof Library }> = [
  { id: "library", label: "Library", icon: Library },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "wishlist", label: "Wishlist", icon: ShoppingCart },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  activeView,
  onViewChange,
  username,
  onLogout,
  selectedCollection,
  onSelectCollection,
  collectionsRefreshKey,
}: SidebarProps) {
  // Handle collection selection - switch to library view when selecting a collection
  const handleSelectCollection = (collection: DBCollection | null) => {
    onSelectCollection?.(collection);
    if (activeView !== "library") {
      onViewChange("library");
    }
  };

  return (
    <aside
      className="w-56 xl:w-64 bg-sidebar flex flex-col h-full border-r border-border shrink-0"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="p-4 xl:p-5 pb-5 xl:pb-6">
        <h1 className="text-base xl:text-lg font-bold tracking-tight text-sidebar-foreground">
          Shelf
        </h1>
      </div>

      <nav className="px-2 xl:px-3 space-y-0.5" aria-label="Primary">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              onViewChange(id);
              if (id === "library") {
                onSelectCollection?.(null); // Reset collection filter when clicking Library
              }
            }}
            aria-current={activeView === id ? "page" : undefined}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeView === id && !selectedCollection
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </nav>

      {/* Collections section */}
      <div className="flex-1 px-2 xl:px-3 mt-4 overflow-y-auto">
        <CollectionsView
          selectedCollectionId={selectedCollection?.id}
          onSelectCollection={handleSelectCollection}
          refreshKey={collectionsRefreshKey}
        />
      </div>

      {/* Logout button - minimal footer */}
      {username && onLogout && (
        <div className="px-2 xl:px-3 py-4 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign out</span>
          </Button>
        </div>
      )}
    </aside>
  );
}
