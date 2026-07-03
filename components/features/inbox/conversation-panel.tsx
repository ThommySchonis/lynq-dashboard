"use client";

import type { Thread, ConversationTag, BulkActionId, BulkActionPayload, TicketMeta } from "@/types/inbox";
import { MacroPanel } from "@/components/features/inbox/macro-panel";
import { TicketActionBar } from "@/components/features/inbox/ticket-action-bar";
import { ConversationTopbar } from "@/components/features/inbox/conversation-topbar";
import { TicketMetaStrip } from "@/components/features/inbox/ticket-meta-strip";
import { ComposerMacros } from "@/components/features/inbox/composer-macros";
import { MessageList } from "@/components/features/inbox/message-list";
import { NotesSection } from "@/components/features/inbox/notes-section";
import { AttachmentBar } from "@/components/features/inbox/attachment-bar";
import { ComposerToolbar } from "@/components/features/inbox/composer-toolbar";
import { Button } from "@/components/ui/button";
import { extractEmail, extractName, plainTextToSafeHtml, sanitizeHtml, toTicketMeta } from "@/lib/inbox-utils";
import { ChevronDown, Globe, Mail, X } from "lucide-react";
import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { useInboxUI } from "@/stores/inbox-ui";
import { useAuthStore } from "@/stores/auth";
import { useAIStore } from "@/stores/ai";
import { useMacrosStore } from "@/stores/macros";
import { useConversations, useConversation, useInboxMembers, inboxKeys } from "@/hooks/inbox/use-inbox-data";
import { useSendReply, useUpdateStatus, useTranslateMessage, useBulkConversationAction, useAddNote, useUpdateTicketMeta } from "@/hooks/inbox/use-inbox-mutations";
import { useTags, useCreateTag } from "@/hooks/inbox/use-tags";
import { useComposerActions } from "@/hooks/inbox/use-composer-actions";
import { usePermissions } from "@/hooks/use-permissions";
import { useStoreAiSettings } from "@/hooks/stores/use-stores-data";
import { useQueryClient } from "@tanstack/react-query";
import { AiDraftReview } from "./ai-draft-review";
import { usePendingDraft, useUpdateDraftStatus } from "@/hooks/ai";
import { useMacros, useDeleteMacro } from '@/hooks/macros';

const REFUND_REASONS = [
  { value: "customer", label: "Customer changed mind" },
  { value: "fraud", label: "Fraudulent order" },
  { value: "inventory", label: "Item out of stock" },
  { value: "declined", label: "Payment declined" },
  { value: "quality", label: "Product quality issue" },
  { value: "shipping", label: "Shipping problem" },
  { value: "wrong_item", label: "Wrong item received" },
  { value: "other", label: "Other" },
] as const;

// Hidden per Figma chat view (1283-52898): the To: row, ticket tags/meta bar,
// attachments and auto-translate aren't shown there. Kept behind this flag so
// the client can restore them by flipping it to true. Typed `boolean` so the
// dead-branch checks stay quiet.
const SHOW_LEGACY: boolean = false;

