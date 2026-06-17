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
import { MoreVertical } from "lucide-react";
import { BulkConfirmDialog } from "./bulk-confirm-dialog";
import { useTags, useCreateTag } from "@/hooks/inbox/use-tags";
import { useInboxMembers } from "@/hooks/inbox/use-inbox-data";
import type { BulkActionId, BulkActionPayload } from "@/types/inbox";

const SNOOZE_OPTIONS: { label: string; hours: number }[] = [
  { label: "Later today", hours: 4 },
  { label: "Tomorrow", hours: 24 },
  { label: "Next week", hours: 24 * 7 },
];

function isoFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export function BulkActionsMenu({ count, onAction }: { count: number; onAction: (action: BulkActionId, payload?: BulkActionPayload) => void }) {
  const { data: tags = [] } = useTags();
  const { data: members = [] } = useInboxMembers();
  const createTag = useCreateTag();
  const [confirm, setConfirm] = useState<null | "delete" | "spam">(null);
  const [newTagName, setNewTagName] = useState("");

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const tag = await createTag.mutateAsync({ name });
    setNewTagName("");
    onAction("add_tag", { tagId: tag.id });
  };

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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => onAction("mark_read")}>Mark as read</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("resolve")}>Mark as resolved</DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Snooze…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {SNOOZE_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.label} onClick={() => onAction("snooze", { until: isoFromNow(o.hours) })}>
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Assign to…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onAction("assign", { memberId: "" })}>Unassigned</DropdownMenuItem>
              {members.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => onAction("assign", { memberId: m.id })}>
                  {m.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Add tag…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {tags.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => onAction("add_tag", { tagId: t.id })}>
                  {t.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="flex items-center gap-1 px-1.5 py-1">
                <input
                  aria-label="Create tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateTag();
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="Create tag…"
                  className="w-full bg-input border border-border rounded px-2 py-1 text-xs outline-none"
                />
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onAction("move", { status: "open" })}>Open</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("move", { status: "pending" })}>Pending</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("move", { status: "resolved" })}>Resolved</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled title="Coming soon">
            Hand off to Emma
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirm("spam")}>Mark as spam</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
            Delete
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
    </>
  );
}
