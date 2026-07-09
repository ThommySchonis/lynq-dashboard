"use client";

import { useState } from "react";
import { DropdownMenuSubContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { BulkMenuSearch } from "./bulk-menu-search";
import { getInitials, memberLabel } from "@/lib/inbox-utils";
import { BULK_MENU_ROW_CLASS, BULK_MENU_HEADER_CLASS, ASSIGNABLE_ROLES } from "@/lib/inbox-constants";
import { useMembers } from "@/hooks/settings";
import { useAuthStore } from "@/stores/auth";
import type { BulkActionId, BulkActionPayload } from "@/types/inbox";

/**
 * Assign-to submenu panel (Figma 1310-60737 "dropdown · assignee"): grey section
 * header, teammate search, Unassigned, then "Assign to me" + the assignable
 * members (owner / admin / agent) shown as name over email.
 *
 * Members come from the workspace-members source that Settings → Users uses, so
 * names and emails are always real — the inbox `/members` endpoint returns
 * neither the email nor the role.
 */
export function BulkAssignPanel({ count, onAction }: { count: number; onAction: (a: BulkActionId, p?: BulkActionPayload) => void }) {
  const { data: allMembers = [] } = useMembers();
  const myId = useAuthStore((s) => s.memberId);
  const [query, setQuery] = useState("");

  // Every member the RPC returns is an accepted workspace member (pending
  // invitees come back in a separate `invites` array), so only the role matters.
  const q = query.toLowerCase();
  const filtered = allMembers
    .filter((m) => ASSIGNABLE_ROLES.includes(m.role))
    .filter((m) => memberLabel(m).toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    .sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : 0)); // self first

  return (
    <DropdownMenuSubContent className="w-72 p-[7px]">
      <div className={BULK_MENU_HEADER_CLASS}>Assign {count} to</div>

      <BulkMenuSearch value={query} onChange={setQuery} placeholder="Search teammates…" ariaLabel="Search teammates" />

      <DropdownMenuItem className={BULK_MENU_ROW_CLASS} onClick={() => onAction("assign", { memberId: "" })}>
        Unassigned
      </DropdownMenuItem>

      {filtered.length > 0 && <DropdownMenuSeparator />}

      {filtered.map((m) => {
        const isMe = m.id === myId;
        const primary = isMe ? "Assign to me" : memberLabel(m);
        // Skip the email line when it would just repeat the headline.
        const showEmail = isMe || Boolean(m.display_name);
        return (
          <DropdownMenuItem key={m.id} className={BULK_MENU_ROW_CLASS} onClick={() => onAction("assign", { memberId: m.id })}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {getInitials(memberLabel(m))}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-foreground">{primary}</span>
              {showEmail && <span className="truncate text-[11px] text-foreground-3">{m.email}</span>}
            </span>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuSubContent>
  );
}
