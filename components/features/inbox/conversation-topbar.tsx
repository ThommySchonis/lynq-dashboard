"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BellOff, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, User } from "lucide-react";
import { STATUS, SNOOZE_OPTIONS } from "@/lib/inbox-constants";
import { isoFromNow } from "@/lib/inbox-utils";
import type { InboxMember } from "@/hooks/inbox/use-inbox-data";

/**
 * Conversation detail top bar (Figma 1283-52902 "conv-topbar"): title + status
 * pill on row 1; assign + snooze (left) and Close / more / prev-next (right) on
 * row 2.
 */
export function ConversationTopbar({
  title,
  status,
  assignedTo,
  members,
  onStatus,
  onAssign,
  onSnooze,
  onSpam,
  onDelete,
  onPrev,
  onNext,
  canPrev,
  canNext,
  disabled = false,
}: {
  title: string;
  status: string;
  assignedTo: string | null;
  members: InboxMember[];
  onStatus: (status: string) => void;
  onAssign: (memberId: string) => void;
  onSnooze: (untilIso: string) => void;
  onSpam: () => void;
  onDelete: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  disabled?: boolean;
}) {
  const st = STATUS[status as keyof typeof STATUS];
  const assigneeName = members.find((m) => m.id === assignedTo)?.name ?? "Unassigned";

  return (
    <div className="flex flex-col gap-2.5 py-3.5 pr-3.5 pl-[18px] border-b border-border shrink-0 bg-card">
      {/* Row 1: title + status pill */}
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-[11px] py-[5px] text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary" />
            }
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: st?.color }} />
            {st?.label ?? status}
            <ChevronDown size={11} className="text-foreground-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {Object.entries(STATUS).map(([key, s]) => (
              <DropdownMenuItem key={key} disabled={disabled} onClick={() => onStatus(key)}>
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                {s.label}
                {status === key && <span className="ml-auto text-[10px] text-muted-foreground">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: assign + snooze | close + more + nav */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Assign */}
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
            <DropdownMenuContent align="start">
              <DropdownMenuItem disabled={disabled} onClick={() => onAssign("")}>
                Unassigned
                {!assignedTo && <span className="ml-auto text-[10px] text-muted-foreground">✓</span>}
              </DropdownMenuItem>
              {members.map((m) => (
                <DropdownMenuItem key={m.id} disabled={disabled} onClick={() => onAssign(m.id)}>
                  {m.name}
                  {assignedTo === m.id && <span className="ml-auto text-[10px] text-muted-foreground">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Snooze */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  title="Snooze"
                  className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-foreground-3 transition-colors hover:bg-secondary"
                />
              }
            >
              <BellOff size={14} />
              <ChevronDown size={11} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SNOOZE_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.label} disabled={disabled} onClick={() => onSnooze(isoFromNow(o.hours))}>
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => onStatus("closed")}
            disabled={disabled}
            className="rounded-[10px] border border-foreground bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Close
          </Button>

          {/* More */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  title="More actions"
                  className="flex size-8 items-center justify-center rounded-lg text-foreground-3 transition-colors hover:bg-secondary hover:text-foreground"
                />
              }
            >
              <MoreHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={disabled} onClick={onSpam}>
                Mark as spam
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" disabled={disabled} onClick={onDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Prev / next */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Previous conversation"
              onClick={onPrev}
              disabled={!canPrev}
              className="flex size-8 items-center justify-center rounded-lg text-foreground-3 transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Next conversation"
              onClick={onNext}
              disabled={!canNext}
              className="flex size-8 items-center justify-center rounded-lg text-foreground-3 transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
