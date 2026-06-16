'use client'

import type { TicketMeta } from '@/types/inbox'
import { usePermissions } from '@/hooks/use-permissions'

export function TicketActionBar({ meta, status, onClose, onAddTag, onRemoveTag, onFieldChange, assignedTo, onAssign, members }: {
  meta: TicketMeta;
  status: string;
  onClose: () => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onFieldChange: (key: string, value: string) => void;
  assignedTo: string | null;
  onAssign: (memberId: string | null) => void;
  members: { id: string; name: string }[];
}) {
  const { can } = usePermissions()
  const canManage = can.manageConversations
  const viewOnlyTitle = canManage ? undefined : 'View-only access — ask an admin.'

  const fieldButton = (key: keyof TicketMeta, label: string) => (
    <button
      onClick={() => onFieldChange(key, label)}
      disabled={!canManage}
      title={viewOnlyTitle}
      className="inline-flex items-center gap-1 border-none bg-transparent p-0 text-[10.5px] text-muted-foreground font-[inherit] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="text-foreground-2 font-semibold">{label}:</span>
      <span>{meta[key] || "+Add"}</span>
    </button>
  );

  return (
    <div className="flex items-center gap-2 pt-2 mt-[9px] border-t border-border min-h-[42px] flex-wrap">
      <button
        onClick={onClose}
        disabled={!canManage}
        className="inline-flex items-center gap-[5px] h-[26px] px-2.5 border border-black/9 rounded-[5px] bg-[#FAFAFA] text-foreground-2 text-xs font-semibold font-[inherit] disabled:opacity-50 disabled:cursor-not-allowed"
        title={canManage ? "Close ticket" : viewOnlyTitle}
      >
        <span className="text-xs">✓</span>
        {status === "closed" ? "Closed" : "Close"}
      </button>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(meta.tags || []).map((tag: string) => (
          <button
            key={tag}
            onClick={() => onRemoveTag(tag)}
            disabled={!canManage}
            title={canManage ? "Remove tag" : viewOnlyTitle}
            className="inline-flex items-center gap-1 h-[22px] px-2 border border-black/9 rounded-full bg-[#F5F5F5] text-foreground-2 text-[11px] font-medium font-[inherit] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tag}
            <span className="text-muted-foreground">×</span>
          </button>
        ))}
        <button
          onClick={onAddTag}
          disabled={!canManage}
          title={viewOnlyTitle}
          className="border-none bg-transparent text-[10.5px] text-muted-foreground font-[inherit] p-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +Add tag
        </button>
      </div>

      <div className="grid grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-[18px] flex-[1_1_420px] min-w-[320px]">
        {fieldButton("contactReason", "Contact reason")}
        {fieldButton("product", "Product")}
        {fieldButton("resolution", "Resolution")}
      </div>

      <select
        value={assignedTo || ""}
        onChange={(e) => onAssign(e.target.value || null)}
        disabled={!canManage}
        title={viewOnlyTitle}
        className="border border-border rounded-lg bg-card text-foreground-2 text-[11px] py-1 px-2 font-[inherit] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      <select
        value={meta.tier || "Unassigned"}
        onChange={(e) => onFieldChange("tier", e.target.value)}
        disabled={!canManage}
        title={viewOnlyTitle}
        className="ml-auto border border-border rounded-lg bg-card text-foreground-2 text-[11px] py-1 px-2 font-[inherit] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option>Unassigned</option>
        <option>Support</option>
        <option>Admin</option>
        <option>Escalated</option>
      </select>
    </div>
  );
}
