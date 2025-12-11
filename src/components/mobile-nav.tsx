import {
  Library,
  Menu,
  X,
  BarChart3,
  Settings,
  Star,
  ShoppingCart,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import type { ViewType } from "./sidebar";
import type { DBCollection } from "@/types";
import { CollectionsView } from "./collections-view";

interface MobileNavProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  selectedCollection?: DBCollection | null;
  onSelectCollection?: (collection: DBCollection | null) => void;
  onLogout?: () => void;
}

export function MobileNav({
  activeView,
  onViewChange,
  selectedCollection,
  onSelectCollection,
  onLogout,
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Handle collection selection - switch to library view and close menu
  const handleSelectCollection = (collection: DBCollection | null) => {
    onSelectCollection?.(collection);
    if (activeView !== "library") {
      onViewChange("library");
    }
    setIsOpen(false);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card safe-area-inset-top shrink-0">
        <h1 className="text-base font-bold tracking-tight">Shelf</h1>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 -mr-2 hover:bg-secondary rounded-lg transition-colors active:scale-95"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="lg:hidden fixed top-0 right-0 bottom-0 w-64 sm:w-72 bg-card border-l border-border z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-semibold">Menu</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 -mr-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              <button
                onClick={() => {
                  onViewChange("library");
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors",
                  activeView === "library"
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:bg-secondary"
                )}
              >
                <Library className="w-5 h-5" />
                Library
              </button>
              <button
                onClick={() => {
                  onViewChange("favorites");
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors",
                  activeView === "favorites"
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:bg-secondary"
                )}
              >
                <Star className="w-5 h-5" />
                Favorites
              </button>
              <button
                onClick={() => {
                  onViewChange("wishlist");
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors",
                  activeView === "wishlist"
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:bg-secondary"
                )}
              >
                <ShoppingCart className="w-5 h-5" />
                Wishlist
              </button>
              <button
                onClick={() => {
                  onViewChange("stats");
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors",
                  activeView === "stats"
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:bg-secondary"
                )}
              >
                <BarChart3 className="w-5 h-5" />
                Stats
              </button>
              <button
                onClick={() => {
                  onViewChange("settings");
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors",
                  activeView === "settings"
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:bg-secondary"
                )}
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>

              {/* Collections section */}
              <div className="mt-4 pt-4 border-t border-border">
                <CollectionsView
                  selectedCollectionId={selectedCollection?.id}
                  onSelectCollection={handleSelectCollection}
                />
              </div>
            </nav>

            {/* Sign out footer */}
            {onLogout && (
              <div className="p-3 border-t border-border">
                <button
                  onClick={() => {
                    onLogout();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:bg-secondary transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
