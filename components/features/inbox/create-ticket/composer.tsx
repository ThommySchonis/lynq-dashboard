"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, X, Plus, Send, Link as LinkIcon, List, Mail, AlertCircle, Clock, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ConversationAssignMenu } from "@/components/features/inbox/conversation-assign-menu";
import { TicketMetaStrip } from "@/components/features/inbox/ticket-meta-strip";
import { useComposeMacros, useInboxMembers } from "@/hooks/inbox/use-inbox-data";
import { plainTextToSafeHtml, normalizeSafeUrl } from "@/lib/inbox-utils";
import { FALLBACK_MACROS, PRIORITY_OPTS, type ComposeMacro } from "@/lib/inbox-create-constants";
import type { CreateTicketForm } from "@/hooks/inbox/use-create-ticket";

interface CreateTicketComposerProps {
  form: CreateTicketForm;
}

// Shared recipe for the inline field labels (TO/FROM/CC/BCC) and bare inputs.
const FIELD_LABEL = "shrink-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const FIELD_INPUT = "min-w-0 flex-1 border-none bg-transparent text-[14px] text-foreground shadow-none placeholder:text-muted-foreground";

/** Center column — subject header, empty-state, and the outgoing-email composer
 *  (To / From / Cc / Bcc, macros, rich-text body, Send / Send & Close). */
