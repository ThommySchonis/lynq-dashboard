"use client";

import { useState } from "react";
import { DropdownMenuSubContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Search } from "lucide-react";
import { paletteFor } from "@/lib/tags";
import { useTags, useCreateTag } from "@/hooks/inbox/use-tags";
import type { BulkActionId, BulkActionPayload } from "@/types/inbox";

const headerClass = "px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-4";
const rowClass = "gap-3 rounded-[9px] px-2.5 py-2";

/**
 * Add-tag submenu panel (Figma 1310-61301 "submenu · add tag"): grey section
 * header, search-or-create input, tag list with colour dots, and a "Create new
 * tag" affordance when the query has no exact match. Clicking a tag adds it to
 * all selected conversations (no per-conversation toggle state in bulk mode).
 */
export function BulkTagPanel({ count, onAction }: { count: number; onAction: (a: BulkActionId, p?: BulkActionPayload) => void }) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(trimmed.toLowerCase()));
  const exists = tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  const create = async () => {
    if (!trimmed) return;
    const tag = await createTag.mutateAsync({ name: trimmed });
    setQuery("");
    onAction("add_tag", { tagId: tag.id });
  };

  return (
    <DropdownMenuSubContent className="w-64 p-[7px]">
      <div className={headerClass}>Add tags to {count}</div>

      <div className="mb-0.5 flex items-center gap-2 rounded-[9px] bg-muted px-2.5 py-2">
        <Search size={14} className="shrink-0 text-foreground-4" />
        <input
          aria-label="Search or create a tag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && trimmed && !exists) {
              e.preventDefault();
              void create();
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Search or create a tag…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-foreground-4"
        />
      </div>

      {filtered.map((t) => (
        <DropdownMenuItem key={t.id} className={rowClass} onClick={() => onAction("add_tag", { tagId: t.id })}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: paletteFor(t.color).dot }} aria-hidden />
          <span className="truncate font-medium text-foreground">{t.name}</span>
        </DropdownMenuItem>
      ))}

      {trimmed && !exists && (
        <>
          {filtered.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem className={`${rowClass} text-primary`} onClick={() => void create()}>
            <Plus size={16} /> Create “{trimmed}”
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuSubContent>
  );
}
