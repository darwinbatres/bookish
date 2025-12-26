"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder = "Select or type...",
  emptyText = "No suggestions",
  className,
  id,
  disabled = false,
}: AutocompleteInputProps) {
  const [open, setOpen] = React.useState(false);
  // Track what user is typing in the search box (separate from selected value)
  const [searchQuery, setSearchQuery] = React.useState("");

  // Reset search query when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  // Filter suggestions based on search query (not the selected value)
  // When search is empty, show ALL suggestions
  const filteredSuggestions = React.useMemo(() => {
    if (!searchQuery) return suggestions;
    const lower = searchQuery.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower));
  }, [searchQuery, suggestions]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (newQuery: string) => {
    setSearchQuery(newQuery);
    // Also update the actual value as user types (so they can enter custom values)
    onChange(newQuery);
  };

  // Handle keyboard events for custom input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery && filteredSuggestions.length === 0) {
      // Allow pressing Enter to use custom value when no matches
      e.preventDefault();
      onChange(searchQuery);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onKeyDown={handleKeyDown}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type..."
            value={searchQuery}
            onValueChange={handleInputChange}
          />
          <CommandList>
            {filteredSuggestions.length === 0 && suggestions.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            {filteredSuggestions.length === 0 && searchQuery && (
              <CommandItem
                onSelect={() => handleSelect(searchQuery)}
                className="cursor-pointer"
              >
                <span className="text-muted-foreground">Add:</span>
                <span className="ml-1 font-medium">"{searchQuery}"</span>
              </CommandItem>
            )}
            <CommandGroup>
              {filteredSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  value={suggestion}
                  onSelect={() => handleSelect(suggestion)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === suggestion ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {suggestion}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
