
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export interface CustomerFilterProps {
  search: string;
}

interface CustomerFiltersProps {
  filters: CustomerFilterProps;
  onFiltersChange: (filters: Partial<CustomerFilterProps>) => void;
  onClearFilters: () => void;
}

export const CustomerFilters = ({ filters, onFiltersChange, onClearFilters }: CustomerFiltersProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Command+K (Mac) or Control+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Don't trigger if user is typing in an input, textarea, or contenteditable element
        const target = e.target as HTMLElement;
        const isInputElement =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (!isInputElement) {
          e.preventDefault();
          // Focus the search input
          searchInputRef.current?.focus();
          // Select all text if there's any
          searchInputRef.current?.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gm-neutral-800 p-4 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gm-neutral-400 dark:text-gm-neutral-500 h-4 w-4" />
          <Input
            ref={searchInputRef}
            placeholder="Search by name, email, or phone... (⌘K or Ctrl+K)"
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="pl-10"
          />
        </div>

        {/* Clear Filters */}
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
};
