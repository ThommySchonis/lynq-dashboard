"use client";

import type { Thread, ConversationTag } from "@/types/inbox";
import { MacroPanel } from "@/components/features/inbox/macro-panel";
import { TicketActionBar } from "@/components/features/inbox/ticket-action-bar";
import { MessageList } from "@/components/features/inbox/message-list";
import { NotesSection } from "@/components/features/inbox/notes-section";
import { AttachmentBar } from "@/components/features/inbox/attachment-bar";
import { ComposerToolbar } from "@/components/features/inbox/composer-toolbar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { STATUS } from "@/lib/inbox-constants";
import { extractEmail, extractName, plainTextToSafeHtml, sanitizeHtml } from "@/lib/inbox-utils";
import { ChevronDown, Globe, Mail, Radio, X, Zap } from "lucide-react";
import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { useInboxUI } from "@/stores/inbox-ui";
import { useAuthStore } from "@/stores/auth";
import { useAIStore } from "@/stores/ai";
import { useMacrosStore } from "@/stores/macros";
import { useTicketMetaStore } from "@/stores/ticket-meta";
import { useConversations, useConversation, inboxKeys } from "@/hooks/inbox/use-inbox-data";
import { useSendReply, useUpdateStatus, useTranslateMessage, useBulkConversationAction, useAddNote } from "@/hooks/inbox/use-inbox-mutations";
import { useTags, useCreateTag } from "@/hooks/inbox/use-tags";
import { useComposerActions } from "@/hooks/inbox/use-composer-actions";
import { usePermissions } from "@/hooks/use-permissions";
import { useQueryClient } from "@tanstack/react-query";
import { EmmaSuggestionCard } from "./emma-suggestion-card";
import { usePendingDraft, useUpdateDraftStatus } from "@/hooks/ai";
import type { FeedbackCategory } from "@/types/ai-drafts";

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

  // AI state
  const queryClient = useQueryClient();
  const aiLoading = useAIStore((s) => s.aiLoading);
  const setAutoTranslate = useAIStore((s) => s.setAutoTranslate);
  const generateReply = useAIStore((s) => s.generateReply);

  // Draft workflow
  const editingDraftId = useInboxUI((s) => s.editingDraftId);
  const setEditingDraftId = useInboxUI((s) => s.setEditingDraftId);
  const { data: pendingDraft, isFetched: draftFetched } = usePendingDraft(selectedThreadId);
  const updateDraft = useUpdateDraftStatus(selectedThreadId ?? "");
  const autoTriggeredRef = useRef<string | null>(null);

  // Macros
  const macros = useMacrosStore((s) => s.macros);
  const aiMacros = useMacrosStore((s) => s.aiMacros);
  const macroFavs = useMacrosStore((s) => s.favs);
  const toggleMacroFav = useMacrosStore((s) => s.toggleFav);
  const deleteMacro = useMacrosStore((s) => s.deleteMacro);

  // Ticket meta
  const getTicketMeta = useTicketMetaStore((s) => s.getMeta);
  const updateMeta = useTicketMetaStore((s) => s.updateMeta);

  // TanStack data
  const { data: threads = [] } = useConversations(activeFolder, search);
  const { data: conversationData } = useConversation(selectedThreadId);
  const messages = useMemo(() => conversationData?.messages || [], [conversationData?.messages]);
  const conversationTags = (conversationData?.tags ?? []) as ConversationTag[];

  const selectedThread = useMemo(() => threads.find((t: Thread) => t.id === selectedThreadId) || null, [threads, selectedThreadId]);

  // Tag DB hooks
  const bulkAction = useBulkConversationAction();
  const { data: allTags = [] } = useTags();
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

  // Auto-generate AI reply when opening a conversation with a new inbound message
  useEffect(() => {
    if (
      !selectedThreadId ||
      !selectedThread?.store_id ||
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
  }, [selectedThreadId, selectedThread, messages, draftFetched, pendingDraft, aiLoading, generateReply, token]);

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

  function updateTicketField(id: string, key: string, label: string) {
    const value = prompt(`${label}:`);
    if (value === null) return;
    updateMeta(id, { [key]: value.trim() });
  }

  // Sorted threads for send & resolve navigation
  const sortedFiltered = useMemo(() => threads, [threads]);

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

  // Draft workflow actions
  async function handleDraftApprove() {
    if (!pendingDraft || !selectedThreadId) return;
    try {
      await sendReplyMutation.mutateAsync({
        threadId: selectedThreadId,
        bodyHtml: plainTextToSafeHtml(pendingDraft.suggested_text),
        bodyText: pendingDraft.suggested_text,
      });
      await updateDraft.mutateAsync({
        draftId: pendingDraft.id,
        status: "approved",
      });
      sonnerToast.success("Reply sent");
    } catch {
      sonnerToast.error("Failed to send reply");
    }
  }

  function handleDraftEdit() {
    if (!pendingDraft || !composerRef.current) return;
    composerRef.current.innerHTML = plainTextToSafeHtml(pendingDraft.suggested_text);
    setReply(composerRef.current.textContent ?? "");
    setEditingDraftId(pendingDraft.id);
  }

  async function handleDraftDecline(category: FeedbackCategory, comment?: string) {
    if (!pendingDraft) return;
    await updateDraft.mutateAsync({
      draftId: pendingDraft.id,
      status: "declined",
      feedbackCategory: category,
      feedbackComment: comment,
    });
    sonnerToast.success("Suggestion declined");
  }

  async function handleDraftRegenerate() {
    if (!pendingDraft || !selectedThread) return;
    await updateDraft.mutateAsync({
      draftId: pendingDraft.id,
      status: "regenerated",
    });
    await generateReply(selectedThread, messages, token);
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
      {/* Ticket header */}
      <div className="py-3.5 px-[22px] border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3.5">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap mb-0.5 tracking-[-0.01em]">
              {selectedThread.subject}
            </div>
            <div className="text-[11.5px] text-muted-foreground">
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
                      background: STATUS[getStatus(selectedThread.id) as keyof typeof STATUS]?.bg,
                      border: `1px solid ${STATUS[getStatus(selectedThread.id) as keyof typeof STATUS]?.border}`,
                      color: STATUS[getStatus(selectedThread.id) as keyof typeof STATUS]?.color,
                    }}
                  />
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: STATUS[getStatus(selectedThread.id) as keyof typeof STATUS]?.color,
                  }}
                />
                {STATUS[getStatus(selectedThread.id) as keyof typeof STATUS]?.label}
                <ChevronDown size={11} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.entries(STATUS).map(([k, s]) => (
                  <DropdownMenuItem
                    key={k}
                    onClick={isSuspended ? undefined : () => void saveStatus(selectedThread.id, k)}
                    disabled={isSuspended}
                    style={{ color: s.color }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    {s.label}
                    {getStatus(selectedThread.id) === k && <span className="ml-auto text-[10px] text-muted-foreground">&#10003;</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <TicketActionBar
          meta={getTicketMeta(selectedThread.id)}
          tags={conversationTags}
          status={getStatus(selectedThread.id)}
          onClose={() => void saveStatus(selectedThread.id, "closed")}
          onAddTag={() => {
            const name = window.prompt("Tag name");
            if (name) void handleAddTag(name);
          }}
          onRemoveTag={(tag) => void handleRemoveTag(tag)}
          onFieldChange={(field, labelOrValue) =>
            field === "tier" ? updateMeta(selectedThread.id, { tier: labelOrValue }) : updateTicketField(selectedThread.id, field, labelOrValue)
          }
          assignedTo={null}
          onAssign={() => {}}
          members={[]}
        />
      </div>

      {/* Messages + Notes + Note input */}
      <div className="thin-scrollbar conv-area flex-1 overflow-y-auto px-6 py-5 bg-[#FAFAFA]">
        <MessageList msgEndRef={msgEndRef} />
        <NotesSection />
      </div>

      {/* Emma suggestion card */}
      {pendingDraft && pendingDraft.status === "pending" && (
        <EmmaSuggestionCard
          draft={pendingDraft}
          onApprove={() => void handleDraftApprove()}
          onEdit={handleDraftEdit}
          onDecline={(cat, comment) => void handleDraftDecline(cat, comment)}
          onRegenerate={() => void handleDraftRegenerate()}
          isApproving={sendReplyMutation.isPending}
          isDeclining={updateDraft.isPending}
          isRegenerating={updateDraft.isPending}
        />
      )}

      {/* Composer */}
      <div className="border-t border-border shrink-0 bg-card">
        {/* Macro panel */}
        {showMacros && (
          <MacroPanel
            macros={macros.filter((m) => !m.archived)}
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
            onDeleteMacro={deleteMacro}
          />
        )}

        {/* Composer */}
        {!showMacros && (
          <>
            {/* Tab strip */}
            <div className="flex border-b border-border pl-4">
              {[
                { id: "reply", label: "Reply" },
                { id: "note", label: "Internal note" },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`py-[9px] px-4 bg-transparent cursor-pointer text-[13px] font-medium font-inherit border-b-2 border-b-transparent transition-[color,border-color] duration-150 text-foreground-3 ${composerTab === t.id ? "text-foreground border-b-foreground font-semibold" : "hover:text-foreground-2"}`}
                  onClick={() => setComposerTab(t.id as "reply" | "note")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* To: row */}
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

            {/* Macro search row */}
            <div
              className="flex items-center gap-2 px-3.5 py-[7px] border-b border-border cursor-pointer transition-[background] duration-[120ms] hover:bg-secondary"
              onClick={() => setShowMacros(true)}
            >
              <span className="text-muted-foreground flex shrink-0">
                <Zap size={13} />
              </span>
              <span className="flex-1 text-xs text-muted-foreground">Search macros by name, tags or body...</span>
              {aiMacros.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-px rounded bg-secondary text-foreground-2 tracking-[.04em] shrink-0 border border-border">
                  AI
                </span>
              )}
              <ChevronDown size={11} className="text-muted-foreground shrink-0" />
            </div>

            {/* Hidden file inputs */}
            <input ref={imgUploadRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <input ref={fileUploadRef} type="file" multiple className="hidden" onChange={handleFileAttach} />

            {/* Flat compose area */}
            <div className="bg-card dark:bg-[rgba(255,255,255,0.025)]" onClick={() => showEmoji && setShowEmoji(false)}>
              {/* Auto-translate banner */}
              {autoTranslate && customerLang && customerLang.code !== "en" && (
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

              {/* Attachments */}
              <AttachmentBar />

              {/* View-only hint */}
              {!canReply && <p className="px-4 py-2 text-xs text-muted-foreground">View-only access — you cannot reply to tickets.</p>}

              {/* Contenteditable composer */}
              <div
                ref={composerRef}
                contentEditable={canReply}
                suppressContentEditableWarning
                data-placeholder={composerTab === "reply" ? "Click here to reply, or press r." : "Internal note — not visible to customer…"}
                onInput={(e) => setReply(e.currentTarget.textContent)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSend();
                }}
                className={`compose-ta w-full resize-none outline-none bg-transparent px-4 py-3 text-sm text-foreground leading-relaxed min-h-[90px] tracking-[.005em] min-h-[150px] ${composerTab === "note" ? "bg-[rgba(251,191,36,0.03)]" : "bg-transparent"} ${!canReply ? "opacity-50 cursor-not-allowed" : ""}`}
              />

              {/* AI generating dots */}
              {aiLoading && (
                <div className="pt-1 px-4 pb-0 flex items-center gap-1">
                  {[0, 0.18, 0.36].map((d) => (
                    <span
                      key={d}
                      className="w-[5px] h-[5px] rounded-full bg-foreground-3 block"
                      style={{ animation: `glowPulse .9s ease-in-out ${d}s infinite` }}
                    />
                  ))}
                </div>
              )}

              {/* Suggested macros */}
              {(aiMacros.length > 0 || macros.length > 0) && (
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 border-t border-border flex-wrap">
                  <Radio size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-[10.5px] text-foreground-2 font-semibold shrink-0">Suggested macros</span>
                  {(aiMacros.length > 0 ? aiMacros : macros).slice(0, 3).map((m) => {
                    const firstName = extractName(selectedThread?.from || "").split(" ")[0] || "there";
                    const body = (m.body || "").replace(/{{name}}/gi, firstName).replace(/{{firstname}}/gi, firstName);
                    return (
                      <button
                        key={m.id}
                        className="inline-flex items-center text-xs font-medium px-2.5 py-[3px] rounded-[5px] border border-black/[0.08] bg-secondary text-foreground-2 cursor-pointer transition-all hover:border-(--border-hover) hover:text-foreground"
                        onClick={() => {
                          if (composerRef.current) {
                            composerRef.current.innerHTML = body.replace(/\n/g, "<br>");
                            setReply(composerRef.current.textContent);
                          } else setReply(body);
                          setTimeout(() => composerRef.current?.focus(), 10);
                        }}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              )}

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
