"use client";

import { useState } from "react";
import { DropdownMenuSubContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search } from "lucide-react";
import { getInitials } from "@/lib/inbox-utils";
import { useInboxMembers } from "@/hooks/inbox/use-inbox-data";
import { useAuthStore } from "@/stores/auth";
import type { BulkActionId, BulkActionPayload } from "@/types/inbox";

const headerClass = "px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-4";
const rowClass = "gap-3 rounded-[9px] px-2.5 py-2";

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

  const filtered = members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));
  const me = filtered.find((m) => m.id === myId);
  const others = filtered.filter((m) => m.id !== myId);

  return (
    <DropdownMenuSubContent className="w-64 p-[7px]">
      <div className={headerClass}>Assign {count} to</div>

      <div className="mb-0.5 flex items-center gap-2 rounded-[9px] bg-muted px-2.5 py-2">
        <Search size={14} className="shrink-0 text-foreground-4" />
        <input
          aria-label="Search teammates"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Search teammates…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-foreground-4"
        />
      </div>

      <DropdownMenuItem className={rowClass} onClick={() => onAction("assign", { memberId: "" })}>
        Unassigned
      </DropdownMenuItem>

      {(me || others.length > 0) && <DropdownMenuSeparator />}

      {me && <MemberRow label="Assign to me" subtitle="you" seed={me.name} memberId={me.id} onAction={onAction} />}
      {others.map((m) => (
        <MemberRow key={m.id} label={m.name} seed={m.name} memberId={m.id} onAction={onAction} />
      ))}
    </DropdownMenuSubContent>
  );
}

function MemberRow({
  label,
  subtitle,
  seed,
  memberId,
  onAction,
}: {
  label: string;
  subtitle?: string;
  seed: string;
  memberId: string;
  onAction: (a: BulkActionId, p?: BulkActionPayload) => void;
}) {
  return (
    <DropdownMenuItem className={rowClass} onClick={() => onAction("assign", { memberId })}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
        {getInitials(seed)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-foreground">{label}</span>
        {subtitle && <span className="truncate text-[11px] text-foreground-3">{subtitle}</span>}
      </span>
    </DropdownMenuItem>
  );
}
