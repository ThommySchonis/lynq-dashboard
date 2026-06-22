"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Ban, CircleCheck, Clock, FolderInput, MailOpen, MoreVertical, Sparkles, Tag, Trash2, User } from "lucide-react";
import { BulkConfirmDialog } from "./bulk-confirm-dialog";
import { BulkAssignPanel } from "./bulk-assign-panel";
import { BulkTagPanel } from "./bulk-tag-panel";
import { BULK_MENU_ROW_CLASS, BULK_MENU_HEADER_CLASS, SNOOZE_OPTIONS } from "@/lib/inbox-constants";
import { isoFromNow } from "@/lib/inbox-utils";
import type { BulkActionId, BulkActionPayload } from "@/types/inbox";

// Move-to targets statuses only — moving to another mailbox (Support/Sales/…)
// is backend-gated (BE task #1); see docs/inbox-figma-redesign-plan.md.
const MOVE_STATUSES: { status: "open" | "pending" | "resolved"; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "pending", label: "Pending" },
  { status: "resolved", label: "Resolved" },
];

export function BulkActionsMenu({ count, onAction }: { count: number; onAction: (action: BulkActionId, payload?: BulkActionPayload) => void }) {
  const [confirm, setConfirm] = useState<null | "delete" | "spam" | "emma">(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              title="More actions"
              className="text-foreground-2 flex p-1 rounded-[5px] transition-colors duration-150 hover:text-foreground"
            />
          }
        >
          <MoreVertical size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[246px] rounded-xl p-[7px]">
          <div className={BULK_MENU_HEADER_CLASS}>
            {count} conversation{count === 1 ? "" : "s"}
          </div>

          <DropdownMenuItem className={BULK_MENU_ROW_CLASS} onClick={() => onAction("mark_read")}>
            <MailOpen /> Mark as read
          </DropdownMenuItem>
          <DropdownMenuItem className={BULK_MENU_ROW_CLASS} onClick={() => onAction("resolve")}>
            <CircleCheck /> Mark as resolved
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={BULK_MENU_ROW_CLASS}>
              <Clock /> Snooze…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {SNOOZE_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.label} onClick={() => onAction("snooze", { until: isoFromNow(o.hours) })}>
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={BULK_MENU_ROW_CLASS}>
              <User /> Assign to…
            </DropdownMenuSubTrigger>
            <BulkAssignPanel count={count} onAction={onAction} />
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={BULK_MENU_ROW_CLASS}>
              <Tag /> Add tag…
            </DropdownMenuSubTrigger>
            <BulkTagPanel count={count} onAction={onAction} />
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={BULK_MENU_ROW_CLASS}>
              <FolderInput /> Move to…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-[7px]">
              <div className={BULK_MENU_HEADER_CLASS}>Move {count} to</div>
              {MOVE_STATUSES.map((t) => (
                <DropdownMenuItem key={t.status} className={BULK_MENU_ROW_CLASS} onClick={() => onAction("move", { status: t.status })}>
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem className={`${BULK_MENU_ROW_CLASS} text-primary`} onClick={() => setConfirm("emma")}>
            <Sparkles /> Hand off to Emma
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem className={BULK_MENU_ROW_CLASS} onClick={() => setConfirm("spam")}>
            <Ban /> Mark as spam
          </DropdownMenuItem>
          <DropdownMenuItem className={BULK_MENU_ROW_CLASS} variant="destructive" onClick={() => setConfirm("delete")}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BulkConfirmDialog
        open={confirm === "delete"}
        title={`Delete ${count} conversation${count === 1 ? "" : "s"}?`}
        description="They will be moved to Trash. You can restore them from the Trash folder."
        confirmLabel="Delete"
        onConfirm={() => onAction("delete")}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      />
      <BulkConfirmDialog
        open={confirm === "spam"}
        title={`Mark ${count} conversation${count === 1 ? "" : "s"} as spam?`}
        description="They will be moved to the Spam folder and hidden from your open queues."
        confirmLabel="Mark as spam"
        onConfirm={() => onAction("spam")}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      />
      <BulkConfirmDialog
        open={confirm === "emma"}
        title={`Hand off ${count} conversation${count === 1 ? "" : "s"} to Emma?`}
        description="Emma will generate a draft reply for each (for your review — nothing is sent automatically). Each generated draft uses 1 Emma credit; conversations that already have a pending draft are skipped."
        confirmLabel="Generate drafts"
        destructive={false}
        onConfirm={() => onAction("emma_handoff")}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      />
    </>
  );
}
