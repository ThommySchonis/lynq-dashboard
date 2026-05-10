"use client";

import { MacroManager } from "@/components/features/inbox/macro-manager";
import { MacroPanel } from "@/components/features/inbox/macro-panel";
import { TicketActionBar } from "@/components/features/inbox/ticket-action-bar";
import { CancelModal } from "@/components/shared/modals/cancel-modal";
import { DuplicateModal } from "@/components/shared/modals/duplicate-modal";
import { EditAddressModal } from "@/components/shared/modals/edit-address-modal";
import { FulfillModal } from "@/components/shared/modals/fulfill-modal";
import { NoteModal } from "@/components/shared/modals/note-modal";
import { RefundModal } from "@/components/shared/modals/refund-modal";
import { AvatarFallback, Avatar as ShadAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  useConversations,
  useConversation,
  useInboxCounts,
  useCustomerSearch,
  useEmailConnected,
} from "@/hooks/inbox/use-inbox-data";
import {
  useSendReply,
  useUpdateStatus,
  useAddNote,
  useSyncInbox,
  useAIReply,
  useTranslateMessage,
  useAIMacros,
} from "@/hooks/inbox/use-inbox-mutations";
import { useInboxState } from "@/hooks/inbox/use-inbox-state";
import { useComposerActions } from "@/hooks/inbox/use-composer-actions";
import { useKeyboardShortcuts } from "@/hooks/inbox/use-keyboard-shortcuts";
import {
  Calendar,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  ImageIcon,
  LayoutGrid,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Smile,
  SquarePen,
  Truck,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo } from "react";
import { toast as sonnerToast } from "sonner";
import {
  EMOJIS,
  extractEmail,
  extractName,
  fmtPrice,
  relTime as formatDate,
  plainTextToSafeHtml,
  sanitizeHtml,
} from "../../lib/inbox-utils";
import { useAuthStore } from "../../stores/auth";
import { useAIStore } from "../../stores/ai";
import { useMacrosStore } from "../../stores/macros";
import { useTicketMetaStore } from "../../stores/ticket-meta";
import EmptyState from "../components/EmptyState";
import Sidebar from "../components/Sidebar";

// ─── Status configs (inline-style versions, kept here) ────────
const STATUS = {
  open: {
    label: "Open",
    bg: "rgba(37,99,235,0.08)",
    color: "#2563eb",
    border: "rgba(37,99,235,0.2)",
  },
  pending: {
    label: "Pending",
    bg: "rgba(251,191,36,0.14)",
    color: "#fbbf24",
    border: "rgba(251,191,36,0.3)",
  },
  resolved: {
    label: "Resolved",
    bg: "rgba(74,222,128,0.14)",
    color: "#4ade80",
    border: "rgba(74,222,128,0.3)",
  },
  closed: {
    label: "Closed",
    bg: "var(--bg-input)",
    color: "var(--text-3)",
    border: "var(--bg-surface-2)",
  },
};
const ORDER_STATUS = {
  paid: { bg: "rgba(74,222,128,0.14)", color: "#4ade80", label: "Paid" },
  unpaid: { bg: "rgba(251,146,60,0.14)", color: "#fb923c", label: "Unpaid" },
  fulfilled: {
    bg: "rgba(74,222,128,0.14)",
    color: "#4ade80",
    label: "Fulfilled",
  },
  unfulfilled: {
    bg: "rgba(251,146,60,0.14)",
    color: "#fb923c",
    label: "Unfulfilled",
  },
  partial: { bg: "rgba(251,191,36,0.14)", color: "#fbbf24", label: "Partial" },
  refunded: {
    bg: "rgba(248,113,133,0.14)",
    color: "#fb7185",
    label: "Refunded",
  },
  cancelled: {
    bg: "rgba(248,113,133,0.14)",
    color: "#fb7185",
    label: "Cancelled",
  },
  voided: { bg: "rgba(248,113,133,0.14)", color: "#fb7185", label: "Voided" },
  pending: { bg: "rgba(251,191,36,0.14)", color: "#fbbf24", label: "Pending" },
  authorized: {
    bg: "rgba(99,179,237,0.14)",
    color: "#63b3ed",
    label: "Authorized",
  },
};

// ─── Base components ─────────────────────────────────────────
function InboxAvatar({ name = "?", size = 32, agent = false }) {
  const ini = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <ShadAvatar className="shrink-0" style={{ width: size, height: size }}>
      <AvatarFallback className={agent ? "bg-(--text-1) text-white" : "bg-[#F0F0F0] text-(--text-2)"} style={{ fontSize: size * 0.34 }}>
        {ini}
      </AvatarFallback>
    </ShadAvatar>
  );
}

function showT(msg, type = "success") {
  type === "success" ? sonnerToast.success(msg) : sonnerToast.error(msg);
}

