"use client";

import type { Thread } from "@/types/inbox";
import type { RefundOrder } from "@/components/shared/modals/refund-modal";
import type { DuplicateOrder } from "@/components/shared/modals/duplicate-modal";
import type { CancelOrder } from "@/components/shared/modals/cancel-modal";
import type { EditAddressOrder } from "@/components/shared/modals/edit-address-modal";
import type { FulfillOrder } from "@/components/shared/modals/fulfill-modal";
import type { NoteOrder } from "@/components/shared/modals/note-modal";
import { MacroManager } from "@/components/features/inbox/macro-manager";
import { ConversationPanel } from "@/components/features/inbox/conversation-panel";
import { CustomerSidebar } from "@/components/features/inbox/customer-sidebar";
import { ThreadListPanel } from "@/components/features/inbox/thread-list-panel";
import { InboxUsageBanner } from "@/components/features/inbox/usage-banner";
import { InboxSyncNotice } from "@/components/features/inbox/sync-notice";
import { CancelModal } from "@/components/shared/modals/cancel-modal";
import { DuplicateModal } from "@/components/shared/modals/duplicate-modal";
import { EditAddressModal } from "@/components/shared/modals/edit-address-modal";
import { FulfillModal } from "@/components/shared/modals/fulfill-modal";
import { NoteModal } from "@/components/shared/modals/note-modal";
import { CreateTaskModal } from "@/components/shared/modals/create-task-modal";
import { RefundModal } from "@/components/shared/modals/refund-modal";
import { CreateOrderModal } from "@/components/shared/modals/create-order-modal";
import type { CreateOrderCustomer } from "@/components/shared/modals/create-order-modal";
import { useConversations, useEmailConnected } from "@/hooks/inbox/use-inbox-data";
import { useAIMacros } from "@/hooks/inbox/use-inbox-mutations";
import { useKeyboardShortcuts } from "@/hooks/inbox/use-keyboard-shortcuts";
import { URGENCY_SCORE } from "@/lib/inbox-constants";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { toast as sonnerToast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useAIStore } from "@/stores/ai";
import { useMacrosStore } from "@/stores/macros";
import { useInboxUI } from "@/stores/inbox-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { Mail } from "lucide-react";

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

  // Auto-select conversation matching ?customer_email param
  const customerEmailParam = searchParams?.get("customer_email");

  // Auto-select conversation by id from ?conversation_id param (global search).
  const conversationIdParam = searchParams?.get("conversation_id");

  // ── TanStack queries ──
  const { data: threads = [] } = useConversations(activeFolder, search);

  // ── Auth + initial load ──
  useEffect(() => {
    if (!session) {
      window.location.href = "/login";
      return;
    }
    void _fetchMacros(token);
  }, [session, _fetchMacros, token]);

  // ── Trigger AI analysis when threads change ──
  useEffect(() => {
    if (threads.length > 0 && token) {
      void _analyzeThreads(threads, token);
    }
  }, [threads, token, _analyzeThreads]);

  // ── Auto-fetch AI macros + detect language when thread changes ──
  const aiMacrosMutation = useAIMacros();
  const selectedThread = useMemo(() => threads.find((t: Thread) => t.id === selectedThreadId) || null, [threads, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId || !selectedThread || !token) return;
    void aiMacrosMutation
      .mutateAsync({ subject: selectedThread.subject, snippet: selectedThread.snippet })
      .then((macroList) => {
        if (macroList?.length) _setAiMacros(macroList);
      })
      .catch(() => {});
    if (selectedThread.snippet) {
      void _detectLanguage(selectedThread.snippet, token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId, selectedThread, token]);

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

  // ── Auto-select thread from customer_email param ──
  useEffect(() => {
    if (customerEmailParam && threads?.length) {
      const match = threads.find(
        (t: Thread) => t.customer_email === customerEmailParam,
      );
      if (match && match.id !== selectedThreadId) {
        openThread(match);
      }
    }
  }, [customerEmailParam, threads, selectedThreadId, openThread]);

  // ── Auto-select thread from conversation_id param ──
  useEffect(() => {
    if (conversationIdParam && threads?.length) {
      const match = threads.find((t: Thread) => t.id === conversationIdParam)
      if (match && match.id !== selectedThreadId) {
        openThread(match)
      }
    }
  }, [conversationIdParam, threads, selectedThreadId, openThread]);

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
      <div className="flex h-screen overflow-hidden relative bg-background dark:bg-[#0A0520] [font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif] antialiased [&_*]:box-border [&_input]:font-[inherit] [&_textarea]:font-[inherit] [&_select]:font-[inherit] [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-[rgba(17,17,17,0.45)] [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:rounded-md [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-[rgba(17,17,17,0.45)] [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:rounded-md [&_input:focus-visible]:outline-none [&_textarea:focus-visible]:outline-none [&_[contenteditable]:focus-visible]:outline-none">
        {/* ── Aurora background ── */}
        <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="hidden dark:block absolute rounded-full animate-aurora-a" style={{ top: '-25%', left: '12%', width: 1000, height: 900, background: 'radial-gradient(ellipse,rgba(161,117,252,0.62) 0%,rgba(124,58,237,0.32) 38%,rgba(109,40,217,0.1) 60%,transparent 74%)', filter: 'blur(55px)' }} />
          <div className="hidden dark:block absolute rounded-full animate-aurora-d" style={{ top: '2%', left: '3%', width: 420, height: 420, background: 'radial-gradient(ellipse,rgba(139,92,246,0.55) 0%,rgba(109,40,217,0.22) 50%,transparent 72%)', filter: 'blur(42px)' }} />
          <div className="hidden dark:block absolute rounded-full animate-aurora-b" style={{ bottom: '10%', left: '30%', width: 500, height: 500, background: 'radial-gradient(ellipse,rgba(107,63,196,0.38) 0%,rgba(75,40,148,0.14) 48%,transparent 70%)', filter: 'blur(58px)', animationDirection: 'reverse' }} />
          <div className="hidden dark:block absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />
          <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_115%_105%_at_50%_50%,transparent_32%,rgba(10,5,32,0.42)_70%,rgba(10,5,32,0.82)_100%)]" />
        </div>

      {/* Workspace usage banner — fixed-positioned, conditionally rendered */}
      <InboxUsageBanner />

      {/* Initial-sync notice — shown while any account is still importing */}
      <InboxSyncNotice />

      <ThreadListPanel />

      <ConversationPanel />

      {selectedThreadId && <CustomerSidebar />}

      {/* ═══════════════ Modals ═══════════════ */}
      {modal?.type === "refund" && <RefundModal order={modal.order as RefundOrder} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "cancel" && <CancelModal order={modal.order as CancelOrder} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "duplicate" && <DuplicateModal order={modal.order as DuplicateOrder} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "address" && <EditAddressModal order={modal.order as EditAddressOrder} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "fulfill" && <FulfillModal order={modal.order as FulfillOrder} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "note" && <NoteModal order={modal.order as NoteOrder} token={token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type === "create-task" && modal.order && (
        <CreateTaskModal
          linkedOrder={{
            shopifyOrderId: String(modal.order.id),
            shopifyOrderName: modal.order.name || `#${modal.order.id}`,
            customerEmail: modal.customerEmail || undefined,
            customerName: modal.customerName || undefined,
          }}
          onClose={() => setModal(null)}
          onSuccess={(msg, type) => {
            setModal(null);
            if (type === "error") sonnerToast.error(msg);
            else sonnerToast.success(msg);
          }}
        />
      )}

      {modal?.type === "create-order" && modal.customer && (
        <CreateOrderModal
          customer={modal.customer as CreateOrderCustomer}
          customerName={modal.customerName ?? ""}
          token={token}
          onClose={() => setModal(null)}
          onSuccess={handleModalSuccess}
        />
      )}

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
        icon={Mail}
        title="Connect your email to get started"
        description="Connect your email account to start receiving and managing customer support tickets."
        actionLabel="Connect Email"
        onAction={() => window.location.href = "/settings/integrations/email"}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <InboxPage />
    </Suspense>
  );
}
