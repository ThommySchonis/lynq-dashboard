"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Ban, BellOff, Check, ChevronDown, CircleDot, CircleCheck, Clock, Sparkles } from "lucide-react";
import { STATUS } from "@/lib/inbox-constants";
import { isoFromNow } from "@/lib/inbox-utils";
import { BULK_MENU_HEADER_CLASS } from "@/lib/inbox-constants";

const PANEL = "rounded-[14px] p-[7px]";
const ROW = "gap-3 rounded-[9px] px-2.5 py-2 text-[14px]";

/**
 * Status pill + dropdown for the conversation top bar (Figma 1145-40855):
 * STATUS header, then Open / Pending / Snoozed / Resolved / AI handled / spam.
 * "AI handled" has no backend status yet → no-op (BE task #8).
 */
export function ConversationStatusMenu({
  status,
  onStatus,
  onSnooze,
  onSpam,
  disabled = false,
}: {
  status: string;
  onStatus: (status: string) => void;
  onSnooze: (untilIso: string) => void;
  onSpam: () => void;
  disabled?: boolean;
}) {
  const st = STATUS[status as keyof typeof STATUS];

  return (
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
      <DropdownMenuContent align="end" className={PANEL}>
        <div className={BULK_MENU_HEADER_CLASS}>Status</div>
        <StatusItem active={status === "open"} icon={<CircleDot size={16} />} label="Open" onClick={() => onStatus("open")} disabled={disabled} />
        <StatusItem active={status === "pending"} icon={<Clock size={16} />} label="Pending" onClick={() => onStatus("pending")} disabled={disabled} />
        <StatusItem active={status === "snoozed"} icon={<BellOff size={16} />} label="Snoozed" onClick={() => onSnooze(isoFromNow(4))} disabled={disabled} />
        <StatusItem active={status === "resolved"} icon={<CircleCheck size={16} />} label="Resolved" onClick={() => onStatus("resolved")} disabled={disabled} />
        <StatusItem active={false} icon={<Sparkles size={16} />} label="AI handled" onClick={() => {}} disabled={disabled} />
        <StatusItem active={false} icon={<Ban size={16} />} label="Mark as spam" onClick={onSpam} disabled={disabled} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusItem({
  active,
  icon,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenuItem className={`${ROW} ${active ? "bg-secondary" : ""}`} onClick={onClick} disabled={disabled}>
      <span className="text-foreground-3">{icon}</span>
      <span className="flex-1">{label}</span>
      {active && <Check size={14} className="text-foreground-3" />}
    </DropdownMenuItem>
  );
}
