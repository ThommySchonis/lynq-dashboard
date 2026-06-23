"use client";

import { useState } from "react";
import { DropdownMenuSubContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { BulkMenuSearch } from "./bulk-menu-search";
import { paletteFor } from "@/lib/tags";
import { BULK_MENU_ROW_CLASS, BULK_MENU_HEADER_CLASS } from "@/lib/inbox-constants";
import { useTags, useCreateTag } from "@/hooks/inbox/use-tags";
import type { BulkActionId, BulkActionPayload } from "@/types/inbox";

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
      <div className={BULK_MENU_HEADER_CLASS}>Add tags to {count}</div>

      <BulkMenuSearch
        value={query}
        onChange={setQuery}
        placeholder="Search or create a tag…"
        ariaLabel="Search or create a tag"
        onKeyDown={(e) => {
          if (e.key === "Enter" && trimmed && !exists) {
            e.preventDefault();
            void create();
          }
        }}
      />

      {filtered.map((t) => (
        <DropdownMenuItem key={t.id} className={BULK_MENU_ROW_CLASS} onClick={() => onAction("add_tag", { tagId: t.id })}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: paletteFor(t.color).dot }} aria-hidden />
          <span className="truncate font-medium text-foreground">{t.name}</span>
        </DropdownMenuItem>
      ))}

      {trimmed && !exists && (
        <>
          {filtered.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem className={`${BULK_MENU_ROW_CLASS} text-primary`} onClick={() => void create()}>
            <Plus size={16} /> Create “{trimmed}”
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuSubContent>
  );
}