export function CreateTicketComposer({ form }: CreateTicketComposerProps) {
  const {
    to,
    setTo,
    subject,
    setSubject,
    cc,
    setCc,
    bcc,
    setBcc,
    showCC,
    setShowCC,
    priority,
    setPriority,
    assignedTo,
    setAssignedTo,
    accountInfo,
    contactReason,
    setContactReason,
    product,
    setProduct,
    resolution,
    setResolution,
    setTags,
    send,
    isSending,
    goBack,
  } = form;

  function addMetaTag() {
    const t = prompt("Tag name")?.trim();
    if (t) setTags((p) => [...new Set([...p, t])]);
  }

  const { data: fetchedMacros } = useComposeMacros();
  const { data: members = [] } = useInboxMembers();
  const [body, setBody] = useState("");
  const [macroSearch, setMacroSearch] = useState("");
  const [showMacroDD, setShowMacroDD] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Composer re-renders on every body keystroke; memoize so the macro list isn't
  // re-filtered each time unless its inputs actually change.
  const liveMacros = useMemo(() => {
    const all = (fetchedMacros?.length ? fetchedMacros : FALLBACK_MACROS) as ComposeMacro[];
    return all.filter((m) => !m.archived);
  }, [fetchedMacros]);
  const suggested = useMemo(() => liveMacros.slice(0, 5), [liveMacros]);
  const macroHits = useMemo(
    () =>
      macroSearch
        ? liveMacros.filter((m) => `${m.name}${m.body || ""}${(m.tags || []).join(" ")}`.toLowerCase().includes(macroSearch.toLowerCase())).slice(0, 8)
        : [],
    [liveMacros, macroSearch],
  );

  useEffect(() => {
    const timer = setTimeout(() => bodyRef.current?.focus(), 160);
    return () => clearTimeout(timer);
  }, []);

  // Rich text via execCommand (tech debt, matches the rest of the inbox composer).
  const fmt = useCallback((cmd: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, undefined);
  }, []);

  const insertLink = useCallback(() => {
    const url = normalizeSafeUrl(prompt("URL:"));
    if (!url) {
      toast.error("Only http, https, or mailto links are allowed");
      return;
    }
    bodyRef.current?.focus();
    document.execCommand("createLink", false, url);
  }, []);

  function applyMacro(m: ComposeMacro) {
    if (!bodyRef.current) return;
    bodyRef.current.innerHTML = plainTextToSafeHtml(m.body || "");
    setBody(m.body || "");
    setMacroSearch("");
    setShowMacroDD(false);
    bodyRef.current.focus();
  }

  function doSend() {
    void send(bodyRef.current?.innerHTML || "", bodyRef.current?.innerText || "");
  }

  return (
    <div className="relative z-[1] flex flex-1 flex-col overflow-hidden bg-card dark:bg-[#160c35]">
      {/* Subject header — subject + priority + assignee chips (Figma) */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold text-foreground shadow-none placeholder:text-muted-foreground"
        />
        {/* Priority — persisted into conversation metadata in the two-step follow-up */}
        <Select
          value={priority}
          onValueChange={(v) => {
            if (v) setPriority(v);
          }}
        >
          <SelectTrigger size="sm" className="shrink-0 text-[11.5px] capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Assignee — persisted via bulk assign in the two-step follow-up */}
        <ConversationAssignMenu assignedTo={assignedTo} members={members} onAssign={(id) => setAssignedTo(id || null)} />
        <Button variant="ghost" size="icon-xs" onClick={goBack} title="Close (Esc)" className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-[15px] w-[15px]" />
        </Button>
      </div>

      {/* Meta strip — Add tags / Contact reason / Product / Resolution (Figma 301:3447) */}
      <TicketMetaStrip
        contactReason={contactReason}
        product={product}
        resolution={resolution}
        onSetContactReason={setContactReason}
        onSetProduct={setProduct}
        onSetResolution={setResolution}
        onAddTag={addMetaTag}
      />

      {/* Thread area (empty state) — Figma 1372:68435: 440px card, 28×40 padding,
          8px gap, 16px radius, on the white compose column */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-0 py-10">
        <div className="flex w-[440px] flex-col items-center gap-2 rounded-2xl border border-border bg-card px-10 py-7 text-center dark:bg-[#160c35]">
          <Send className="h-7 w-7 text-muted-foreground" />
          <div className="text-base font-semibold text-foreground">New outgoing email</div>
          <div className="text-sm text-muted-foreground">
            Fill in the To field and write your message below. When the customer replies, the thread appears here automatically.
          </div>
        </div>
      </div>

      {/* Compose bottom — Figma 782:25968: 16×24 padding, 14px gap, single
          padded column (no per-row borders) */}
      <div className="flex shrink-0 flex-col gap-[14px] border-t border-border bg-card px-6 py-4 dark:bg-[#120931]">
        {/* TO */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className={FIELD_LABEL}>TO</span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@email.com"
              autoFocus
              className={FIELD_INPUT}
            />
          </div>
          <button onClick={() => setShowCC((v) => !v)} className="shrink-0 text-[14px] font-semibold text-(--accent-text) transition-opacity hover:opacity-80">
            Cc / Bcc
          </button>
        </div>

        {/* CC + BCC */}
        {showCC && (
          <div className="flex items-center gap-3">
            <span className={FIELD_LABEL}>CC</span>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@email.com"
              className={FIELD_INPUT}
            />
            <span className={FIELD_LABEL}>BCC</span>
            <Input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="bcc@email.com"
              className={FIELD_INPUT}
            />
          </div>
        )}

        {/* FROM */}
        {accountInfo?.email && (
          <div className="flex items-center gap-3">
            <span className={FIELD_LABEL}>FROM</span>
            <Mail className="h-[15px] w-[15px] text-muted-foreground" />
            <span className="text-[14px] text-foreground">{accountInfo.email}</span>
          </div>
        )}

        {/* Demo mode warning */}
        {!accountInfo?.connected && (
          <div className="flex items-center gap-[7px] rounded-[10px] bg-amber-500/5 px-3 py-2 dark:bg-amber-400/[0.06]">
            <AlertCircle className="h-[11px] w-[11px] shrink-0 text-amber-600" />
            <span className="text-[11.5px] text-amber-600">
              Demo mode &mdash;{" "}
              <Link href="/settings/integrations/email" className="font-semibold text-foreground no-underline">
                connect Gmail or Outlook
              </Link>{" "}
              in Settings to send real emails
            </span>
          </div>
        )}

        {/* divider */}
        <div className="h-px w-full bg-border" />

        {/* Macro search — lavender bordered box (Figma) */}
        <div className="relative flex items-center gap-2 rounded-[10px] border border-border bg-secondary px-3.5 py-[11px]">
          <Plus className="h-4 w-4 shrink-0 text-(--accent-text)" />
          <Input
            value={macroSearch}
            onChange={(e) => {
              setMacroSearch(e.target.value);
              setShowMacroDD(true);
            }}
            onFocus={() => setShowMacroDD(true)}
            onBlur={() => setTimeout(() => setShowMacroDD(false), 160)}
            placeholder="Search macros by name, tags or body…"
            className={FIELD_INPUT}
          />
          {macroSearch && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setMacroSearch("");
                setShowMacroDD(false);
              }}
              className="flex text-muted-foreground"
            >
              <X className="h-[11px] w-[11px]" />
            </button>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />

          {showMacroDD && macroHits.length > 0 && (
            <div className="absolute bottom-[calc(100%+4px)] left-0 right-0 z-[60] max-h-[220px] animate-[fadeUp_0.14s_ease_both] overflow-y-auto rounded-[10px] border border-border bg-card p-1 shadow-[0_-12px_32px_rgba(0,0,0,0.1)] dark:bg-[#1a0b3d] dark:shadow-[0_-12px_32px_rgba(0,0,0,0.4)]">
              {macroHits.map((m) => (
                <button
                  key={m.id}
                  className="block w-full cursor-pointer rounded-[7px] border-none bg-none px-[11px] py-2 text-left transition-colors hover:bg-secondary"
                  onMouseDown={() => applyMacro(m)}
                >
                  <div className="text-[12.5px] font-semibold text-foreground">{m.name}</div>
                  <div className="mt-px truncate text-[11.5px] text-foreground-2">{m.body?.replace(/\n/g, " ")}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body (contenteditable rich text editor — tech debt) */}
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Type your message here… or pick a macro above."
          onInput={(e) => setBody(e.currentTarget.textContent || "")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) doSend();
          }}
          className="min-h-[60px] w-full resize-none overflow-y-auto border-none bg-transparent text-[14px] leading-[1.6] text-foreground outline-none empty:before:pointer-events-none empty:before:block empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        />

        {/* Suggested macros */}
        {!body && suggested.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <Clock className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
            <span className="text-[14px] font-medium text-muted-foreground">Suggested macros</span>
            {suggested.map((m) => (
              <button
                key={m.id}
                onClick={() => applyMacro(m)}
                className="rounded-full border border-border bg-secondary px-3 py-[7px] text-[12px] font-semibold text-muted-foreground transition-colors hover:border-(--border-hover) hover:text-foreground"
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar row — formatting (left) + actions (right) */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3.5 text-muted-foreground">
              <button
                className="text-[14px] font-bold transition-colors hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fmt("bold")}
                title="Bold"
              >
                B
              </button>
              <button
                className="text-[14px] font-bold italic transition-colors hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fmt("italic")}
                title="Italic"
              >
                I
              </button>
              <button
                className="text-[14px] font-bold underline transition-colors hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fmt("underline")}
                title="Underline"
              >
                U
              </button>
              <button className="transition-colors hover:text-foreground" onMouseDown={(e) => e.preventDefault()} onClick={insertLink} title="Link">
                <LinkIcon className="h-4 w-4" />
              </button>
              <button
                className="transition-colors hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fmt("insertUnorderedList")}
                title="Bullet list"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {/* vertical divider after the formatting tools (Figma 1×20) */}
            <div className="h-5 w-px bg-border" />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="text-[12px] text-muted-foreground">Cmd+Enter to send</span>
            {/* AI Reply — lavender chip (Figma). Needs an inbound customer message,
                which a brand-new ticket lacks, so it guides the user until reply. */}
            <button
              onClick={() => toast.info("AI Reply becomes available once the customer replies.")}
              className="flex items-center gap-2 rounded-[10px] border border-(--accent-border) bg-(--accent-soft) py-2.5 pl-3.5 pr-4 text-[14px] font-semibold text-(--accent-text)"
            >
              <Sparkles className="h-4 w-4" />
              AI Reply
            </button>
            {/* Send — solid dark; Send & Close — foreground outline (Figma) */}
            <Button
              onClick={doSend}
              disabled={isSending}
              className="h-auto gap-1.5 rounded-[10px] bg-foreground px-6 py-[15px] text-[14px] font-semibold text-background hover:opacity-90"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-[11px] w-[11px] animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-[11px] w-[11px]" />
                  Send
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={doSend}
              disabled={isSending}
              className="h-auto rounded-[10px] border-foreground bg-card px-6 py-[15px] text-[14px] font-semibold text-foreground hover:bg-secondary"
            >
              Send &amp; Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
