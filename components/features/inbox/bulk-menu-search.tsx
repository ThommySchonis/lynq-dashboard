"use client";

import type { KeyboardEvent } from "react";
import { Search } from "lucide-react";

/**
 * Search input row shared by the bulk-actions sub-panels (assign, add tag).
 * Stops keydown/pointerdown from reaching the base-ui menu (typeahead / close);
 * pass `onKeyDown` for extra behaviour like Enter-to-create.
 */
export function BulkMenuSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="mb-0.5 flex items-center gap-2 rounded-[9px] bg-muted px-2.5 py-2">
      <Search size={14} className="shrink-0 text-foreground-4" />
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          onKeyDown?.(e);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-foreground-4"
      />
    </div>
  );
}
