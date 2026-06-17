"use client";

import { Button } from "@/components/ui/button";
import { Check, Mail, Plus, RefreshCw, Search } from "lucide-react";
import { BulkActionsMenu } from "@/components/features/inbox/bulk-actions-menu";
import { useBulkConversationAction } from "@/hooks/inbox/use-inbox-mutations";
import { toast } from "sonner";
import type { BulkActionId, BulkActionPayload } from "@/types/inbox";
import { extractName } from "@/lib/inbox-utils";
import { relTime as formatDate } from "@/lib/inbox-utils";
import { useInboxUI } from "@/stores/inbox-ui";
import { useAuthStore } from "@/stores/auth";
import { useConversations, useInboxCounts } from "@/hooks/inbox/use-inbox-data";
import { useSyncInbox } from "@/hooks/inbox/use-inbox-mutations";
import { useAIStore } from "@/stores/ai";
import { URGENCY_SCORE } from "@/lib/inbox-constants";
import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Thread } from "@/types/inbox";
import { MailboxSwitcher } from "@/components/features/inbox/mailbox-switcher";

export function ThreadListPanel() {
  const router = useRouter();
  const isSuspended = useAuthStore((s) => s.isSuspended);

  // Zustand UI state
  const activeFolder = useInboxUI((s) => s.activeFolder);
  const search = useInboxUI((s) => s.search);
  const selectedThreadId = useInboxUI((s) => s.selectedThreadId);
  const checkedThreads = useInboxUI((s) => s.checkedThreads);
  const syncing = useInboxUI((s) => s.syncing);
  const setActiveFolder = useInboxUI((s) => s.setActiveFolder);
  const setSearch = useInboxUI((s) => s.setSearch);
  const setSelectedThreadId = useInboxUI((s) => s.setSelectedThreadId);
  const setCheckedThreads = useInboxUI((s) => s.setCheckedThreads);
  const setSyncing = useInboxUI((s) => s.setSyncing);
  const resetForNewThread = useInboxUI((s) => s.resetForNewThread);

  // TanStack data
  const { data: threads = [], isLoading: loadingThreads, refetch: refetchThreads } = useConversations(activeFolder, search);
  const { data: counts = { open: 0, pending: 0, resolved: 0, snoozed: 0, spam: 0, unlinked: 0, trash: 0 } } = useInboxCounts();

  // AI analyses from Zustand
  const analyses = useAIStore((s) => s.analyses);
  const resetAIForThread = useAIStore((s) => s.resetForThread);

  // Sync mutation
  const syncInboxMutation = useSyncInbox();

  // Sorted + filtered threads
  const sortedFiltered = useMemo(() => {
    const filtered = threads.filter(
      (t: Thread) =>
        !search ||
        t.subject?.toLowerCase().includes(search.toLowerCase()) ||
        (t.customer_name || t.customer_email || t.from || "").toLowerCase().includes(search.toLowerCase()),
    );
    return [...filtered].sort((a: Thread, b: Thread) => {
      const sa = URGENCY_SCORE[analyses[a.id]?.urgency] || 0;
      const sb = URGENCY_SCORE[analyses[b.id]?.urgency] || 0;
      if (sb !== sa) return sb - sa;
      return new Date(b.last_message_at || b.date).getTime() - new Date(a.last_message_at || a.date).getTime();
    });
  }, [threads, search, analyses]);

  // Handlers
  const onSelectThread = useCallback(
    (thread: Thread) => {
      setSelectedThreadId(thread.id);
      resetForNewThread();
      resetAIForThread();
    },
    [setSelectedThreadId, resetForNewThread, resetAIForThread],
  );

  const onSwitchFolder = useCallback(
    (key: string) => {
      setActiveFolder(key);
      setSelectedThreadId(null);
    },
    [setActiveFolder, setSelectedThreadId],
  );

  const onSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncInboxMutation.mutateAsync();
    } catch {}
    setSyncing(false);
    void refetchThreads();
  }, [setSyncing, syncInboxMutation, refetchThreads]);

  const onCreateTicket = useCallback(() => {
    router.push("/inbox/create");
  }, [router]);

  const getStatus = useCallback(
    (id: string) => {
      const thread = threads.find((t: Thread) => t.id === id);
      return thread?.status || "open";
    },
    [threads],
  );

  // Computed
  const listIds = sortedFiltered.map((t) => t.id);
  const allChecked = listIds.length > 0 && listIds.every((id) => checkedThreads[id]);
  const anyChecked = listIds.some((id) => checkedThreads[id]);
  const checkedCount = listIds.filter((id) => checkedThreads[id]).length;

  const bulkAction = useBulkConversationAction();

  const checkedIds = useMemo(() => listIds.filter((id) => checkedThreads[id]), [listIds, checkedThreads]);

  const onBulkAction = useCallback(
    async (action: BulkActionId, payload?: BulkActionPayload) => {
      if (checkedIds.length === 0) return;
      try {
        const res = await bulkAction.mutateAsync({ ids: checkedIds, action, payload });
        const n = res.count ?? checkedIds.length;
        setCheckedThreads({});
        toast.success(`Updated ${n} conversation${n === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    },
    [checkedIds, bulkAction, setCheckedThreads],
  );

  const FOLDERS = [
    { key: "open", label: "Open", count: counts.open },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "snoozed", label: "Snoozed", count: counts.snoozed },
    { key: "resolved", label: "Resolved", count: counts.resolved },
    { key: "spam", label: "Spam", count: counts.spam },
    { key: "unlinked", label: "Unlinked", count: counts.unlinked },
    { key: "trash", label: "Trash", count: counts.trash },
  ];

  const URGENCY_UI: Record<string, { color: string; bg: string; border: string }> = {
    critical: {
      color: "#ef4444",
      bg: "rgba(239,68,68,0.13)",
      border: "rgba(239,68,68,0.55)",
    },
    high: {
      color: "#f97316",
      bg: "rgba(249,115,22,0.13)",
      border: "rgba(249,115,22,0.55)",
    },
    medium: {
      color: "#fbbf24",
      bg: "rgba(251,191,36,0.12)",
      border: "rgba(251,191,36,0.4)",
    },
    low: {
      color: "#4ade80",
      bg: "rgba(74,222,128,0.09)",
      border: "rgba(74,222,128,0.3)",
    },
  };

  return (
    <div className="w-[260px] flex flex-col shrink-0 relative z-[1] bg-card border-r border-border dark:bg-[rgba(10,4,28,0.52)] dark:backdrop-blur-[24px] dark:border-r-[rgba(255,255,255,0.07)]">
      {/* Header */}
      <div className="px-3.5 pt-3.5 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-foreground tracking-[-0.01em]">Inbox</span>
            <span title="Shortcuts: j/k navigate · r reply" className="text-[9.5px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded cursor-default">
              j/k/r
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void onSync()}
              className={`p-[5px] rounded-[7px] transition-all duration-150 ${syncing ? "text-foreground-2" : "text-muted-foreground"}`}
              title="Sync & Refresh"
            >
              <span className={`flex ${syncing ? "animate-spin" : ""}`}>
                <RefreshCw size={14} />
              </span>
            </Button>
            <Button
              onClick={onCreateTicket}
              disabled={isSuspended}
              className="flex items-center gap-[5px] px-[11px] py-[5px] rounded-lg bg-[#111111] text-white text-[11.5px] font-semibold font-inherit transition-all duration-[180ms] tracking-[.01em] hover:bg-[#333333]"
              title={isSuspended ? "Workspace is suspended" : "Create Ticket"}
            >
              <Plus size={12} />
              Create Ticket
            </Button>
          </div>
        </div>

        {/* Mailbox switcher */}
        <MailboxSwitcher />

        {/* Search */}
        <div className="relative mb-2.5">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex">
            <Search size={14} />
          </span>
          <input
            className="w-full py-[9px] pl-[34px] pr-3 bg-input border border-border rounded-xl text-foreground text-[12.5px] outline-none transition-all focus:border-(--border-hover)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads…"
          />
        </div>

        {/* Folder tabs */}
        <div className="thin-scrollbar flex border-b border-border overflow-x-auto">
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              className={`py-2 px-1.5 bg-transparent cursor-pointer text-xs font-medium font-inherit rounded-none transition-all duration-[180ms] text-foreground-3 whitespace-nowrap tracking-[.01em] border-none border-b-2 border-b-transparent ${activeFolder === f.key ? "text-foreground border-b-foreground font-semibold" : "hover:text-foreground-2"}`}
              onClick={() => onSwitchFolder(f.key)}
            >
              {f.label}
              {f.count > 0 && (
                <span
                  className={`ml-1 text-[9px] font-bold px-[5px] py-px rounded-full border border-border ${activeFolder === f.key ? "bg-[#111111] text-white" : "bg-secondary text-muted-foreground"}`}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Thread list */}
      <div className="thin-scrollbar flex-1 overflow-y-auto">
        {/* Select all bar */}
        <div className="flex items-center gap-2.5 py-[9px] pl-[15px] pr-3.5 border-b border-border bg-card sticky top-0 z-[2]">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-[1.5px] border-border bg-card cursor-pointer appearance-none shrink-0 transition-all duration-150 checked:bg-foreground checked:border-foreground checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%270%200%2016%2016%27%20fill=%27white%27%20xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath%20d=%27M13.3%204.3a1%201%200%200%201%200%201.4l-6%206a1%201%200%200%201-1.4%200l-3-3a1%201%200%201%201%201.4-1.4L6.6%209.6l5.3-5.3a1%201%200%200%201%201.4%200z%27/%3E%3C/svg%3E')] checked:bg-no-repeat checked:bg-center hover:not-checked:border-border-hover mt-0"
            checked={allChecked}
            onChange={(e) => {
              const next: Record<string, boolean> = {};
              if (e.target.checked) listIds.forEach((id) => (next[id] = true));
              setCheckedThreads(next);
            }}
          />
          <span className="flex-1 text-xs font-semibold text-foreground-2">{anyChecked ? `${checkedCount} selected` : "Select all"}</span>
          {anyChecked && (
            <>
              <Button
                variant="ghost"
                size="icon"
                title="Mark as read"
                onClick={() => void onBulkAction("mark_read")}
                className="text-foreground-2 flex p-1 rounded-[5px] transition-colors duration-150 hover:text-foreground"
              >
                <Check size={15} />
              </Button>
              <BulkActionsMenu count={checkedCount} onAction={onBulkAction} />
            </>
          )}
        </div>
        {loadingThreads &&
          [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="py-[11px] pr-3.5 pl-3 border-b border-border flex gap-[9px]" style={{ opacity: 1 - i * 0.16 }}>
              <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md w-4 h-4 rounded shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-3 w-[55%]" />
                <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-[11px] w-[80%]" />
                <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-2.5 w-[70%]" />
              </div>
            </div>
          ))}
        {!loadingThreads && sortedFiltered.length === 0 && (
          <div className="px-5 py-10 text-center text-muted-foreground text-[12.5px]">No conversations in this folder</div>
        )}
        {sortedFiltered.map((thread) => {
          const active = selectedThreadId === thread.id;
          const name = extractName(thread.from);
          const _status = getStatus(thread.id);
          const analysis = analyses[thread.id];
          const urg = analysis?.urgency;
          const _urgUI = URGENCY_UI[urg];
          return (
            <div
              key={thread.id}
              className={`py-[10px] px-[14px] cursor-pointer border-b border-border border-l-[3px] transition-[background] duration-150 relative flex items-start gap-[9px] ${active ? "bg-secondary border-l-accent dark:bg-[rgba(255,255,255,0.06)] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[3px] after:bg-accent after:rounded-r-sm after:content-['']" : "border-l-transparent hover:bg-secondary dark:hover:bg-[rgba(255,255,255,0.03)]"}`}
              onClick={() => onSelectThread(thread)}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-[1.5px] border-border bg-card cursor-pointer appearance-none shrink-0 mt-0.5 transition-all duration-150 checked:bg-foreground checked:border-foreground checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%270%200%2016%2016%27%20fill=%27white%27%20xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath%20d=%27M13.3%204.3a1%201%200%200%201%200%201.4l-6%206a1%201%200%200%201-1.4%200l-3-3a1%201%200%201%201%201.4-1.4L6.6%209.6l5.3-5.3a1%201%200%200%201%201.4%200z%27/%3E%3C/svg%3E')] checked:bg-no-repeat checked:bg-center hover:not-checked:border-border-hover"
                checked={!!checkedThreads[thread.id]}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  setCheckedThreads((p) => ({
                    ...p,
                    [thread.id]: e.target.checked,
                  }))
                }
              />
              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Row 1: name + email icon + time + unread dot */}
                <div className="flex items-center gap-[5px] mb-0.5">
                  <span
                    className={`text-[12.5px] ${thread.unread ? "font-bold" : "font-semibold"} text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1`}
                  >
                    {thread.customer_name || name}
                  </span>
                  <Mail size={11} className="text-foreground shrink-0" />
                  <span className="text-[10.5px] text-foreground shrink-0 whitespace-nowrap">{formatDate(thread.date)}</span>
                  {thread.unread && <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0 shadow-[0_0_0_1.5px_rgba(161,117,252,0.25)]" />}
                </div>
                {/* Row 2: subject */}
                <div
                  className={`text-xs ${thread.unread ? "font-semibold text-foreground" : "font-medium text-foreground-2"} overflow-hidden text-ellipsis whitespace-nowrap mb-[3px]`}
                >
                  {thread.subject || "(no subject)"}
                </div>
                {/* Row 3: snippet — 2 lines */}
                <div className="line-clamp-2 text-[11.5px] text-foreground leading-[1.45]">{thread.snippet}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