export function ConversationPanel() {
  // Refs (local to this component)
  const composerRef = useRef<HTMLDivElement>(null);
  const imgUploadRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);

  // Refund reason picker state
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [pendingResolveId, setPendingResolveId] = useState<string | null>(null);
  const [pendingNextThreadId, setPendingNextThreadId] = useState<string | null | undefined>(undefined);

  // Auth
  const session = useAuthStore((s) => s.session);
  const token = session?.access_token ?? "";
  const isSuspended = useAuthStore((s) => s.isSuspended);

  // Permissions
  const { can } = usePermissions();
  const canReply = can.replyToTickets;

  // Zustand UI state
  const selectedThreadId = useInboxUI((s) => s.selectedThreadId);
  const composerTab = useInboxUI((s) => s.composerTab);
  const reply = useInboxUI((s) => s.reply);
  const showEmoji = useInboxUI((s) => s.showEmoji);
  const showMacros = useInboxUI((s) => s.showMacros);
  const activeFolder = useInboxUI((s) => s.activeFolder);
  const search = useInboxUI((s) => s.search);
  const autoTranslate = useAIStore((s) => s.autoTranslate);
  const customerLang = useAIStore((s) => s.customerLang);
  const setComposerTab = useInboxUI((s) => s.setComposerTab);
  const setReply = useInboxUI((s) => s.setReply);
  const setShowEmoji = useInboxUI((s) => s.setShowEmoji);
  const setAttachments = useInboxUI((s) => s.setAttachments);
  const setShowMacros = useInboxUI((s) => s.setShowMacros);
  const setShowMacroManager = useInboxUI((s) => s.setShowMacroManager);
  const setSending = useInboxUI((s) => s.setSending);
  const setSelectedThreadId = useInboxUI((s) => s.setSelectedThreadId);
  const resetForNewThread = useInboxUI((s) => s.resetForNewThread);

  // AI state
  const queryClient = useQueryClient();
  const aiLoading = useAIStore((s) => s.aiLoading);
  const setAutoTranslate = useAIStore((s) => s.setAutoTranslate);
  const generateReply = useAIStore((s) => s.generateReply);
  const resetAIForThread = useAIStore((s) => s.resetForThread);

  // Draft workflow
  const editingDraftId = useInboxUI((s) => s.editingDraftId);
  const setEditingDraftId = useInboxUI((s) => s.setEditingDraftId);
  const { data: pendingDraft, isFetched: draftFetched } = usePendingDraft(selectedThreadId);
  const updateDraft = useUpdateDraftStatus(selectedThreadId ?? "");
  const autoTriggeredRef = useRef<string | null>(null);
  const loadedDraftRef = useRef<string | null>(null);
  const draftPending = pendingDraft?.status === "pending";

  // Macros — stored macros come from the server; favs/aiMacros stay local UI state.
  const { data: macros = [] } = useMacros({ search: '', language: '', tags: [], archived: false });
  const aiMacros = useMacrosStore((s) => s.aiMacros);
  const macroFavs = useMacrosStore((s) => s.favs);
  const toggleMacroFav = useMacrosStore((s) => s.toggleFav);
  const deleteMacroMut = useDeleteMacro();

  // Ticket meta — persisted on the conversation, written via PATCH
  const updateTicketMeta = useUpdateTicketMeta();

  // TanStack data
  const { data: threads = [] } = useConversations(activeFolder, search);
  const { data: conversationData } = useConversation(selectedThreadId);
  const messages = useMemo(() => conversationData?.messages || [], [conversationData?.messages]);
  const conversationTags = (conversationData?.tags ?? []) as ConversationTag[];

  const selectedThread = useMemo(() => threads.find((t: Thread) => t.id === selectedThreadId) || null, [threads, selectedThreadId]);

  const { data: storeAiSettings } = useStoreAiSettings(selectedThread?.store_id ?? "");

  // Tag DB hooks
  const bulkAction = useBulkConversationAction();
  const { data: allTags = [] } = useTags();
  const { data: members = [] } = useInboxMembers();
  const createTag = useCreateTag();

  // Mutations
  const sendReplyMutation = useSendReply();
  const addNoteMutation = useAddNote();
  const updateStatusMutation = useUpdateStatus();
  const translateMutation = useTranslateMessage();

  // Composer actions
  const { formatDoc, insertLink, handleImageUpload, handleFileAttach, insertEmoji } = useComposerActions(
    composerRef,
    setReply,
    setAttachments,
    (msg, type = "success") => {
      if (type === "success") sonnerToast.success(msg);
      else sonnerToast.error(msg);
    },
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-generate AI reply when opening a conversation with a new inbound
  // message — only when the store has auto-generate enabled.
  useEffect(() => {
    if (
      !selectedThreadId ||
      !selectedThread?.store_id ||
      !storeAiSettings?.ai_auto_generate ||
      !messages.length ||
      !draftFetched ||
      pendingDraft ||
      aiLoading ||
      autoTriggeredRef.current === selectedThreadId
    )
      return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.direction !== "inbound") return;

    autoTriggeredRef.current = selectedThreadId;
    void generateReply(selectedThread, messages, token);
  }, [selectedThreadId, selectedThread, storeAiSettings, messages, draftFetched, pendingDraft, aiLoading, generateReply, token]);

  // Load a pending AI draft into the composer once (inline review, Figma 517).
  useEffect(() => {
    if (draftPending && pendingDraft && loadedDraftRef.current !== pendingDraft.id) {
      loadedDraftRef.current = pendingDraft.id;
      if (composerRef.current) {
        composerRef.current.innerHTML = plainTextToSafeHtml(pendingDraft.suggested_text);
        setReply(composerRef.current.textContent ?? "");
      }
      setEditingDraftId(pendingDraft.id);
    }
  }, [draftPending, pendingDraft, setReply, setEditingDraftId]);

  // Status helpers
  const getStatus = useCallback(
    (id: string) => {
      const thread = threads.find((t: Thread) => t.id === id);
      return thread?.status || "open";
    },
    [threads],
  );

  async function saveStatus(id: string, s: string) {
    if (s === "resolved") {
      setPendingResolveId(id);
      setShowReasonPicker(true);
      return;
    }
    await updateStatusMutation.mutateAsync({ threadId: id, status: s });
  }

  async function handleResolveWithReason(reason: string | null) {
    if (!pendingResolveId) return;
    const metadata = reason ? { refund_reason: reason } : undefined;
    await updateStatusMutation.mutateAsync({
      threadId: pendingResolveId,
      status: "resolved",
      metadata,
    });
    setShowReasonPicker(false);
    setPendingResolveId(null);
    if (pendingNextThreadId !== undefined) {
      sonnerToast.success("Resolved & closed");
      if (pendingNextThreadId) {
        setSelectedThreadId(pendingNextThreadId);
        useInboxUI.getState().resetForNewThread();
      } else {
        setSelectedThreadId(null);
      }
      setPendingNextThreadId(undefined);
    }
  }

  async function handleAddTag(name: string) {
    if (!selectedThread) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    const tagId = existing?.id ?? (await createTag.mutateAsync({ name: trimmed })).id;
    await bulkAction.mutateAsync({ ids: [selectedThread.id], action: "add_tag", payload: { tagId } });
  }

  async function handleRemoveTag(tag: ConversationTag) {
    if (!selectedThread) return;
    await bulkAction.mutateAsync({ ids: [selectedThread.id], action: "remove_tag", payload: { tagId: tag.id } });
  }

  function updateTicketField(id: string, key: keyof TicketMeta, label: string) {
    const value = prompt(`${label}:`);
    if (value === null) return;
    void updateTicketMeta.mutateAsync({ threadId: id, meta: { [key]: value.trim() } as Partial<TicketMeta> })
      .catch((e) => sonnerToast.error(e instanceof Error ? e.message : "Failed to update"));
  }

  // Persist a ticket-meta field directly (the meta strip already prompts for the value).
  function persistMeta(meta: Partial<TicketMeta>) {
    if (!selectedThreadId) return;
    void updateTicketMeta.mutateAsync({ threadId: selectedThreadId, meta })
      .catch((e) => sonnerToast.error(e instanceof Error ? e.message : "Failed to update"));
  }

  // Sorted threads for send & resolve navigation
  const sortedFiltered = useMemo(() => threads, [threads]);

  // Prev/next conversation navigation (conv-topbar arrows)
  const currentIndex = sortedFiltered.findIndex((t: Thread) => t.id === selectedThreadId);
  const navigateThread = useCallback(
    (dir: -1 | 1) => {
      const next = sortedFiltered[currentIndex + dir];
      if (!next) return;
      setSelectedThreadId(next.id);
      resetForNewThread();
      resetAIForThread();
    },
    [sortedFiltered, currentIndex, setSelectedThreadId, resetForNewThread, resetAIForThread],
  );

  // Single-conversation bulk action (assign / snooze / spam / delete from top bar)
  const singleAction = useCallback(
    async (action: BulkActionId, payload?: BulkActionPayload) => {
      if (!selectedThreadId) return;
      try {
        await bulkAction.mutateAsync({ ids: [selectedThreadId], action, payload });
      } catch (e) {
        sonnerToast.error(e instanceof Error ? e.message : "Action failed");
      }
    },
    [selectedThreadId, bulkAction],
  );

  // Send reply
  async function handleSend() {
    const textContent = composerRef.current?.textContent || reply;
    if (!textContent.trim() || !selectedThreadId) return false;
    setSending(true);
    // Internal note mode → persist a note instead of sending an email reply.
    // Notes are plain text (rendered with whitespace-pre-wrap in NotesSection).
    if (composerTab === "note") {
      try {
        await addNoteMutation.mutateAsync({
          threadId: selectedThreadId,
          body: textContent.trim(),
        });
        sonnerToast.success("Note added");
        if (composerRef.current) composerRef.current.innerHTML = "";
        setReply("");
        return true;
      } catch {
        sonnerToast.error("Failed to add note");
        return false;
      } finally {
        setSending(false);
      }
    }
    let bodyHtml = sanitizeHtml(composerRef.current?.innerHTML || reply);
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
      threadId: selectedThreadId,
      bodyHtml,
      bodyText,
    });
    if (data.success || data.messageId || data.id) {
      if (editingDraftId) {
        await updateDraft.mutateAsync({
          draftId: editingDraftId,
          status: "edited",
          editedText: bodyText,
        });
        setEditingDraftId(null);
      }
      sonnerToast.success("Message sent!");
      if (composerRef.current) composerRef.current.innerHTML = "";
      setReply("");
      setAttachments([]);
      setSending(false);
      return true;
    }
    sonnerToast.error(data.error || "Failed to send");
    setSending(false);
    return false;
  }

  async function handleSendResolve() {
    if (!selectedThreadId) return;
    const currentId = selectedThreadId;
    const currentIdx = sortedFiltered.findIndex((t: Thread) => t.id === currentId);
    const nextThread = sortedFiltered.find((_t: Thread, i: number) => i !== currentIdx);
    const ok = await handleSend();
    if (ok) {
      setPendingNextThreadId(nextThread?.id ?? null);
      setPendingResolveId(currentId);
      setShowReasonPicker(true);
    }
  }

  // AI reply
  async function handleAiReply() {
    if (!messages.length || !selectedThreadId || !selectedThread) return;
    const result = await generateReply(selectedThread, messages, token);
    if (!result) {
      sonnerToast.error("AI reply failed");
      return;
    }
    // Emma Phase 2: when the server already auto-sent the reply, surface a
    // toast and refresh the thread instead of populating the composer.
    // Mirrors the post-send invalidation pattern in useSendReply().
    if (result.autoSent) {
      sonnerToast.success("Emma sent the reply automatically.");
      void queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      return;
    }
    if (composerRef.current) {
      composerRef.current.innerHTML = plainTextToSafeHtml(result.reply);
      setReply(composerRef.current.textContent);
    } else setReply(result.reply);
  }

  // AI draft (inline): the pending draft loads into the composer so Send
  // approves it and editing happens in place. "No" sends comment-only feedback
  // (and discards); Discard declines without feedback; "Yes" is a positive ack
  // (no backend feedback endpoint yet — BE task #7).
  async function handleDraftDecline(comment?: string) {
    if (!pendingDraft) return;
    loadedDraftRef.current = pendingDraft.id; // don't reload this draft
    await updateDraft.mutateAsync({ draftId: pendingDraft.id, status: "declined", feedbackComment: comment });
    if (composerRef.current) composerRef.current.innerHTML = "";
    setReply("");
    setEditingDraftId(null);
    sonnerToast.success(comment ? "Feedback sent" : "Draft discarded");
  }

  function handleDraftHelpfulYes() {
    sonnerToast.success("Thanks — glad it helped!");
  }

  if (!selectedThread) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-[1]">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="opacity-40">
            <Mail size={20} />
          </div>
          <div className="text-[13px]">Select a thread to read</div>
          <div className="text-[11px] text-muted-foreground">j / k navigate · r reply</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-[1]">
      {/* Ticket header — conv-topbar (Figma 1283-52902) */}
      <ConversationTopbar
        title={selectedThread.subject}
        status={getStatus(selectedThread.id)}
        assignedTo={selectedThread.assigned_to ?? null}
        members={members}
        onStatus={(s) => void saveStatus(selectedThread.id, s)}
        onAssign={(memberId) => void singleAction("assign", { memberId })}
        onSnooze={(until) => void singleAction("snooze", { until })}
        onSpam={() => void singleAction("spam")}
        onPrev={() => navigateThread(-1)}
        onNext={() => navigateThread(1)}
        canPrev={currentIndex > 0}
        canNext={currentIndex >= 0 && currentIndex < sortedFiltered.length - 1}
        disabled={isSuspended}
      />

      {/* Meta strip — Add tags / Contact reason / Product / Resolution (Figma 301:3447) */}
      <TicketMetaStrip
        contactReason={toTicketMeta(selectedThread).contactReason ?? ""}
        product={toTicketMeta(selectedThread).product ?? ""}
        resolution={toTicketMeta(selectedThread).resolution ?? ""}
        onSetContactReason={(v) => persistMeta({ contactReason: v })}
        onSetProduct={(v) => persistMeta({ product: v })}
        onSetResolution={(v) => persistMeta({ resolution: v })}
        onAddTag={() => {
          const name = window.prompt("Tag name");
          if (name) void handleAddTag(name);
        }}
      />

      {/* Tags + ticket meta — hidden per Figma (restore via SHOW_LEGACY) */}
      {SHOW_LEGACY && (
        <div className="py-2.5 px-[18px] border-b border-border shrink-0 bg-card">
          <TicketActionBar
            meta={toTicketMeta(selectedThread)}
            tags={conversationTags}
            onAddTag={() => {
              const name = window.prompt("Tag name");
              if (name) void handleAddTag(name);
            }}
            onRemoveTag={(tag) => void handleRemoveTag(tag)}
            onFieldChange={(field, labelOrValue) =>
              field === "tier"
                ? void updateTicketMeta
                    .mutateAsync({ threadId: selectedThread.id, meta: { tier: labelOrValue } })
                    .catch((e) => sonnerToast.error(e instanceof Error ? e.message : "Failed to update"))
                : updateTicketField(selectedThread.id, field as keyof TicketMeta, labelOrValue)
            }
          />
        </div>
      )}

      {/* Messages + Notes + Note input */}
      <div className="thin-scrollbar conv-area flex-1 overflow-y-auto px-6 py-5 bg-[#FAFAFA]">
        <MessageList msgEndRef={msgEndRef} />
        <NotesSection />
      </div>

      {/* Composer */}
      <div className="border-t border-border shrink-0 bg-card">
        {/* Macro panel */}
        {showMacros && (
          <MacroPanel
            macros={macros}
            aiMacros={aiMacros}
            customerName={extractName(selectedThread?.from || "")}
            favs={macroFavs}
            onToggleFav={toggleMacroFav}
            onInsert={(body) => {
              const safeBody = plainTextToSafeHtml(body);
              if (composerRef.current) {
                composerRef.current.innerHTML = safeBody;
                setReply(composerRef.current.textContent);
              } else setReply(body);
              setShowMacros(false);
              setTimeout(() => composerRef.current?.focus(), 10);
            }}
            onClose={() => setShowMacros(false)}
            onManage={() => {
              setShowMacros(false);
              setShowMacroManager(true);
            }}
            onCreateNew={() => {
              setShowMacros(false);
              setShowMacroManager(true);
            }}
            onDeleteMacro={(id) => deleteMacroMut.mutate(id)}
          />
        )}

        {/* Composer */}
        {!showMacros && (
          <>
            {/* Tab strip — pills (Figma 1283-52943: active = accent-soft + primary) */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-1">
              {[
                { id: "reply", label: "Reply" },
                { id: "note", label: "Private note" },
              ].map((t) => {
                const tabActive = composerTab === t.id;
                return (
                  <button
                    key={t.id}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-inherit transition-colors duration-150 ${tabActive ? "bg-accent-soft text-primary font-semibold" : "text-foreground-3 font-medium hover:text-foreground-2 hover:bg-secondary"}`}
                    onClick={() => setComposerTab(t.id as "reply" | "note")}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* To: row — hidden per Figma (restore via SHOW_LEGACY) */}
            {SHOW_LEGACY && (
              <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border">
                <span className="flex text-muted-foreground shrink-0">
                  <Mail size={14} />
                </span>
                <span className="text-[11.5px] text-foreground-2 font-semibold shrink-0">To:</span>
                <span className="flex-1 text-xs text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                  {extractName(selectedThread.from)}
                  {extractEmail(selectedThread.from) ? ` (${extractEmail(selectedThread.from)})` : ""}
                </span>
                <ChevronDown size={11} className="text-muted-foreground shrink-0" />
              </div>
            )}

            {/* Hidden file inputs (attachments — restore via SHOW_LEGACY) */}
            {SHOW_LEGACY && (
              <>
                <input ref={imgUploadRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <input ref={fileUploadRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
              </>
            )}

            {/* Flat compose area */}
            <div className="bg-card dark:bg-[rgba(255,255,255,0.025)]" onClick={() => showEmoji && setShowEmoji(false)}>
              {/* Auto-translate banner — hidden per Figma (restore via SHOW_LEGACY) */}
              {SHOW_LEGACY && autoTranslate && customerLang && customerLang.code !== "en" && (
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-secondary border-b border-border text-[11.5px] text-foreground-2">
                  <span className="flex">
                    <Globe size={13} />
                  </span>
                  <span className="flex-1">
                    Auto-translating to <strong>{customerLang.name}</strong>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setAutoTranslate(false)} className="text-muted-foreground flex p-0">
                    <X size={10} />
                  </Button>
                </div>
              )}

              {/* Attachments — hidden per Figma (restore via SHOW_LEGACY) */}
              {SHOW_LEGACY && <AttachmentBar />}

              {/* View-only hint */}
              {!canReply && <p className="px-4 py-2 text-xs text-muted-foreground">View-only access — you cannot reply to tickets.</p>}

              {/* AI draft review (inline) — Figma 517 */}
              {draftPending && (
                <AiDraftReview
                  onHelpfulYes={handleDraftHelpfulYes}
                  onHelpfulNo={(comment) => void handleDraftDecline(comment)}
                  disabled={updateDraft.isPending}
                />
              )}

              {/* Contenteditable composer — bordered box (Figma 1283-52943) */}
              <div className="mx-3.5 my-2 overflow-hidden rounded-xl border border-accent-soft bg-background dark:bg-[rgba(255,255,255,0.025)]">
                <div
                  ref={composerRef}
                  contentEditable={canReply}
                  suppressContentEditableWarning
                  data-placeholder={composerTab === "reply" ? "Write a reply…  type / to insert a macro" : "Internal note — not visible to customer…"}
                  onInput={(e) => {
                    const text = e.currentTarget.textContent ?? "";
                    // "/" on an empty reply opens the macro panel (Figma hint).
                    if (composerTab === "reply" && text === "/") {
                      e.currentTarget.innerHTML = "";
                      setReply("");
                      setShowMacros(true);
                      return;
                    }
                    setReply(text);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSend();
                  }}
                  className={`compose-ta w-full resize-none outline-none bg-transparent px-3.5 py-3 text-sm text-foreground leading-relaxed min-h-[120px] tracking-[.005em] ${composerTab === "note" ? "bg-[rgba(251,191,36,0.03)]" : ""} ${!canReply ? "opacity-50 cursor-not-allowed" : ""}`}
                />
              </div>

              {/* AI draft: Discard (Figma footer) */}
              {draftPending && (
                <div className="px-3.5 pb-1">
                  <button
                    type="button"
                    onClick={() => void handleDraftDecline()}
                    disabled={updateDraft.isPending}
                    className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Discard
                  </button>
                </div>
              )}

              {/* AI loading — "Lynq AI is reading…" + animated dots in one row.
                  Bound to aiLoading (settles on success and error), so it never
                  sticks; covers both the explicit AI Reply click and auto-draft. */}
              {aiLoading && (
                <div className="pt-1 px-4 pb-0 flex items-center gap-1.5">
                  <span className="text-[12px] font-medium text-foreground-3">Lynq AI is reading…</span>
                  {[0, 0.18, 0.36].map((d) => (
                    <span
                      key={d}
                      className="w-[5px] h-[5px] rounded-full bg-foreground-3 block"
                      style={{ animation: `glowPulse .9s ease-in-out ${d}s infinite` }}
                    />
                  ))}
                </div>
              )}

              {/* Macros row + suggested pills */}
              <ComposerMacros
                macros={macros}
                aiMacros={aiMacros}
                customerName={extractName(selectedThread?.from || "")}
                onInsert={(body) => {
                  if (composerRef.current) {
                    composerRef.current.innerHTML = body.replace(/\n/g, "<br>");
                    setReply(composerRef.current.textContent);
                  } else setReply(body);
                  setTimeout(() => composerRef.current?.focus(), 10);
                }}
              />

              {/* Toolbar + Send buttons */}
              <ComposerToolbar
                onFormatDoc={formatDoc}
                onInsertLink={insertLink}
                onImageUpload={() => imgUploadRef.current?.click()}
                onFileAttach={() => fileUploadRef.current?.click()}
                onInsertEmoji={insertEmoji}
                onAiReply={() => void handleAiReply()}
                onSend={() => void handleSend()}
                onSendResolve={() => void handleSendResolve()}
                hasMessages={messages.length > 0}
                disabled={isSuspended || !canReply}
              />
            </div>
          </>
        )}
      </div>

      {/* Refund reason picker modal */}
      {showReasonPicker && pendingResolveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl border border-border p-6 w-[360px] shadow-lg">
            <h3 className="text-sm font-semibold text-foreground mb-1">Resolve conversation</h3>
            <p className="text-xs text-muted-foreground mb-4">Was this related to a refund?</p>
            <div className="flex flex-col gap-1.5 mb-4">
              {REFUND_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => void handleResolveWithReason(r.value)}
                  className="text-left px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void handleResolveWithReason(null)}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Skip — not a refund
              </button>
              <button
                onClick={() => {
                  setShowReasonPicker(false);
                  setPendingResolveId(null);
                  setPendingNextThreadId(undefined);
                }}
                className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
