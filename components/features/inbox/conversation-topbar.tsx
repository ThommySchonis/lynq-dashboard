"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ConversationStatusMenu } from "./conversation-status-menu";
import { ConversationAssignMenu } from "./conversation-assign-menu";
import { ConversationSnoozeMenu } from "./conversation-snooze-menu";
import { ConversationMoreMenu } from "./conversation-more-menu";
import type { InboxMember } from "@/hooks/inbox/use-inbox-data";

/**
 * Conversation detail top bar (Figma 1283-52902 "conv-topbar"): title + status
 * pill on row 1; assign + snooze (left) and Close / more / prev-next (right) on
 * row 2. The status / assign / snooze / "…" dropdowns match Figma 1145-40855 /
 * -39158 / -40043 / -39347.
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
  return (
    <div className="flex flex-col gap-2.5 py-3.5 pr-3.5 pl-[18px] border-b border-border shrink-0 bg-card">
      {/* Row 1: title + status pill */}
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
        <ConversationStatusMenu status={status} onStatus={onStatus} onSnooze={onSnooze} onSpam={onSpam} disabled={disabled} />
      </div>

      {/* Row 2: assign + snooze | close + more + nav */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ConversationAssignMenu assignedTo={assignedTo} members={members} onAssign={onAssign} disabled={disabled} />
          <ConversationSnoozeMenu onSnooze={onSnooze} disabled={disabled} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => onStatus("closed")}
            disabled={disabled}
            className="rounded-[10px] border border-foreground bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Close
          </Button>

          <ConversationMoreMenu onSpam={onSpam} onDelete={onDelete} disabled={disabled} />

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
