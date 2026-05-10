"use client";

import type { Thread } from "@/types/inbox";
import { MacroManager } from "@/components/features/inbox/macro-manager";
import { ConversationPanel } from "@/components/features/inbox/conversation-panel";
import { CustomerSidebar } from "@/components/features/inbox/customer-sidebar";
import { ThreadListPanel } from "@/components/features/inbox/thread-list-panel";
import { CancelModal } from "@/components/shared/modals/cancel-modal";
import { DuplicateModal } from "@/components/shared/modals/duplicate-modal";
import { EditAddressModal } from "@/components/shared/modals/edit-address-modal";
import { FulfillModal } from "@/components/shared/modals/fulfill-modal";
import { NoteModal } from "@/components/shared/modals/note-modal";
import { RefundModal } from "@/components/shared/modals/refund-modal";
import { useConversations, useEmailConnected } from "@/hooks/inbox/use-inbox-data";
import { useAIMacros } from "@/hooks/inbox/use-inbox-mutations";
import { useKeyboardShortcuts } from "@/hooks/inbox/use-keyboard-shortcuts";
import { URGENCY_SCORE } from "@/lib/inbox-constants";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { toast as sonnerToast } from "sonner";
import { useAuthStore } from "../../stores/auth";
import { useAIStore } from "../../stores/ai";
import { useMacrosStore } from "../../stores/macros";
import { useInboxUI } from "../../stores/inbox-ui";
import EmptyState from "../components/EmptyState";
import Sidebar from "../components/Sidebar";

// ─── Main page ────────────────────────────────────────────────
function InboxPage() {
  const searchParams = useSearchParams();

  // ── Auth ──
  const session = useAuthStore((s) => s.session);
  const token = session?.access_token ?? "";

  // ── Zustand UI state ──
  const selectedThreadId = useInboxUI((s) => s.selectedThreadId);
  const activeFolder = useInboxUI((s) => s.activeFolder);
  const search = useInboxUI((s) => s.search);
  const modal = useInboxUI((s) => s.modal);
  const showMacroManager = useInboxUI((s) => s.showMacroManager);
  const setActiveFolder = useInboxUI((s) => s.setActiveFolder);
  const setModal = useInboxUI((s) => s.setModal);
  const setShowMacroManager = useInboxUI((s) => s.setShowMacroManager);
  const setSelectedThreadId = useInboxUI((s) => s.setSelectedThreadId);
  const resetForNewThread = useInboxUI((s) => s.resetForNewThread);

  // ── Composer ref for keyboard shortcuts ──
  const composerRef = useRef<HTMLDivElement>(null);

  // ── AI store ──
  const analyses = useAIStore((s) => s.analyses);
  const _analyzeThreads = useAIStore((s) => s.analyzeThreads);
  const _resetAIForThread = useAIStore((s) => s.resetForThread);
  const _detectLanguage = useAIStore((s) => s.detectLanguage);

  // ── Macros store ──
  const macros = useMacrosStore((s) => s.macros);
  const macroFavs = useMacrosStore((s) => s.favs);
  const _saveMacro = useMacrosStore((s) => s.saveMacro);
  const _deleteMacro = useMacrosStore((s) => s.deleteMacro);
  const _toggleMacroFav = useMacrosStore((s) => s.toggleFav);
  const _setAiMacros = useMacrosStore((s) => s.setAiMacros);
  const _fetchMacros = useMacrosStore((s) => s.fetchMacros);

  // Initialize activeFolder from search params
  useEffect(() => {
    const view = searchParams.get("view");
    if (view) setActiveFolder(view);
  }, [searchParams, setActiveFolder]);

  // ── TanStack queries ──
  const { data: threads = [] } = useConversations(activeFolder, search);

  // ── Auth + initial load ──
  useEffect(() => {
    if (!session) {
      window.location.href = "/login";
      return;
    }
    _fetchMacros(token);
  }, [session, _fetchMacros, token]);

  // ── Trigger AI analysis when threads change ──
  useEffect(() => {
    if (threads.length > 0 && token) {
      _analyzeThreads(threads, token);
    }
  }, [threads, token, _analyzeThreads]);

  // ── Auto-fetch AI macros + detect language when thread changes ──
  const aiMacrosMutation = useAIMacros();
  const selectedThread = useMemo(() => threads.find((t: Thread) => t.id === selectedThreadId) || null, [threads, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId || !selectedThread || !token) return;
    aiMacrosMutation
      .mutateAsync({ subject: selectedThread.subject, snippet: selectedThread.snippet })
      .then((macroList) => {
        if (macroList?.length) _setAiMacros(macroList);
      })
      .catch(() => {});
    if (selectedThread.snippet) {
      _detectLanguage(selectedThread.snippet, token);
    }
  }, [selectedThreadId, selectedThread, token, aiMacrosMutation, _setAiMacros, _detectLanguage]);

  // ── Sorted threads for keyboard nav ──
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

  // ── Thread selection ──
  const openThread = useCallback(
    (thread: Thread) => {
      setSelectedThreadId(thread.id);
      resetForNewThread();
      _resetAIForThread();
    },
    [setSelectedThreadId, resetForNewThread, _resetAIForThread],
  );

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts({
    threads: sortedFiltered,
    selectedThreadId,
    onSelectThread: openThread,
    composerRef,
  });

  function handleModalSuccess(msg: string, type = "success") {
    setModal(null);
    if (type === "success") sonnerToast.success(msg);
    else sonnerToast.error(msg);
  }

  if (!session) return null;

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

      <ThreadListPanel />

      <ConversationPanel />

      {selectedThreadId && <CustomerSidebar />}

      {/* ═══════════════ Modals ═══════════════ */}
      {modal?.type === "refund" && <RefundModal order={modal.order} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "cancel" && <CancelModal order={modal.order} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "duplicate" && <DuplicateModal order={modal.order} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "address" && <EditAddressModal order={modal.order} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "fulfill" && <FulfillModal order={modal.order} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "note" && <NoteModal order={modal.order} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}

      {/* Macro Manager overlay */}
      {showMacroManager && (
        <MacroManager
          macros={macros}
          favs={macroFavs}
          onClose={() => setShowMacroManager(false)}
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
export default function InboxPageWrapper() {
  const { data: emailConnected, isLoading } = useEmailConnected();

  if (isLoading || emailConnected === undefined) return null;

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
