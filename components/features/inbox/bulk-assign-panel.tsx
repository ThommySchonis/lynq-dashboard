"use client";

import { useState } from "react";
import { DropdownMenuSubContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { BulkMenuSearch } from "./bulk-menu-search";
import { getInitials } from "@/lib/inbox-utils";
import { BULK_MENU_ROW_CLASS, BULK_MENU_HEADER_CLASS } from "@/lib/inbox-constants";
import { useInboxMembers } from "@/hooks/inbox/use-inbox-data";
import { useAuthStore } from "@/stores/auth";
import type { BulkActionId, BulkActionPayload } from "@/types/inbox";

/**
 * Assign-to submenu panel (Figma 1310-60737 "dropdown · assignee"): grey section
 * header, teammate search, Unassigned, then "Assign to me" + members with
 * initials avatars. Roles/subtitles beyond "you" aren't in the members payload,
 * so they're omitted.
 */
export function BulkAssignPanel({ count, onAction }: { count: number; onAction: (a: BulkActionId, p?: BulkActionPayload) => void }) {
  const { data: members = [] } = useInboxMembers();
  const myId = useAuthStore((s) => s.memberId);
  const [query, setQuery] = useState("");

  const filtered = members
    .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : 0)); // self first

  return (
    <DropdownMenuSubContent className="w-64 p-[7px]">
      <div className={BULK_MENU_HEADER_CLASS}>Assign {count} to</div>

      <BulkMenuSearch value={query} onChange={setQuery} placeholder="Search teammates…" ariaLabel="Search teammates" />

      <DropdownMenuItem className={BULK_MENU_ROW_CLASS} onClick={() => onAction("assign", { memberId: "" })}>
        Unassigned
      </DropdownMenuItem>

      {filtered.length > 0 && <DropdownMenuSeparator />}

      {filtered.map((m) => {
        const isMe = m.id === myId;
        return (
          <DropdownMenuItem key={m.id} className={BULK_MENU_ROW_CLASS} onClick={() => onAction("assign", { memberId: m.id })}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {getInitials(m.name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-foreground">{isMe ? "Assign to me" : m.name}</span>
              {isMe && <span className="truncate text-[11px] text-foreground-3">you</span>}
            </span>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuSubContent>
  );
}
