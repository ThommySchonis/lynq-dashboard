"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BellOff, CalendarClock, CalendarDays, ChevronDown, Clock, MessageCircle, Sunrise } from "lucide-react";
import { BULK_MENU_HEADER_CLASS } from "@/lib/inbox-constants";

const PANEL = "rounded-[14px] p-[7px] w-64";
const ROW = "gap-3 rounded-[9px] px-2.5 py-2 text-[14px]";

/** Snooze presets resolved to ISO at click time, with their human label. */
function snoozeLater(): { iso: string; label: string } {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return { iso: d.toISOString(), label: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) };
}
function snoozeTomorrow(): { iso: string; label: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return { iso: d.toISOString(), label: "9:00 AM" };
}
function snoozeWeekend(): { iso: string; label: string } {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  return { iso: d.toISOString(), label: "Sat" };
}
function snoozeNextWeek(): { iso: string; label: string } {
  const d = new Date();
  d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  return { iso: d.toISOString(), label: "Mon, 9 AM" };
}

/**
 * Snooze dropdown for the conversation top bar (Figma 1145-40043). "Until
 * customer replies" and "Pick date & time" have no backend support yet → no-op
 * (BE task #8).
 */
export function ConversationSnoozeMenu({ onSnooze, disabled = false }: { onSnooze: (untilIso: string) => void; disabled?: boolean }) {
  const later = snoozeLater();
  const tomorrow = snoozeTomorrow();
  const weekend = snoozeWeekend();
  const nextWeek = snoozeNextWeek();

  return (
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
      <DropdownMenuContent align="start" className={PANEL}>
        <div className={BULK_MENU_HEADER_CLASS}>Snooze until</div>
        <SnoozeItem icon={<Clock size={16} />} label="Later today" trailing={later.label} onClick={() => onSnooze(later.iso)} disabled={disabled} />
        <SnoozeItem icon={<Sunrise size={16} />} label="Tomorrow" trailing={tomorrow.label} onClick={() => onSnooze(tomorrow.iso)} disabled={disabled} />
        <SnoozeItem icon={<CalendarDays size={16} />} label="This weekend" trailing={weekend.label} onClick={() => onSnooze(weekend.iso)} disabled={disabled} />
        <SnoozeItem icon={<CalendarDays size={16} />} label="Next week" trailing={nextWeek.label} onClick={() => onSnooze(nextWeek.iso)} disabled={disabled} />
        <div className="my-1 h-px bg-border" />
        <SnoozeItem icon={<MessageCircle size={16} />} label="Until customer replies" onClick={() => {}} disabled={disabled} />
        <SnoozeItem icon={<CalendarClock size={16} />} label="Pick date & time" onClick={() => {}} disabled={disabled} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SnoozeItem({
  icon,
  label,
  trailing,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenuItem className={ROW} onClick={onClick} disabled={disabled}>
      <span className="text-foreground-3">{icon}</span>
      <span className="flex-1">{label}</span>
      {trailing && <span className="text-[12px] text-foreground-4">{trailing}</span>}
    </DropdownMenuItem>
  );
}
