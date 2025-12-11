import { LayoutGrid, List, LayoutList, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LibraryViewMode } from "@/types";

interface ViewModeSwitcherProps {
  currentMode: LibraryViewMode;
  onChange: (mode: LibraryViewMode) => void;
}

const viewModes: {
  mode: LibraryViewMode;
  icon: typeof LayoutGrid;
  label: string;
}[] = [
  { mode: "list", icon: LayoutList, label: "List view" },
  { mode: "grid", icon: LayoutGrid, label: "Grid view" },
  { mode: "cards", icon: CreditCard, label: "Card view" },
  { mode: "compact", icon: List, label: "Compact view" },
];

export function ViewModeSwitcher({
  currentMode,
  onChange,
}: ViewModeSwitcherProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center border border-border rounded-lg p-0.5 bg-background">
        {viewModes.map(({ mode, icon: Icon, label }) => (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                variant={currentMode === mode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onChange(mode)}
                className="h-7 w-7 p-0"
                aria-label={label}
                aria-pressed={currentMode === mode}
              >
                <Icon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
