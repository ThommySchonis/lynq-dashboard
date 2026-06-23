"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Ban, GitMerge, ListChecks, Mail, MoreHorizontal, Printer, Trash2, Zap } from "lucide-react";

const PANEL = "rounded-[14px] p-[7px] w-[286px]";
const ROW = "gap-3 rounded-[9px] px-3 py-2.5 text-[14px]";

/**
 * Three-dots menu for the conversation top bar (Figma 1145-39347). Merge ticket,
 * Mark as unread, Show all events, Show all quick replies and Print ticket have
 * no backend support yet → no-op (BE backlog). Mark as spam / Move to trash wire
 * to the existing single-conversation actions.
 */
export function ConversationMoreMenu({ onSpam, onDelete, disabled = false }: { onSpam: () => void; onDelete: () => void; disabled?: boolean }) {
  return (
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
      <DropdownMenuContent align="end" className={PANEL}>
        <MoreItem icon={<GitMerge size={18} />} label="Merge ticket" onClick={() => {}} disabled={disabled} />
        <MoreItem icon={<Mail size={18} />} label="Mark as unread" onClick={() => {}} disabled={disabled} />
        <MoreItem icon={<ListChecks size={18} />} label="Show all events" onClick={() => {}} disabled={disabled} />
        <MoreItem icon={<Zap size={18} />} label="Show all quick replies" onClick={() => {}} disabled={disabled} />
        <MoreItem icon={<Printer size={18} />} label="Print ticket" onClick={() => {}} disabled={disabled} />
        <MoreItem icon={<Ban size={18} />} label="Mark as spam" onClick={onSpam} disabled={disabled} />
        <div className="my-1 h-px bg-border" />
        <DropdownMenuItem className={ROW} variant="destructive" onClick={onDelete} disabled={disabled}>
          <Trash2 size={18} />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreItem({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled: boolean }) {
  return (
    <DropdownMenuItem className={ROW} onClick={onClick} disabled={disabled}>
      <span className="text-foreground-3">{icon}</span>
      {label}
    </DropdownMenuItem>
  );
}
