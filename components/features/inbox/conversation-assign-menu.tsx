"use client";

import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BulkMenuSearch } from "./bulk-menu-search";
import { Check, ChevronDown, User } from "lucide-react";
import { getInitials, memberLabel } from "@/lib/inbox-utils";
import { ASSIGNABLE_ROLES } from "@/lib/inbox-constants";
import { useMembers } from "@/hooks/settings";
import { useAuthStore } from "@/stores/auth";

const PANEL = "rounded-[14px] p-[7px] w-72";
const ROW = "gap-2.5 rounded-[9px] px-2.5 py-2 text-[14px]";

/**
 * Assign dropdown for the conversation top bar (Figma 1145-39158): teammate
 * search, Unassigned, then the assignable members (owner / admin / agent) shown
 * as name over email.
 *
 * Members come from the workspace-members source that Settings → Users uses, so
 * names and emails are always real — the inbox `/members` endpoint returns
 * neither the email nor the role, and falls back to a literal "Teammate" when a
 * profile has no display name.
 */
export function ConversationAssignMenu({
  assignedTo,
  onAssign,
  disabled = false,
}: {
  assignedTo: string | null;
  onAssign: (memberId: string) => void;
  disabled?: boolean;
}) {
  const myId = useAuthStore((s) => s.memberId);
  const [query, setQuery] = useState("");
  const { data: allMembers = [] } = useMembers();

  // Every member the RPC returns is an accepted workspace member (pending
  // invitees come back in a separate `invites` array), so only the role matters.
  const assignable = allMembers.filter((m) => ASSIGNABLE_ROLES.includes(m.role));

  const q = query.toLowerCase();
  const filtered = assignable
    .filter((m) => memberLabel(m).toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    .sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : 0));

  const assignee = assignable.find((m) => m.id === assignedTo);
  const assigneeName = assignee ? memberLabel(assignee) : "Unassigned";

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
          const primary = isMe ? "Assign to me" : memberLabel(m);
          // Skip the email line when it would just repeat the headline.
          const showEmail = isMe || Boolean(m.display_name);
          return (
            <DropdownMenuItem key={m.id} className={`${ROW} ${assignedTo === m.id ? "bg-secondary" : ""}`} onClick={() => onAssign(m.id)} disabled={disabled}>
              <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-foreground-4 text-[10px] font-semibold text-white">
                {getInitials(memberLabel(m))}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-foreground">{primary}</span>
                {showEmail && <span className="truncate text-[11px] text-foreground-3">{m.email}</span>}
              </span>
              {assignedTo === m.id && <Check size={14} className="shrink-0 text-foreground-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
