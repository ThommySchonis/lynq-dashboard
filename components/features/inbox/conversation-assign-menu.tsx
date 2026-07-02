"use client";

import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BulkMenuSearch } from "./bulk-menu-search";
import { Check, ChevronDown, User } from "lucide-react";
import { getInitials } from "@/lib/inbox-utils";
import { useAuthStore } from "@/stores/auth";
import type { InboxMember } from "@/hooks/inbox/use-inbox-data";

const PANEL = "rounded-[14px] p-[7px] w-64";
const ROW = "gap-2.5 rounded-[9px] px-2.5 py-2 text-[14px]";

/**
 * Assign dropdown for the conversation top bar (Figma 1145-39158): teammate
 * search, Unassigned, Emma, then members with initials avatars. Member roles
 * aren't in the payload (only id/name) so only "you" is shown; the Emma row is
 * display-only (assigning to Emma = hand-off, a separate flow).
 */
export function ConversationAssignMenu({
  assignedTo,
  members,
  onAssign,
  disabled = false,
}: {
  assignedTo: string | null;
  members: InboxMember[];
  onAssign: (memberId: string) => void;
  disabled?: boolean;
}) {
  const myId = useAuthStore((s) => s.memberId);
  const [query, setQuery] = useState("");

  const filtered = members
    .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : 0));

  const assigneeName = members.find((m) => m.id === assignedTo)?.name ?? "Unassigned";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-secondary" />
        }
      >
        <User size={14} className="text-foreground-3" />
        <span className="max-w-[140px] truncate">{assigneeName}</span>
        <ChevronDown size={11} className="text-foreground-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={PANEL}>
        <BulkMenuSearch value={query} onChange={setQuery} placeholder="Search teammates…" ariaLabel="Search teammates" />

        <DropdownMenuItem className={`${ROW} ${!assignedTo ? "bg-secondary" : ""}`} onClick={() => onAssign("")} disabled={disabled}>
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-muted text-foreground-3">
            <User size={14} />
          </span>
          <span className="flex-1 font-medium text-foreground">Unassigned</span>
          {!assignedTo && <Check size={14} className="text-foreground-3" />}
        </DropdownMenuItem>

        <div className="my-1 h-px bg-border" />

        {filtered.map((m) => {
          const isMe = m.id === myId;
          return (
            <DropdownMenuItem key={m.id} className={`${ROW} ${assignedTo === m.id ? "bg-secondary" : ""}`} onClick={() => onAssign(m.id)} disabled={disabled}>
              <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-foreground-4 text-[10px] font-semibold text-white">
                {getInitials(m.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-foreground">{isMe ? "Assign to me" : m.name}</span>
                {isMe && <span className="truncate text-[11px] text-foreground-3">you</span>}
              </span>
              {assignedTo === m.id && <Check size={14} className="text-foreground-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