// ─── Main page ────────────────────────────────────────────────
function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Auth (from Zustand — populated by AuthHydrator) ──
  const session = useAuthStore((s) => s.session);
  const token = session?.access_token ?? "";

  // ── Local UI state (consolidated hook) ──
  const state = useInboxState();

  // Initialize activeFolder from search params
  useEffect(() => {
    const view = searchParams.get("view");
    if (view) state.setActiveFolder(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TanStack queries (READ operations) ──
  const {
    data: threads = [],
    isLoading: loadingThreads,
    refetch: refetchThreads,
  } = useConversations(state.activeFolder, state.search);

  const {
    data: conversationData,
    isLoading: loadingMsgs,
  } = useConversation(state.selectedThreadId);

  const messages = conversationData?.messages || [];
  const notes = conversationData?.notes || [];

  const { data: counts = { open: 0, pending: 0, resolved: 0, unlinked: 0, trash: 0 } } = useInboxCounts();

  // Customer search: auto-fetch when a thread is selected (using email from thread)
  const selectedThread = threads.find((t) => t.id === state.selectedThreadId) || null;
  const autoCustomerEmail = selectedThread
    ? extractEmail(selectedThread.from) || conversationData?.conversation?.customer_email || ""
    : "";
  const customerQuery = state.custSearch || autoCustomerEmail;
  const { data: customer, isLoading: loadingCust } = useCustomerSearch(customerQuery);

  // ── TanStack mutations (WRITE operations) ──
  const sendReplyMutation = useSendReply();
  const updateStatusMutation = useUpdateStatus();
  const addNoteMutation = useAddNote();
  const syncInboxMutation = useSyncInbox();
  const aiReplyMutation = useAIReply();
  const translateMutation = useTranslateMessage();
  const aiMacrosMutation = useAIMacros();

  // ── AI state — powered by Zustand store ──
  const aiLoading = useAIStore((s) => s.aiLoading);
  const analyses = useAIStore((s) => s.analyses);
  const autoTranslate = useAIStore((s) => s.autoTranslate);
  const customerLang = useAIStore((s) => s.customerLang);
  const msgTranslations = useAIStore((s) => s.translations);
  const _setAutoTranslate = useAIStore((s) => s.setAutoTranslate);
  const _setTranslation = useAIStore((s) => s.setTranslation);
  const _resetAIForThread = useAIStore((s) => s.resetForThread);
  const _analyzeThreads = useAIStore((s) => s.analyzeThreads);
  const _generateReply = useAIStore((s) => s.generateReply);
  const _translateMessage = useAIStore((s) => s.translateMessage);
  const _detectLanguage = useAIStore((s) => s.detectLanguage);

  // ── Macros — powered by Zustand store ──
  const macros = useMacrosStore((s) => s.macros);
  const aiMacros = useMacrosStore((s) => s.aiMacros);
  const macroFavs = useMacrosStore((s) => s.favs);
  const _saveMacro = useMacrosStore((s) => s.saveMacro);
  const _deleteMacro = useMacrosStore((s) => s.deleteMacro);
  const _toggleMacroFav = useMacrosStore((s) => s.toggleFav);
  const _setAiMacros = useMacrosStore((s) => s.setAiMacros);
  const _fetchMacros = useMacrosStore((s) => s.fetchMacros);

  // ── Ticket meta — powered by Zustand store ──
  const getTicketMeta = useTicketMetaStore((s) => s.getMeta);
  const _addTag = useTicketMetaStore((s) => s.addTag);
  const _removeTag = useTicketMetaStore((s) => s.removeTag);
  const _updateMeta = useTicketMetaStore((s) => s.updateMeta);

  // ── Composer actions (formatting, links, images, files) ──
  const { formatDoc, insertLink, handleImageUpload, handleFileAttach, insertEmoji } = useComposerActions(
    state.composerRef,
    state.setReply,
    state.setAttachments,
    showT,
  );

  // ── Auth + initial load ──
  useEffect(() => {
    if (!session) {
      window.location.href = "/login";
      return;
    }
    _fetchMacros(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Trigger AI analysis when threads change ──
  useEffect(() => {
    if (threads.length > 0 && token) {
      _analyzeThreads(threads, token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    state.msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-fetch AI macros + detect language when thread changes ──
  useEffect(() => {
    if (!state.selectedThreadId || !selectedThread || !token) return;
    // AI macro suggestions
    aiMacrosMutation.mutateAsync({ subject: selectedThread.subject, snippet: selectedThread.snippet })
      .then((macroList) => {
        if (macroList?.length) _setAiMacros(macroList);
      })
      .catch(() => {});
    // Detect customer language from snippet
    if (selectedThread.snippet) {
      _detectLanguage(selectedThread.snippet, token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedThreadId]);

  // ── Filtered + priority-sorted threads ──
  const URGENCY_SCORE = { critical: 4, high: 3, medium: 2, low: 1 };
  const sortedFiltered = useMemo(() => {
    const filtered = threads.filter(
      (t) =>
        !state.search ||
        t.subject?.toLowerCase().includes(state.search.toLowerCase()) ||
        (t.customer_name || t.customer_email || t.from || "").toLowerCase().includes(state.search.toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      const sa = URGENCY_SCORE[analyses[a.id]?.urgency] || 0;
      const sb = URGENCY_SCORE[analyses[b.id]?.urgency] || 0;
      if (sb !== sa) return sb - sa;
      return new Date(b.last_message_at || b.date) - new Date(a.last_message_at || a.date);
    });
  }, [threads, state.search, analyses]);

  // ── Status helpers ──
  async function saveStatus(id, s) {
    await updateStatusMutation.mutateAsync({ threadId: id, status: s });
  }

  const getStatus = (id) => {
    const thread = threads.find((t) => t.id === id);
    return thread?.status || "open";
  };

  function updateTicketMeta(id, patch) {
    _updateMeta(id, patch);
  }
  function addTicketTag(id) {
    const tag = prompt("Add tag:");
    if (!tag?.trim()) return;
    _addTag(id, tag.trim());
  }
  function removeTicketTag(id, tag) {
    _removeTag(id, tag);
  }
  function updateTicketField(id, key, label) {
    const value = prompt(`${label}:`);
    if (value === null) return;
    _updateMeta(id, { [key]: value.trim() });
  }

  // ── Thread selection ──
  const openThread = useCallback((thread) => {
    state.setSelectedThreadId(thread.id);
    state.resetForNewThread();
    _resetAIForThread();
    if (state.composerRef.current) state.composerRef.current.innerHTML = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts({
    threads: sortedFiltered,
    selectedThreadId: state.selectedThreadId,
    onSelectThread: openThread,
    composerRef: state.composerRef,
  });

  // ── Send reply ──
  async function handleSend() {
    const textContent = state.composerRef.current?.textContent || state.reply;
    if (!textContent.trim() || !state.selectedThreadId) return false;
    state.setSending(true);
    let bodyHtml = sanitizeHtml(state.composerRef.current?.innerHTML || state.reply);
    let bodyText = textContent;
    // Auto-translate outgoing message to customer's language
    if (autoTranslate && customerLang && customerLang.code !== "en") {
      try {
        const td = await translateMutation.mutateAsync({
          text: textContent,
          targetLang: customerLang.name,
        });
        if (td.translated) {
          bodyHtml = plainTextToSafeHtml(td.translated);
          bodyText = td.translated;
        }
      } catch {}
    }
    const data = await sendReplyMutation.mutateAsync({
      threadId: state.selectedThreadId,
      bodyHtml,
      bodyText,
    });
    if (data.success || data.messageId || data.id) {
      showT("Message sent!", "success");
      if (state.composerRef.current) state.composerRef.current.innerHTML = "";
      state.setReply("");
      state.setAttachments([]);
      state.setSending(false);
      return true;
    }
    showT(data.error || "Failed to send", "error");
    state.setSending(false);
    return false;
  }

  async function handleSendResolve() {
    if (!state.selectedThreadId) return;
    const currentId = state.selectedThreadId;
    const currentIdx = sortedFiltered.findIndex((t) => t.id === currentId);
    const nextThread = sortedFiltered.find((t, i) => i !== currentIdx);
    const ok = await handleSend();
    if (ok) {
      await saveStatus(currentId, "resolved");
      showT("Resolved & closed", "success");
      if (nextThread) openThread(nextThread);
      else state.setSelectedThreadId(null);
    }
  }

  // ── AI reply ──
  async function handleAiReply() {
    if (!messages.length || !state.selectedThreadId) return;
    const reply = await _generateReply(selectedThread, messages, token);
    if (reply) {
      if (state.composerRef.current) {
        state.composerRef.current.innerHTML = plainTextToSafeHtml(reply);
        state.setReply(state.composerRef.current.textContent);
      } else state.setReply(reply);
    } else showT("AI reply failed", "error");
  }

  // ── Add note ──
  async function addNote() {
    if (!state.noteInput.trim() || !state.selectedThreadId) return;
    state.setAddingNote(true);
    try {
      await addNoteMutation.mutateAsync({
        threadId: state.selectedThreadId,
        body: state.noteInput.trim(),
      });
      state.setNoteInput("");
    } catch {
      showT("Failed to add note", "error");
    }
    state.setAddingNote(false);
  }

  // ── Translate message ──
  async function translateMessage(msgId, text) {
    _translateMessage(msgId, text, token);
  }

  // ── Sync ──
  async function triggerSync() {
    state.setSyncing(true);
    try {
      await syncInboxMutation.mutateAsync();
    } catch {}
    state.setSyncing(false);
  }

  // ── Customer search (manual) ──
  function handleCustSearch(query) {
    if (!query.trim()) return;
    state.setCustSearch(query.trim());
  }

  function handleModalSuccess(msg, type = "success") {
    state.setModal(null);
    showT(msg, type);
    // Customer data will auto-refetch via TanStack query
  }

  function switchFolder(key) {
    state.setActiveFolder(key);
    state.setSelectedThreadId(null);
  }

  if (!session) return null;

  const FOLDERS = [
    { key: "open", label: "Open", count: counts.open },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "resolved", label: "Resolved", count: counts.resolved },
    { key: "unlinked", label: "Unlinked", count: counts.unlinked },
    { key: "trash", label: "Trash", count: counts.trash },
  ];

  // ── Render ──
  return (
    <div className="ir in-bg flex h-screen overflow-hidden relative">
      {/* ── Aurora background ── */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="in-al1" />
        <div className="in-al4" />
        <div className="in-al6" />
        <div className="in-grid" />
        <div className="in-vig" />
      </div>

      <Sidebar />

      {/* ═══════════════ LEFT: Thread list ═══════════════ */}
      <div className="in-panel-l w-[260px] flex flex-col shrink-0 relative z-[1]">
        {/* Header */}
        <div className="px-3.5 pt-3.5 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-(--text-1) tracking-[-0.01em]">Inbox</span>
              <span title="Shortcuts: j/k navigate · r reply" className="text-[9.5px] text-(--text-3) bg-(--bg-surface-2) px-1.5 py-0.5 rounded cursor-default">
                j/k/r
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await triggerSync();
                  refetchThreads();
                }}
                className={`p-[5px] rounded-[7px] transition-all duration-150 ${state.syncing ? "text-(--text-2)" : "text-(--text-3)"}`}
                title="Sync & Refresh"
              >
                <span className={`flex ${state.syncing ? "animate-spin" : ""}`}>
                  <RefreshCw size={14} />
                </span>
              </Button>
              <Button
                onClick={() => router.push("/inbox/create")}
                className="flex items-center gap-[5px] px-[11px] py-[5px] rounded-lg bg-[#111111] text-white text-[11.5px] font-semibold font-inherit transition-all duration-[180ms] tracking-[.01em] hover:bg-[#333333]"
                title="Create Ticket"
              >
                <Plus size={12} />
                Create Ticket
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-(--text-3) pointer-events-none flex">
              <Search size={14} />
            </span>
            <input
              className="w-full py-[9px] pl-[34px] pr-3 bg-(--bg-input) border border-(--border) rounded-xl text-(--text-1) text-[12.5px] outline-none transition-all focus:border-(--border-hover)"
              value={state.search}
              onChange={(e) => state.setSearch(e.target.value)}
              placeholder="Search threads…"
            />
          </div>

          {/* Folder tabs */}
          <div className="sscroll flex border-b border-border overflow-x-auto">
            {FOLDERS.map((f) => (
              <button key={f.key} className={`vtab${state.activeFolder === f.key ? " on" : ""}`} onClick={() => switchFolder(f.key)}>
                {f.label}
                {f.count > 0 && (
                  <span
                    className={`ml-1 text-[9px] font-bold px-[5px] py-px rounded-full border border-border ${state.activeFolder === f.key ? "bg-[#111111] text-white" : "bg-(--bg-surface-2) text-(--text-3)"}`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div className="sscroll flex-1 overflow-y-auto">
          {/* Select all bar */}
          {(() => {
            const listIds = sortedFiltered.map((t) => t.id);
            const allChecked = listIds.length > 0 && listIds.every((id) => state.checkedThreads[id]);
            const anyChecked = listIds.some((id) => state.checkedThreads[id]);
            const checkedCount = listIds.filter((id) => state.checkedThreads[id]).length;
            return (
              <div className="flex items-center gap-2.5 py-[9px] pl-[15px] pr-3.5 border-b border-border bg-(--bg-surface) sticky top-0 z-[2]">
                <input
                  type="checkbox"
                  className="trow-cb mt-0"
                  checked={allChecked}
                  onChange={(e) => {
                    const next = {};
                    if (e.target.checked) listIds.forEach((id) => (next[id] = true));
                    state.setCheckedThreads(next);
                  }}
                />
                <span className="flex-1 text-xs font-semibold text-(--text-2)">{anyChecked ? `${checkedCount} selected` : "Select all"}</span>
                {anyChecked && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Mark as read"
                      className="text-(--text-2) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                    >
                      <Check size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Assign"
                      className="text-(--text-2) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                    >
                      <User size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="More actions"
                      className="text-(--text-2) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                    >
                      <MoreVertical size={15} />
                    </Button>
                  </>
                )}
                {!anyChecked && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Mark all read"
                      className="text-(--text-2) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                    >
                      <Check size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Assign"
                      className="text-(--text-2) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                    >
                      <User size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="More"
                      className="text-(--text-2) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                    >
                      <MoreHorizontal size={15} />
                    </Button>
                  </>
                )}
              </div>
            );
          })()}
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
            <div className="px-5 py-10 text-center text-(--text-3) text-[12.5px]">No conversations in this folder</div>
          )}
          {sortedFiltered.map((thread) => {
            const active = state.selectedThreadId === thread.id;
            const name = extractName(thread.from);
            const status = getStatus(thread.id);
            const analysis = analyses[thread.id];
            const URGENCY_UI = {
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
            const urg = analysis?.urgency;
            const urgUI = URGENCY_UI[urg];
            return (
              <div key={thread.id} className={`trow${active ? " trow-active" : ""}`} onClick={() => openThread(thread)}>
                {/* Checkbox */}
                <input
                  type="checkbox"
                  className="trow-cb"
                  checked={!!state.checkedThreads[thread.id]}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    state.setCheckedThreads((p) => ({
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
                      className={`text-[12.5px] ${thread.unread ? "font-bold" : "font-semibold"} text-(--text-1) overflow-hidden text-ellipsis whitespace-nowrap flex-1`}
                    >
                      {thread.customer_name || name}
                    </span>
                    <Mail size={11} className="text-(--text-1) shrink-0" />
                    <span className="text-[10.5px] text-(--text-1) shrink-0 whitespace-nowrap">{formatDate(thread.date)}</span>
                    {thread.unread && <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0 shadow-[0_0_0_1.5px_rgba(161,117,252,0.25)]" />}
                  </div>
                  {/* Row 2: subject */}
                  <div
                    className={`text-xs ${thread.unread ? "font-semibold text-(--text-1)" : "font-medium text-(--text-2)"} overflow-hidden text-ellipsis whitespace-nowrap mb-[3px]`}
                  >
                    {thread.subject || "(no subject)"}
                  </div>
                  {/* Row 3: snippet — 2 lines */}
                  <div className="trow-snippet text-[11.5px] text-(--text-1) leading-[1.45]">{thread.snippet}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════ CENTER + RIGHT ═══════════════ */}
      <>
        {/* ═══════════════ CENTER: Conversation ═══════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-[1]">
          {!selectedThread ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-(--text-3)">
              <div className="opacity-40">
                <Mail size={20} />
              </div>
              <div className="text-[13px]">Select a thread to read</div>
              <div className="text-[11px] text-(--text-3)">j / k navigate · r reply</div>
            </div>
          ) : (
            <>
              {/* Ticket header */}
              <div className="py-3.5 px-[22px] border-b border-border shrink-0 bg-(--bg-surface)">
                <div className="flex items-center gap-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-(--text-1) overflow-hidden text-ellipsis whitespace-nowrap mb-0.5 tracking-[-0.01em]">
                      {selectedThread.subject}
                    </div>
                    <div className="text-[11.5px] text-(--text-3)">
                      {extractName(selectedThread.from)} · {messages.length} message
                      {messages.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center shrink-0">
                    {/* Status dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            className="flex items-center gap-1.5 px-[11px] py-[5px] rounded-[20px] cursor-pointer text-xs font-semibold font-inherit transition-all duration-150"
                            style={{
                              background: STATUS[getStatus(selectedThread.id)]?.bg,
                              border: `1px solid ${STATUS[getStatus(selectedThread.id)]?.border}`,
                              color: STATUS[getStatus(selectedThread.id)]?.color,
                            }}
                          />
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            background: STATUS[getStatus(selectedThread.id)]?.color,
                          }}
                        />
                        {STATUS[getStatus(selectedThread.id)]?.label}
                        <ChevronDown size={11} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {Object.entries(STATUS).map(([k, s]) => (
                          <DropdownMenuItem key={k} onClick={() => saveStatus(selectedThread.id, k)} style={{ color: s.color }}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                            {s.label}
                            {getStatus(selectedThread.id) === k && <span className="ml-auto text-[10px] text-(--text-3)">&#10003;</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <TicketActionBar
                  meta={getTicketMeta(selectedThread.id)}
                  status={getStatus(selectedThread.id)}
                  onClose={() => saveStatus(selectedThread.id, "closed")}
                  onAddTag={() => addTicketTag(selectedThread.id)}
                  onRemoveTag={(tag) => removeTicketTag(selectedThread.id, tag)}
                  onFieldChange={(field, labelOrValue) =>
                    field === "assignee"
                      ? updateTicketMeta(selectedThread.id, {
                          assignee: labelOrValue,
                        })
                      : updateTicketField(selectedThread.id, field, labelOrValue)
                  }
                />
              </div>

              {/* Messages */}
              <div className="sscroll conv-area flex-1 overflow-y-auto px-6 py-5 bg-[#FAFAFA]">
                {loadingMsgs &&
                  [0, 1].map((i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${i % 2 === 0 ? "flex-row" : "flex-row-reverse"} mb-5`}
                      style={{ animation: `fadeUp .3s ease ${i * 0.1}s both` }}
                    >
                      <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md w-[34px] h-[34px] rounded-full shrink-0" />
                      <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-20 w-[60%] rounded-[18px]" />
                    </div>
                  ))}
                {messages.map((msg, idx) => {
                  const isAgent = msg.from?.toLowerCase().includes(session.user.email?.split("@")[0]?.toLowerCase() || "");
                  const isNote = msg.isNote;
                  const name = extractName(msg.from);
                  return (
                    <div
                      key={msg.id || idx}
                      className={`mb-5 flex gap-3 ${isAgent ? "flex-row-reverse" : "flex-row"}`}
                      style={{ animation: "msgIn .3s cubic-bezier(.16,1,.3,1) both" }}
                    >
                      {!isNote && <InboxAvatar name={name} size={26} agent={isAgent} />}
                      <div className="max-w-[72%]">
                        <div className={`text-xs mb-[5px] ${isAgent ? "text-right" : "text-left"}`}>
                          <span className="text-[10.5px] text-(--text-2) font-bold tracking-[.01em]">{name}</span>
                          <span className="text-[10px] text-(--text-3) ml-[7px] font-normal">{formatDate(msg.date)}</span>
                        </div>
                        <div className={isNote ? "msg-note" : isAgent ? "msg-out" : "msg-in"}>
                          {isNote && (
                            <div className="text-[10px] font-bold text-[rgba(251,191,36,0.75)] tracking-[.07em] uppercase mb-[7px]">Internal note</div>
                          )}
                          {(() => {
                            const content =
                              msgTranslations[msg.id] && msgTranslations[msg.id] !== "__loading__" ? msgTranslations[msg.id] : msg.body || msg.snippet || "";
                            const isHtml = /<[a-z][\s\S]*>/i.test(content);
                            if (!isHtml) return <span>{content}</span>;
                            return (
                              <iframe
                                sandbox="allow-same-origin"
                                srcDoc={
                                  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:8px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;font-size:14px;color:#1a1a1a;word-wrap:break-word;overflow-wrap:break-word}img{max-width:100%;height:auto}a{color:#6d28d9}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#666}pre{white-space:pre-wrap;overflow-x:auto}</style></head><body>' +
                                  content +
                                  "</body></html>"
                                }
                                className="w-full border-none min-h-[60px] rounded-[6px] bg-white"
                                title="Email content"
                                onLoad={(e) => {
                                  try {
                                    const h = e.target.contentDocument.body.scrollHeight;
                                    e.target.style.height = h + 16 + "px";
                                  } catch {}
                                }}
                              />
                            );
                          })()}
                        </div>
                        {!isAgent && !isNote && (
                          <div className="text-left mt-1">
                            {msgTranslations[msg.id] === "__loading__" ? (
                              <span className="text-[10px] text-(--text-3)">Translating…</span>
                            ) : msgTranslations[msg.id] ? (
                              <button
                                className="text-[10px] font-semibold text-(--text-3) bg-transparent cursor-pointer px-[7px] py-[2px] rounded-[5px] transition-all hover:text-(--text-1) hover:bg-(--bg-surface-2)"
                                onClick={() => _setTranslation(msg.id, undefined)}
                              >
                                Show original
                              </button>
                            ) : (
                              <button
                                className="text-[10px] font-semibold text-(--text-3) bg-transparent cursor-pointer px-[7px] py-[2px] rounded-[5px] transition-all hover:text-(--text-1) hover:bg-(--bg-surface-2)"
                                onClick={() => translateMessage(msg.id, msg.body || msg.snippet || "")}
                              >
                                Translate
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* ── Internal Notes Section ── */}
                {notes.length > 0 && (
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      onClick={() => state.setShowNotes((v) => !v)}
                      className="flex items-center gap-1.5 text-(--text-3) text-[11px] font-bold tracking-[.06em] uppercase py-1.5 px-0 font-inherit"
                    >
                      <span className="flex">
                        <FileText size={12} />
                      </span>
                      Internal Notes ({notes.length})
                      <ChevronDown size={10} className={`transition-transform duration-200 ${state.showNotes ? "rotate-180" : "rotate-0"}`} />
                    </Button>
                    {state.showNotes &&
                      notes.map((note, ni) => (
                        <div key={note.id || ni} className="mb-3" style={{ animation: "msgIn .3s cubic-bezier(.16,1,.3,1) both" }}>
                          <div className="text-xs mb-[5px]">
                            <span className="text-[10.5px] text-(--text-2) font-bold tracking-[.01em] text-[rgba(251,191,36,0.75)]">Note</span>
                            <span className="text-[10px] text-(--text-3) ml-[7px] font-normal">{formatDate(note.created_at)}</span>
                          </div>
                          <div className="msg-note">
                            <div className="text-[10px] font-bold text-[rgba(251,191,36,0.75)] tracking-[.07em] uppercase mb-[7px]">Internal note</div>
                            {note.body}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                {/* Add note inline */}
                <div className="mt-2 flex gap-2 items-start">
                  <Input
                    value={state.noteInput}
                    onChange={(e) => state.setNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) addNote();
                    }}
                    placeholder="Add an internal note..."
                    className="flex-1 px-3 py-2 border border-[#FDE68A] rounded-lg text-[12.5px] text-(--text-1) bg-[rgba(251,191,36,0.04)] font-inherit outline-none transition-[border-color] duration-200"
                  />
                  <Button
                    variant="outline"
                    onClick={addNote}
                    disabled={state.addingNote || !state.noteInput.trim()}
                    className={`px-3.5 py-2 rounded-lg border border-[#FDE68A] bg-[rgba(251,191,36,0.08)] text-[#F59E0B] text-xs font-semibold font-inherit transition-all duration-150 shrink-0 whitespace-nowrap ${state.addingNote || !state.noteInput.trim() ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {state.addingNote ? "Adding..." : "Add Note"}
                  </Button>
                </div>
                <div ref={state.msgEndRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-border shrink-0 bg-(--bg-surface)">
                {/* Macro panel */}
                {state.showMacros && (
                  <MacroPanel
                    macros={macros.filter((m) => !m.archived)}
                    aiMacros={aiMacros}
                    customerName={extractName(selectedThread?.from || "")}
                    favs={macroFavs}
                    onToggleFav={_toggleMacroFav}
                    onInsert={(body) => {
                      const safeBody = plainTextToSafeHtml(body);
                      if (state.composerRef.current) {
                        state.composerRef.current.innerHTML = safeBody;
                        state.setReply(state.composerRef.current.textContent);
                      } else state.setReply(body);
                      state.setShowMacros(false);
                      setTimeout(() => state.composerRef.current?.focus(), 10);
                    }}
                    onClose={() => state.setShowMacros(false)}
                    onManage={() => {
                      state.setShowMacros(false);
                      state.setShowMacroManager(true);
                    }}
                    onCreateNew={() => {
                      state.setShowMacros(false);
                      state.setShowMacroManager(true);
                    }}
                    onDeleteMacro={_deleteMacro}
                  />
                )}

                {/* Composer */}
                {!state.showMacros && (
                  <>
                    {/* Tab strip */}
                    <div className="flex border-b border-border pl-4">
                      {[
                        { id: "reply", label: "Reply" },
                        { id: "note", label: "Internal note" },
                      ].map((t) => (
                        <button key={t.id} className={`ctab${state.composerTab === t.id ? " on" : ""}`} onClick={() => state.setComposerTab(t.id)}>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* To: row */}
                    <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border">
                      <span className="flex text-(--text-3) shrink-0">
                        <Mail size={14} />
                      </span>
                      <span className="text-[11.5px] text-(--text-2) font-semibold shrink-0">To:</span>
                      <span className="flex-1 text-xs text-(--text-1) overflow-hidden text-ellipsis whitespace-nowrap">
                        {extractName(selectedThread.from)}
                        {extractEmail(selectedThread.from) ? ` (${extractEmail(selectedThread.from)})` : ""}
                      </span>
                      <ChevronDown size={11} className="text-(--text-3) shrink-0" />
                    </div>

                    {/* Macro search row */}
                    <div
                      className="flex items-center gap-2 px-3.5 py-[7px] border-b border-border cursor-pointer transition-[background] duration-[120ms] hover:bg-(--bg-surface-2)"
                      onClick={() => state.setShowMacros(true)}
                    >
                      <span className="text-(--text-3) flex shrink-0">
                        <Zap size={13} />
                      </span>
                      <span className="flex-1 text-xs text-(--text-3)">Search macros by name, tags or body...</span>
                      {aiMacros.length > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-px rounded bg-(--bg-surface-2) text-(--text-2) tracking-[.04em] shrink-0 border border-border">
                          AI
                        </span>
                      )}
                      <ChevronDown size={11} className="text-(--text-3) shrink-0" />
                    </div>

                    {/* Hidden file inputs */}
                    <input ref={state.imgUploadRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <input ref={state.fileUploadRef} type="file" multiple className="hidden" onChange={handleFileAttach} />

                    {/* Flat compose area */}
                    <div className="compose-box bg-(--bg-surface)" onClick={() => state.showEmoji && state.setShowEmoji(false)}>
                      {/* Auto-translate banner */}
                      {autoTranslate && customerLang && customerLang.code !== "en" && (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-(--bg-surface-2) border-b border-(--border) text-[11.5px] text-(--text-2)">
                          <span className="flex">
                            <Globe size={13} />
                          </span>
                          <span className="flex-1">
                            Auto-translating to <strong>{customerLang.name}</strong>
                          </span>
                          <Button variant="ghost" size="icon" onClick={() => _setAutoTranslate(false)} className="text-(--text-3) flex p-0">
                            <X size={10} />
                          </Button>
                        </div>
                      )}

                      {/* Attachments */}
                      {state.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-[5px] pt-2 px-3.5 pb-0">
                          {state.attachments.map((a, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-[5px] px-2.5 py-1 bg-(--bg-surface-2) border border-(--border) rounded-lg text-[11px] text-(--text-2)"
                            >
                              <Paperclip size={13} /> {a.name}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => state.setAttachments((p) => p.filter((_, j) => j !== i))}
                                className="text-(--text-3) flex p-0 ml-0.5"
                              >
                                <X size={10} />
                              </Button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Contenteditable composer */}
                      <div
                        ref={state.composerRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder={state.composerTab === "reply" ? "Click here to reply, or press r." : "Internal note — not visible to customer…"}
                        onInput={(e) => state.setReply(e.currentTarget.textContent)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                        }}
                        className={`compose-ta w-full resize-none outline-none bg-transparent px-4 py-3 text-sm text-(--text-1) leading-relaxed min-h-[90px] tracking-[.005em] min-h-[150px] ${state.composerTab === "note" ? "bg-[rgba(251,191,36,0.03)]" : "bg-transparent"}`}
                      />

                      {/* AI generating dots */}
                      {aiLoading && (
                        <div className="pt-1 px-4 pb-0 flex items-center gap-1">
                          {[0, 0.18, 0.36].map((d) => (
                            <span
                              key={d}
                              className="w-[5px] h-[5px] rounded-full bg-(--text-3) block"
                              style={{ animation: `glowPulse .9s ease-in-out ${d}s infinite` }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Suggested macros */}
                      {(aiMacros.length > 0 || macros.length > 0) && (
                        <div className="flex items-center gap-1.5 px-3.5 py-1.5 border-t border-border flex-wrap">
                          <Radio size={12} className="text-(--text-3) shrink-0" />
                          <span className="text-[10.5px] text-(--text-2) font-semibold shrink-0">Suggested macros</span>
                          {(aiMacros.length > 0 ? aiMacros : macros).slice(0, 3).map((m) => {
                            const firstName = extractName(selectedThread?.from || "").split(" ")[0] || "there";
                            const body = m.body.replace(/{{name}}/gi, firstName).replace(/{{firstname}}/gi, firstName);
                            return (
                              <button
                                key={m.id}
                                className="inline-flex items-center text-xs font-medium px-2.5 py-[3px] rounded-[5px] border border-black/[0.08] bg-(--bg-surface-2) text-(--text-2) cursor-pointer transition-all hover:border-(--border-hover) hover:text-(--text-1)"
                                onClick={() => {
                                  if (state.composerRef.current) {
                                    state.composerRef.current.innerHTML = body.replace(/\n/g, "<br>");
                                    state.setReply(state.composerRef.current.textContent);
                                  } else state.setReply(body);
                                  setTimeout(() => state.composerRef.current?.focus(), 10);
                                }}
                              >
                                {m.name}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Toolbar + Send buttons — single bottom row */}
                      <div className="flex items-center gap-px px-2.5 py-[7px] border-t border-border">
                        <button
                          className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                          title="Bold (⌘B)"
                          onClick={() => formatDoc("bold")}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <span className="font-extrabold text-[13px]">B</span>
                        </button>
                        <button
                          className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                          title="Italic (⌘I)"
                          onClick={() => formatDoc("italic")}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <span className="italic text-[13px]">I</span>
                        </button>
                        <button
                          className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                          title="Underline (⌘U)"
                          onClick={() => formatDoc("underline")}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <span className="underline text-[13px]">U</span>
                        </button>
                        <div className="rtbar-sep" />
                        <button
                          className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                          title="Insert link"
                          onClick={insertLink}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <Link2 size={13} />
                        </button>
                        <button
                          className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                          title="Insert image"
                          onClick={() => state.imgUploadRef.current?.click()}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <ImageIcon size={13} />
                        </button>
                        <div className="relative">
                          <button
                            className={`min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)${state.showEmoji ? " rton" : ""}`}
                            title="Emoji"
                            onClick={() => state.setShowEmoji((v) => !v)}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <Smile size={13} />
                          </button>
                          {state.showEmoji && (
                            <div
                              className="absolute bottom-[calc(100%+8px)] left-[-8px] bg-(--bg-surface) backdrop-blur-[28px] border border-(--border) rounded-2xl p-2.5 z-[200] shadow-[0_24px_80px_rgba(0,0,0,0.2)] animate-[fadeUp_.16s_ease_both]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="grid grid-cols-7 gap-[2px]">
                                {EMOJIS.map((em) => (
                                  <button
                                    key={em}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[17px] cursor-pointer bg-transparent transition-colors hover:bg-(--bg-surface-2)"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      insertEmoji(em);
                                      state.setShowEmoji(false);
                                    }}
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                          title="Attach file"
                          onClick={() => state.fileUploadRef.current?.click()}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <Paperclip size={13} />
                        </button>
                        <div className="rtbar-sep" />
                        <button
                          className={`min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)${autoTranslate ? " rton" : ""} gap-1 pl-1.5 pr-2 text-[11px] font-semibold min-w-auto`}
                          title={customerLang ? `Auto-translate to ${customerLang.name}` : "Detect language"}
                          onClick={() => (customerLang ? _setAutoTranslate(!autoTranslate) : null)}
                        >
                          <Globe size={13} />
                          <span>{customerLang ? customerLang.name : "Translate"}</span>
                        </button>
                        <div className="flex-1" />
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-[12.5px] font-semibold bg-(--bg-surface-2) border border-(--border) text-(--text-1) rounded-[7px] transition-all hover:bg-(--bg-input) hover:border-(--border-hover) hover:text-(--text-1) flex items-center gap-1.5 px-[13px] py-[7px]"
                          onClick={handleAiReply}
                          disabled={aiLoading || !messages.length}
                        >
                          {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <span className="text-primary text-[13px] leading-none">✦</span>}
                          {aiLoading ? "Generating…" : "AI Reply"}
                        </Button>
                        <Button
                          className="px-[9px] py-[9px] text-[12.5px] font-semibold bg-[rgba(74,222,128,0.07)] border border-[rgba(74,222,128,0.2)] text-[rgba(74,222,128,0.75)] rounded-xl flex items-center gap-[5px] transition-all hover:bg-[rgba(74,222,128,0.13)] hover:border-[rgba(74,222,128,0.38)] hover:text-[#4ade80] ml-1.5"
                          onClick={handleSendResolve}
                          disabled={!state.reply.trim() || state.sending}
                        >
                          <Check size={11} />
                          Send & Close
                        </Button>
                        <Button className="flex items-center gap-1.5 ml-1.5" onClick={handleSend} disabled={!state.reply.trim() || state.sending}>
                          {state.sending ? <Loader2 size={13} className="animate-spin text-white" /> : <Send size={13} />}
                          {state.sending ? "Sending…" : "Send"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ═══════════════ RIGHT: Customer panel ═══════════════ */}
        {selectedThread && (
          <div className="sscroll w-[280px] border-l border-border flex flex-col shrink-0 overflow-y-auto bg-(--bg-surface)">
            {/* Search */}
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <div className="relative">
                <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-(--text-3) flex pointer-events-none">
                  <Search size={14} />
                </span>
                <input
                  className="w-full py-[7px] px-3 pl-[32px] bg-(--bg-surface-2) border border-(--border) rounded-lg text-(--text-1) text-xs outline-none transition-[border-color] duration-200 focus:border-(--border-hover)"
                  placeholder="Search by email or #order number..."
                  value={state.custSearch}
                  onChange={(e) => state.setCustSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCustSearch(state.custSearch);
                  }}
                />
              </div>
            </div>

            {/* Customer header */}
            <div className="px-3.5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <InboxAvatar
                  name={
                    customer?.customer
                      ? `${customer.customer.firstName || ""} ${customer.customer.lastName || ""}`.trim() || extractName(selectedThread.from)
                      : extractName(selectedThread.from)
                  }
                  size={28}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-(--text-1) overflow-hidden text-ellipsis whitespace-nowrap">
                    {customer?.customer
                      ? `${customer.customer.firstName || ""} ${customer.customer.lastName || ""}`.trim() || extractName(selectedThread.from)
                      : extractName(selectedThread.from)}
                  </div>
                  <div className="text-[11px] text-(--text-3) mt-px overflow-hidden text-ellipsis whitespace-nowrap">{extractEmail(selectedThread.from)}</div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="flex items-center justify-center w-7 h-7 rounded-[7px] text-(--text-3) transition-all duration-150 border border-border bg-transparent shrink-0 hover:text-(--text-1) hover:bg-(--bg-surface-2)"
                >
                  <MoreVertical size={13} />
                </Button>
              </div>
            </div>

            {/* Customer Fields — collapsible */}
            <div className="border-b border-border shrink-0">
              <button
                className="w-full flex items-center gap-1.5 py-[9px] px-3.5 bg-transparent cursor-pointer text-left transition-[background] duration-[120ms] hover:bg-(--bg-surface-2)"
                onClick={() => state.setCustFieldsOpen((v) => !v)}
              >
                <span className="text-[10px] font-bold text-(--text-3) flex-1 tracking-[.07em] uppercase">Customer Fields</span>
                <ChevronDown size={10} className={`transition-transform duration-200 text-(--text-3) shrink-0 ${state.custFieldsOpen ? "rotate-180" : "rotate-0"}`} />
              </button>
              {state.custFieldsOpen && (
                <div className="px-3.5 pb-2.5 pt-0 flex flex-col">
                  <div className="flex items-baseline justify-between gap-4 px-3.5">
                    <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Email</span>
                    <span className="text-xs font-medium text-(--text-1) text-right break-words text-[11px] break-all">{extractEmail(selectedThread.from)}</span>
                  </div>
                  {loadingCust &&
                    [0, 1].map((i) => (
                      <div
                        key={i}
                        className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-[18px] rounded-[5px] my-1"
                      />
                    ))}
                  {customer?.customer && !loadingCust && (
                    <>
                      {customer.customer.phone && (
                        <div className="flex items-baseline justify-between gap-4 px-3.5">
                          <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Phone</span>
                          <span className="text-xs font-medium text-(--text-1) text-right break-words">{customer.customer.phone}</span>
                        </div>
                      )}
                      {(customer.customer.city || customer.customer.country) && (
                        <div className="flex items-baseline justify-between gap-4 px-3.5">
                          <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Location</span>
                          <span className="text-xs font-medium text-(--text-1) text-right break-words">
                            {[customer.customer.city, customer.customer.country].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {customer.customer.createdAt && (
                        <div className="flex items-baseline justify-between gap-4 px-3.5">
                          <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Customer since</span>
                          <span className="text-xs font-medium text-(--text-1) text-right break-words">
                            {new Date(customer.customer.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                      )}
                      {customer.customer.note && (
                        <div className="mt-1.5 px-[9px] py-1.5 bg-(--bg-surface-2) rounded-[7px] border border-border">
                          <div className="text-[10px] font-bold text-(--text-3) uppercase tracking-[.06em] mb-0.5">Note</div>
                          <div className="text-[11.5px] text-(--text-2) italic leading-[1.5]">{customer.customer.note}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Stats bar */}
            {customer?.customer &&
              !loadingCust &&
              (() => {
                const orders = customer.orders || [];
                const withRefund = orders.filter((o) => o.refunds && o.refunds.length > 0);
                const refundPct = orders.length > 0 ? Math.round((withRefund.length / orders.length) * 100) : 0;
                const approx = customer.customer.ordersCount > 50;
                const badgeColor = refundPct > 30 ? "#f87171" : refundPct > 10 ? "#fbbf24" : null;
                return (
                  <div className="flex border-b border-border shrink-0">
                    <div className="flex-1 py-2.5 text-center border-r border-border">
                      <div className="text-sm font-extrabold text-(--text-1) tracking-[-0.02em]">
                        {fmtPrice(customer.customer.totalSpent, customer.customer.currency)}
                      </div>
                      <div className="text-[9.5px] text-(--text-3) mt-0.5 uppercase tracking-[.06em]">Spent</div>
                    </div>
                    <div className="flex-1 py-2.5 text-center border-r border-border">
                      <div className="text-sm font-extrabold text-(--text-1) tracking-[-0.02em]">{customer.customer.ordersCount ?? "—"}</div>
                      <div className="text-[9.5px] text-(--text-3) mt-0.5 uppercase tracking-[.06em]">Orders</div>
                    </div>
                    <div className="flex-1 py-2.5 text-center">
                      <div className="text-sm font-extrabold tracking-[-0.02em]" style={{ color: badgeColor || "var(--text-1)" }}>
                        {approx ? "~" : ""}
                        {refundPct}%
                      </div>
                      <div className="text-[9.5px] text-(--text-3) mt-0.5 uppercase tracking-[.06em]">Refund</div>
                    </div>
                  </div>
                );
              })()}

            {/* Tags */}
            {customer?.customer?.tags && (
              <div className="px-3.5 py-2 border-b border-border flex flex-wrap gap-1 shrink-0">
                {customer.customer.tags
                  .split(",")
                  .filter(Boolean)
                  .map((tag) => (
                    <span key={tag} className="text-[10px] font-medium py-0.5 px-[7px] rounded bg-(--bg-surface-2) text-(--text-1) border border-(--border)">
                      {tag.trim()}
                    </span>
                  ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              <button
                className={`flex-1 py-2 px-1.5 bg-transparent cursor-pointer text-[11.5px] font-medium text-(--text-2) border-b-2 border-transparent transition-all whitespace-nowrap text-center${state.rightTab === "info" ? " on" : ""}`}
                onClick={() => state.setRightTab("info")}
              >
                Customer
              </button>
              <button
                className={`flex-1 py-2 px-1.5 bg-transparent cursor-pointer text-[11.5px] font-medium text-(--text-2) border-b-2 border-transparent transition-all whitespace-nowrap text-center${state.rightTab === "shopify" ? " on" : ""}`}
                onClick={() => state.setRightTab("shopify")}
              >
                Orders
                {(customer?.orders || []).length > 0 ? ` (${customer.orders.length})` : ""}
              </button>
            </div>

            {/* ── Customer tab ── */}
            {state.rightTab === "info" && (
              <div className="shrink-0">
                {loadingCust && (
                  <div className="px-3.5 py-3">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-5 rounded-[5px] mb-2"
                      />
                    ))}
                  </div>
                )}
                {!loadingCust && (
                  <div className="pt-2.5 px-3.5 pb-1 flex flex-col">
                    {/* Note row */}
                    <div className="flex items-start gap-2 py-[5px] border-b border-border mb-0.5">
                      <span className="flex text-(--text-3) mt-px shrink-0">
                        <FileText size={13} />
                      </span>
                      <span className={`text-xs leading-[1.5] ${customer?.customer?.note ? "text-(--text-2)" : "text-(--text-3) italic"}`}>
                        {customer?.customer?.note || "This customer has no note."}
                      </span>
                    </div>
                    {/* Email row */}
                    <div className="flex items-center gap-2 py-[5px]">
                      <span className="flex text-(--text-3) shrink-0">
                        <Mail size={13} />
                      </span>
                      <a
                        href={`mailto:${extractEmail(selectedThread.from)}`}
                        className="text-xs text-(--text-1) no-underline overflow-hidden text-ellipsis whitespace-nowrap hover:underline"
                      >
                        {extractEmail(selectedThread.from)}
                      </a>
                    </div>
                    {/* Phone row */}
                    {customer?.customer?.phone && (
                      <div className="flex items-center gap-2 py-[5px]">
                        <span className="flex text-(--text-3) shrink-0">
                          <Phone size={13} />
                        </span>
                        <a href={`tel:${customer.customer.phone}`} className="text-xs text-(--text-1) no-underline hover:underline">
                          {customer.customer.phone}
                        </a>
                      </div>
                    )}
                    {/* Show more */}
                    {customer?.customer && (
                      <Button
                        variant="ghost"
                        onClick={() => state.setCustShowMore((v) => !v)}
                        className="flex items-center gap-1 py-[5px] px-0 text-xs text-(--text-2) font-inherit font-medium"
                      >
                        {state.custShowMore ? "Show less" : "Show more"}
                        <ChevronDown size={10} className={`transition-transform duration-200 ${state.custShowMore ? "rotate-180" : "rotate-0"}`} />
                      </Button>
                    )}
                    {state.custShowMore && customer?.customer && (
                      <div className="flex flex-col pt-1 border-t border-border">
                        {(customer.customer.city || customer.customer.country) && (
                          <div className="flex items-baseline justify-between gap-4 px-3.5">
                            <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Location</span>
                            <span className="text-xs font-medium text-(--text-1) text-right break-words">
                              {[customer.customer.city, customer.customer.country].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                        {customer.customer.createdAt && (
                          <div className="flex items-baseline justify-between gap-4 px-3.5">
                            <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Customer since</span>
                            <span className="text-xs font-medium text-(--text-1) text-right break-words">
                              {new Date(customer.customer.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline justify-between gap-4 px-3.5">
                          <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Orders</span>
                          <span className="text-xs font-medium text-(--text-1) text-right break-words">{customer.customer.ordersCount ?? "—"}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-4 px-3.5">
                          <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Total spent</span>
                          <span className="text-xs font-medium text-(--text-1) text-right break-words font-bold text-(--text-1)">
                            {fmtPrice(customer.customer.totalSpent, customer.customer.currency)}
                          </span>
                        </div>
                      </div>
                    )}
                    {!customer?.customer && <div className="py-2 text-xs text-(--text-3)">No Shopify customer found</div>}
                  </div>
                )}
                {/* Open Timeline row */}
                <div className="pt-2 px-3.5 pb-3 flex items-center gap-2.5">
                  <Button
                    variant="outline"
                    className="flex items-center gap-1.5 py-[5px] px-3 rounded-[7px] border border-border bg-transparent text-(--text-2) text-[11.5px] font-semibold font-inherit transition-all duration-150 shrink-0 hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                  >
                    <Calendar size={12} />
                    Open Timeline
                  </Button>
                  {selectedThread?.id && <span className="text-[11px] text-(--text-3)">1 ticket, 1 open</span>}
                </div>
              </div>
            )}

            {/* ── Orders tab ── */}
            {state.rightTab === "shopify" && (
              <div>
                {/* Create order */}
                <div className="px-3 py-2.5 border-b border-border">
                  <Button
                    variant="outline"
                    className="w-full px-3 py-[7px] rounded-lg border border-border bg-transparent text-(--text-2) text-xs font-semibold font-inherit flex items-center justify-center gap-1.5 transition-all duration-150 hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                  >
                    <Plus size={12} />
                    Create order
                  </Button>
                </div>

                {loadingCust &&
                  [0, 1].map((i) => (
                    <div key={i} className="border-b border-border px-3.5 py-2.5">
                      <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-4 rounded-[5px] mb-2 w-[60%]" />
                      <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-3 rounded-[5px] mb-[5px] w-[80%]" />
                      <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-3 rounded-[5px] w-[50%]" />
                    </div>
                  ))}
                {!loadingCust && !customer?.customer && <div className="py-6 text-center text-xs text-(--text-3)">No Shopify data found</div>}
                {!loadingCust && customer?.customer && (customer.orders || []).length === 0 && (
                  <div className="py-6 text-center text-xs text-(--text-3)">No orders</div>
                )}

                {/* Order sections */}
                {(customer?.orders || []).map((order, oi) => {
                  const isOpen = state.expandedOrders[order.id] === undefined ? oi === 0 : state.expandedOrders[order.id];
                  const shippingOpen = state.expandedSubs[`${order.id}_shipping`] === undefined ? true : !!state.expandedSubs[`${order.id}_shipping`];
                  const trackOpen = state.expandedSubs[`${order.id}_track`] === undefined ? true : !!state.expandedSubs[`${order.id}_track`];
                  const isCancelled = !!order.cancelledAt || order.financialStatus === "cancelled" || order.financialStatus === "voided";
                  const isRefunded = order.financialStatus === "refunded";
                  const canRefund = !isCancelled && !isRefunded;
                  const canCancel = !isCancelled;
                  const finS = isCancelled ? ORDER_STATUS.cancelled : ORDER_STATUS[order.financialStatus?.toLowerCase()];
                  const fulS = ORDER_STATUS[order.fulfillmentStatus?.toLowerCase()];
                  const sa = order.shippingAddress;
                  return (
                    <div key={order.id} className="border-b border-border">
                      {/* ── Order header: row 1 = name + chevron ── */}
                      <button
                        className="w-full flex items-center gap-1.5 py-2.5 px-3.5 bg-transparent cursor-pointer text-left transition-[background] duration-[120ms] hover:bg-(--bg-surface-2)"
                        onClick={() =>
                          state.setExpandedOrders((v) => ({
                            ...v,
                            [order.id]: !isOpen,
                          }))
                        }
                      >
                        <span className="text-[13.5px] font-bold text-(--text-1) flex-1 text-left">{order.name}</span>
                        <ChevronDown size={10} className={`transition-transform duration-200 text-(--text-3) shrink-0 ${isOpen ? "rotate-180" : "rotate-0"}`} />
                      </button>

                      {isOpen && (
                        <div className="px-3.5 pb-3 pt-0">
                          {/* Row 2: status badges */}
                          <div className="flex gap-1 mb-2 flex-wrap">
                            {finS && (
                              <span
                                className="text-[10px] font-bold px-[7px] py-0.5 rounded tracking-[.05em] uppercase"
                                style={{
                                  background: finS.bg,
                                  color: finS.color,
                                  border: `1px solid ${finS.color}22`,
                                }}
                              >
                                {finS.label}
                              </span>
                            )}
                            {fulS && (
                              <span
                                className="text-[10px] font-bold px-[7px] py-0.5 rounded tracking-[.05em] uppercase"
                                style={{
                                  background: fulS.bg,
                                  color: fulS.color,
                                  border: `1px solid ${fulS.color}22`,
                                }}
                              >
                                {fulS.label}
                              </span>
                            )}
                            {order.refunds?.length > 0 && order.financialStatus !== "refunded" && (
                              <span className="text-[10px] font-bold px-[7px] py-0.5 rounded tracking-[.05em] uppercase bg-[rgba(248,113,133,0.12)] text-[#fb7185] border border-[rgba(248,113,133,0.22)]">
                                Partial refund
                              </span>
                            )}
                          </div>
                          {/* Row 3: action buttons */}
                          <div className="flex gap-1 flex-wrap mb-2.5">
                            <button
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-(--border) bg-(--bg-surface) text-(--text-1) cursor-pointer transition-all hover:border-(--border-hover) hover:bg-(--bg-surface-2)"
                              onClick={() => state.setModal({ type: "duplicate", order })}
                            >
                              <span className="flex">
                                <Copy size={12} />
                              </span>
                              Duplicate
                            </button>
                            {canRefund && (
                              <button
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-(--border) bg-(--bg-surface) text-(--text-1) cursor-pointer transition-all hover:border-(--border-hover) hover:bg-(--bg-surface-2)"
                                onClick={() => state.setModal({ type: "refund", order })}
                              >
                                <RotateCcw size={11} />$ Refund
                              </button>
                            )}
                            {canCancel && (
                              <button
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-(--border) bg-(--bg-surface) text-(--text-1) cursor-pointer transition-all hover:border-[rgba(220,38,38,0.35)] hover:text-[#dc2626] hover:bg-[rgba(220,38,38,0.05)]"
                                onClick={() => state.setModal({ type: "cancel", order })}
                              >
                                <XCircle size={11} />
                                Cancel
                              </button>
                            )}
                            <button
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-(--border) bg-(--bg-surface) text-(--text-1) cursor-pointer transition-all hover:border-(--border-hover) hover:bg-(--bg-surface-2) px-[7px] py-1"
                              onClick={() => state.setModal({ type: "note", order })}
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          </div>

                          {/* Key-value rows */}
                          <div className="mb-1">
                            <div className="flex items-baseline justify-between gap-4 px-3.5">
                              <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Created</span>
                              <span className="text-xs font-medium text-(--text-1) text-right break-words">
                                {new Date(order.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-4 px-3.5">
                              <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Total</span>
                              <span className="text-xs font-medium text-(--text-1) text-right break-words font-bold text-(--text-1)">
                                {fmtPrice(order.totalPrice, order.currency)}
                              </span>
                            </div>
                          </div>

                          {/* Tracking — collapsible (default open) */}
                          {(order.fulfillments || []).length > 0 && (
                            <>
                              <button
                                className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-(--text-1) text-left transition-opacity border-t border-(--border) mt-1.5 hover:opacity-75"
                                onClick={() =>
                                  state.setExpandedSubs((v) => ({
                                    ...v,
                                    [`${order.id}_track`]: !trackOpen,
                                  }))
                                }
                              >
                                <span className="flex text-(--text-3)">
                                  <Truck size={12} />
                                </span>
                                <span className="flex-1 font-semibold text-[11.5px] text-(--text-2)">Tracking</span>
                                <ChevronDown
                                  size={10}
                                  className={`transition-transform duration-200 text-(--text-3) ${trackOpen ? "rotate-180" : "rotate-0"}`}
                                />
                              </button>
                              {trackOpen &&
                                order.fulfillments.slice(0, 1).map((f, fi) => (
                                  <div key={fi} className="pb-1.5">
                                    <div className="flex items-baseline justify-between gap-4 px-3.5">
                                      <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Carrier</span>
                                      <span className="text-xs font-medium text-(--text-1) text-right break-words">{f.trackingCompany || "—"}</span>
                                    </div>
                                    {f.trackingNumber && (
                                      <div className="flex items-baseline justify-between gap-4 px-3.5">
                                        <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Tracking #</span>
                                        <span className="text-xs font-medium text-(--text-1) text-right break-words font-mono text-[10.5px]">
                                          {f.trackingNumber}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-baseline justify-between gap-4 px-3.5">
                                      <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Status</span>
                                      <span className="text-[10px] font-bold px-1.5 py-px rounded bg-[rgba(74,222,128,0.12)] text-[#16a34a] border border-[rgba(74,222,128,0.25)] tracking-[.04em] uppercase">
                                        Delivered
                                      </span>
                                    </div>
                                    {f.trackingUrl && (
                                      <div className="mt-1">
                                        <a
                                          href={f.trackingUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[11.5px] text-(--text-1) no-underline inline-flex items-center gap-[3px]"
                                        >
                                          Track package{" "}
                                          <span className="flex">
                                            <ExternalLink size={11} />
                                          </span>
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </>
                          )}

                          {/* Shipping address — collapsible (default open) */}
                          {sa && (
                            <>
                              <button
                                className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-(--text-1) text-left transition-opacity border-t border-(--border) mt-1.5 hover:opacity-75"
                                onClick={() =>
                                  state.setExpandedSubs((v) => ({
                                    ...v,
                                    [`${order.id}_shipping`]: !shippingOpen,
                                  }))
                                }
                              >
                                <span className="flex text-(--text-3)">
                                  <MapPin size={12} />
                                </span>
                                <span className="flex-1 font-semibold text-[11.5px] text-(--text-2)">Shipping address</span>
                                <ChevronDown
                                  size={10}
                                  className={`transition-transform duration-200 text-(--text-3) ${shippingOpen ? "rotate-180" : "rotate-0"}`}
                                />
                              </button>
                              {shippingOpen && (
                                <div className="pb-1.5">
                                  <div className="mb-1.5">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => state.setModal({ type: "address", order })}
                                      className="inline-flex items-center gap-1 text-(--text-2) text-[11px] font-semibold px-2 py-[3px] rounded-[6px] border border-border bg-transparent transition-all duration-150 font-inherit hover:text-(--text-1) hover:border-(--border-hover)"
                                    >
                                      <span className="flex">
                                        <SquarePen size={12} />
                                      </span>{" "}
                                      Edit
                                    </Button>
                                  </div>
                                  {[
                                    sa.firstName || sa.lastName
                                      ? {
                                          l: "Name",
                                          v: [sa.firstName, sa.lastName].filter(Boolean).join(" "),
                                        }
                                      : null,
                                    sa.address1 ? { l: "Address1", v: sa.address1 } : null,
                                    sa.address2 ? { l: "Address2", v: sa.address2 } : null,
                                    sa.city ? { l: "City", v: sa.city } : null,
                                    sa.country ? { l: "Country", v: sa.country } : null,
                                    sa.province ? { l: "Province", v: sa.province } : null,
                                    sa.zip ? { l: "Zip", v: sa.zip } : null,
                                  ]
                                    .filter(Boolean)
                                    .map((row) => (
                                      <div key={row.l} className="flex items-baseline justify-between gap-4 px-3.5">
                                        <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">{row.l}</span>
                                        <span className="text-xs font-medium text-(--text-1) text-right break-words">{row.v}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* Line items — each item as its own collapsible sub-section */}
                          {(order.lineItems || []).map((item, ii) => {
                            const itemKey = `${order.id}_item_${item.id}`;
                            const itemOpen = state.expandedSubs[itemKey] === undefined ? true : !!state.expandedSubs[itemKey];
                            return (
                              <div key={item.id}>
                                <button
                                  className="w-full flex items-center gap-1.5 py-[7px] bg-transparent cursor-pointer text-[11.5px] font-semibold text-(--text-1) text-left transition-opacity border-t border-(--border) mt-1.5 hover:opacity-75"
                                  onClick={() =>
                                    state.setExpandedSubs((v) => ({
                                      ...v,
                                      [itemKey]: !itemOpen,
                                    }))
                                  }
                                >
                                  <LayoutGrid size={12} className="text-(--text-3) shrink-0" />
                                  <span className="flex-1 text-[11px] font-semibold text-(--text-2) overflow-hidden text-ellipsis whitespace-nowrap">
                                    {item.quantity} × {item.title}
                                    {item.variantTitle ? ` · ${item.variantTitle}` : ""}
                                  </span>
                                  <ChevronDown
                                    size={10}
                                    className={`transition-transform duration-200 text-(--text-3) shrink-0 ${itemOpen ? "rotate-180" : "rotate-0"}`}
                                  />
                                </button>
                                {itemOpen && (
                                  <div className="pb-1">
                                    <div className="flex items-baseline justify-between gap-4 px-3.5">
                                      <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Amount</span>
                                      <span className="text-xs font-medium text-(--text-1) text-right break-words">
                                        {fmtPrice(Number(item.price) * item.quantity, order.currency)}
                                      </span>
                                    </div>
                                    {item.sku && (
                                      <div className="flex items-baseline justify-between gap-4 px-3.5">
                                        <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Sku</span>
                                        <span className="text-xs font-medium text-(--text-1) text-right break-words font-mono text-[10.5px]">{item.sku}</span>
                                      </div>
                                    )}
                                    {item.variantTitle && (
                                      <div className="flex items-baseline justify-between gap-4 px-3.5">
                                        <span className="text-xs text-(--text-3) shrink-0 min-w-[72px]">Variant</span>
                                        <span className="text-xs font-medium text-(--text-1) text-right break-words">{item.variantTitle}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </>

      {/* ═══════════════ Modals ═══════════════ */}
      {state.modal?.type === "refund" && (
        <RefundModal order={state.modal.order} token={token} onClose={() => state.setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {state.modal?.type === "cancel" && (
        <CancelModal order={state.modal.order} token={token} onClose={() => state.setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {state.modal?.type === "duplicate" && (
        <DuplicateModal order={state.modal.order} token={token} onClose={() => state.setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {state.modal?.type === "address" && (
        <EditAddressModal order={state.modal.order} token={token} onClose={() => state.setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {state.modal?.type === "fulfill" && (
        <FulfillModal order={state.modal.order} token={token} onClose={() => state.setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {state.modal?.type === "note" && <NoteModal order={state.modal.order} token={token} onClose={() => state.setModal(null)} onSuccess={handleModalSuccess} />}

      {/* Macro Manager overlay */}
      {state.showMacroManager && (
        <MacroManager
          macros={macros}
          favs={macroFavs}
          onClose={() => state.setShowMacroManager(false)}
          onSaveMacro={(m) => {
            _saveMacro(m);
            sonnerToast.success("Macro saved");
          }}
          onDeleteMacro={(id) => {
            _deleteMacro(id);
            sonnerToast("Macro deleted");
          }}
          onToggleFav={_toggleMacroFav}
        />
      )}
    </div>
  );
}

// Wrapper checks email-connection status before rendering the inbox.
// If no email account is connected for this workspace, render the
// onboarding empty state instead.
export default function InboxPageWrapper() {
  const { data: emailConnected, isLoading } = useEmailConnected();

  if (isLoading || emailConnected === undefined) return null; // brief loading flash, no spinner

  if (!emailConnected) {
    return (
      <EmptyState
        icon="📬"
        title="Connect your email to get started"
        description="Connect your email account to start receiving and managing customer support tickets."
        actions={[
          {
            label: "Connect Email",
            href: "/settings/integrations/email",
            variant: "primary",
          },
        ]}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <InboxPage />
    </Suspense>
  );
}
