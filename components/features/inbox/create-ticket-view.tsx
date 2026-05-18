'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link2,
  List,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
  Zap,
} from 'lucide-react'
import { authFetch, normalizeSafeUrl, plainTextToSafeHtml, sanitizeHtml } from '@/lib/inbox-utils'
import { parseJson } from '@/lib/utils/typed-json'

interface ComposeResponse {
  success?: boolean
  id?: string
  conversationId?: string
  error?: string
}

interface TicketMacro {
  id: string
  name: string
  body: string
  tags?: string[]
  archived?: boolean
  [key: string]: unknown
}

export function CreateTicketView({ token, connectedEmail, onClose, onSuccess, macros = [] }: {
  token: string;
  connectedEmail?: string | null;
  onClose: () => void;
  onSuccess: (msg: string, type?: string) => void;
  macros?: TicketMacro[];
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [cc, setCC] = useState("");
  const [bcc, setBcc] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [macroSearch, setMacroSearch] = useState("");
  const [showMacroDD, setShowMacroDD] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const macroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function h(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => {
    setTimeout(() => bodyRef.current?.focus(), 150);
  }, []);

  function fmt(cmd: string, val?: string) {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, val || undefined);
  }
  function insertLink() {
    const url = normalizeSafeUrl(prompt("URL:"));
    if (!url) {
      onSuccess("Only http, https, or mailto links are allowed", "error");
      return;
    }
    fmt("createLink", url);
  }
  function applyMacro(m: TicketMacro) {
    if (!bodyRef.current) return;
    bodyRef.current.innerHTML = plainTextToSafeHtml(m.body);
    setBody(m.body);
    setMacroSearch("");
    setShowMacroDD(false);
    bodyRef.current?.focus();
  }

  async function doSend() {
    if (!to.trim()) {
      onSuccess("Please enter a recipient", "error");
      return;
    }
    setSending(true);
    const safeBody = sanitizeHtml(bodyRef.current?.innerHTML || "");
    const res = await authFetch(
      "/api/inbox/compose",
      {
        method: "POST",
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          bodyHtml: safeBody,
          bodyText: bodyRef.current?.textContent || "",
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
        }),
      },
      token,
    );
    const data = await parseJson<ComposeResponse>(res);
    setSending(false);
    if (data.success || data.id || data.conversationId) {
      onSuccess("Message sent!");
      onClose();
    } else onSuccess(data.error || "Failed to send", "error");
  }

  const liveMacros = Array.isArray(macros) ? macros.filter((m) => !m.archived) : [];
  const macroHits = macroSearch
    ? liveMacros.filter((m) => (m.name + m.body + (m.tags || []).join(" ")).toLowerCase().includes(macroSearch.toLowerCase())).slice(0, 8)
    : [];
  const suggested = liveMacros.slice(0, 5);

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-l border-border bg-card relative z-[1]">
      {/* ── Top bar: Subject + controls ── */}
      <div className="border-b border-border shrink-0">
        {/* Row 1 */}
        <div className="flex items-center px-3.5 py-2.5 gap-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-foreground font-[inherit] min-w-0"
          />
          {/* Priority */}
          <div className="flex items-center gap-1 px-[9px] py-[3px] rounded-md border border-border text-[11.5px] text-foreground-2 cursor-default whitespace-nowrap shrink-0">
            <Zap size={9} />
            normal
          </div>
          {/* Prev/Next */}
          <button className="bg-none border border-border rounded-md px-[7px] py-1 cursor-pointer text-foreground-2 flex shrink-0" title="Previous">
            <ChevronLeft size={11} />
          </button>
          <button className="bg-none border border-border rounded-md px-[7px] py-1 cursor-pointer text-foreground-2 flex shrink-0" title="Next">
            <ChevronRight size={11} />
          </button>
          {/* Customer search */}
          <div className="flex items-center gap-1.5 bg-input border border-border rounded-lg px-2.5 py-[5px] w-60 shrink-0">
            <Search size={11} className="text-muted-foreground" />
            <input
              placeholder="Search customers by email, order..."
              className="bg-transparent border-none outline-none text-[11.5px] text-foreground font-[inherit] w-full"
            />
          </div>
          {/* Settings */}
          <button className="bg-none border border-border rounded-md px-[7px] py-[5px] cursor-pointer text-foreground-2 flex shrink-0" title="Settings">
            <Settings size={15} />
          </button>
          {/* Unassigned */}
          <button className="flex items-center gap-[5px] px-2.5 py-1 bg-input border border-border rounded-[7px] text-[11.5px] text-foreground-2 cursor-pointer font-[inherit] whitespace-nowrap shrink-0">
            Unassigned
            <ChevronDown size={10} />
          </button>
          {/* Close */}
          <button onClick={onClose} className="bg-none border-none cursor-pointer text-muted-foreground p-1 flex shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Row 2: Tags + metadata */}
        <div className="flex items-center px-3.5 py-1.5 gap-3.5 text-xs text-foreground-2 border-t border-border flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 bg-input border border-border rounded-[5px] px-[7px] py-[1px] text-[11.5px] text-foreground"
              >
                {t}
                <button
                  onClick={() => setTags((p) => p.filter((x) => x !== t))}
                  className="bg-none border-none cursor-pointer text-muted-foreground p-0 leading-none flex"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
            <button
              onClick={() => setShowTagInput((v) => !v)}
              className="inline-flex items-center gap-[3px] bg-none border-none cursor-pointer text-foreground-2 text-[11.5px] font-[inherit] p-0"
            >
              <Plus size={10} />
              Add tags
            </button>
            {showTagInput && (
              <input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                    setTags((p) => [...new Set([...p, tagInput.trim()])]);
                    setTagInput("");
                    if (e.key === ",") e.preventDefault();
                  }
                  if (e.key === "Escape") setShowTagInput(false);
                }}
                placeholder="tag name…"
                className="bg-transparent border-none border-b border-b-(--border-hover) outline-none text-[11.5px] text-foreground font-[inherit] w-[84px]"
              />
            )}
          </div>
          <div className="w-px h-[13px] bg-(--border) shrink-0" />
          <span>
            Contact reason: <button className="text-foreground-2 bg-none border-none cursor-pointer font-[inherit] text-xs p-0">+Add</button>
          </span>
          <div className="w-px h-[13px] bg-(--border) shrink-0" />
          <span>
            Product: <button className="text-foreground-2 bg-none border-none cursor-pointer font-[inherit] text-xs p-0">+Add</button>
          </span>
          <div className="w-px h-[13px] bg-(--border) shrink-0" />
          <span>
            Resolution: <button className="text-foreground-2 bg-none border-none cursor-pointer font-[inherit] text-xs p-0">+Add</button>
          </span>
        </div>
      </div>

      {/* ── Empty thread area ── */}
      <div className="flex-1 overflow-y-auto min-h-5" />

      {/* ── Bottom compose section ── */}
      <div className="border-t border-border shrink-0">
        {/* To row */}
        <div className="flex items-center px-3.5 py-2 border-b border-border gap-2">
          <span className="text-[10.5px] font-bold text-muted-foreground tracking-[.08em] uppercase w-[38px] shrink-0">To</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Search customers..."
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-foreground font-[inherit]"
          />
          <button
            onClick={() => setShowCC((v) => !v)}
            className={`text-[10.5px] font-semibold border border-border rounded-[5px] px-[9px] py-[2px] cursor-pointer font-[inherit] shrink-0 transition-all ${showCC ? "text-foreground bg-secondary" : "text-muted-foreground bg-none"}`}
          >
            Cc / Bcc
          </button>
        </div>

        {/* From row */}
        {connectedEmail && (
          <div className="flex items-center px-3.5 py-2 border-b border-border gap-2">
            <span className="text-[10.5px] font-bold text-muted-foreground tracking-[.08em] uppercase w-[38px] shrink-0">From</span>
            <span className="text-[13px] text-foreground-2">{connectedEmail}</span>
          </div>
        )}

        {/* CC + Bcc row */}
        {showCC && (
          <div className="flex items-center px-3.5 py-2 border-b border-border gap-2 bg-input">
            <span className="text-[10.5px] font-bold text-muted-foreground tracking-[.08em] uppercase w-[38px] shrink-0">CC</span>
            <input
              value={cc}
              onChange={(e) => setCC(e.target.value)}
              placeholder="cc@email.com"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-foreground font-[inherit]"
            />
            <span className="text-[10.5px] font-bold text-muted-foreground tracking-[.08em] uppercase w-[38px] shrink-0">BCC</span>
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="bcc@email.com"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-foreground font-[inherit]"
            />
          </div>
        )}

        {/* Macro search row */}
        <div className="flex items-center px-3.5 py-[7px] border-b border-border gap-2 relative">
          <Plus size={13} className="text-muted-foreground" />
          <input
            ref={macroRef}
            value={macroSearch}
            onChange={(e) => {
              setMacroSearch(e.target.value);
              setShowMacroDD(true);
            }}
            onFocus={() => setShowMacroDD(true)}
            onBlur={() => setTimeout(() => setShowMacroDD(false), 160)}
            placeholder="Search macros by name, tags or body..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-foreground font-[inherit]"
          />
          {macroSearch && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setMacroSearch("");
                setShowMacroDD(false);
              }}
              className="bg-none border-none cursor-pointer text-muted-foreground p-[2px] flex"
            >
              <X size={11} />
            </button>
          )}
          <ChevronDown size={11} className="text-muted-foreground" />
          {showMacroDD && macroHits.length > 0 && (
            <div className="absolute bottom-[calc(100%+3px)] left-0 right-0 bg-card border border-border rounded-xl shadow-[0_-8px_24px_rgba(0,0,0,0.1)] z-[60] max-h-[220px] overflow-y-auto p-1">
              {macroHits.map((m) => (
                <button
                  key={m.id}
                  onMouseDown={() => applyMacro(m)}
                  className="block w-full text-left px-[11px] py-2 bg-none border-none cursor-pointer rounded-[7px] font-[inherit] transition-[background] duration-100 hover:bg-input"
                >
                  <div className="text-[12.5px] font-semibold text-foreground">{m.name}</div>
                  <div className="text-[11.5px] text-foreground-2 overflow-hidden text-ellipsis whitespace-nowrap mt-px">{m.body?.replace(/\n/g, " ")}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rich text body */}
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Click here to reply, or press r."
          onInput={(e) => setBody(e.currentTarget.textContent)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void doSend();
          }}
          className="compose-ta w-full resize-none outline-none bg-transparent px-4 py-3 text-sm text-foreground leading-relaxed min-h-[90px] tracking-[.005em] min-h-[130px] px-4 py-3 text-[13.5px] leading-[1.75] overflow-y-auto"
        />

        {/* Suggested macros */}
        {!body && suggested.length > 0 && (
          <div className="px-3.5 pt-[7px] pb-2 border-t border-border flex items-center gap-[7px] flex-wrap">
            <Clock size={11} className="text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">Suggested macros</span>
            {suggested.map((m) => (
              <button
                key={m.id}
                onClick={() => applyMacro(m)}
                className="px-2.5 py-[2px] bg-input border border-border rounded-full text-[11.5px] text-foreground cursor-pointer font-[inherit] transition-[border-color] hover:border-(--border-hover)"
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar + Send buttons */}
        <div className="flex items-center px-3 py-[7px] border-t border-border gap-[3px]">
          <button className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground font-bold min-w-[26px] text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("bold")} title="Bold">
            B
          </button>
          <button className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground italic min-w-[26px] text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("italic")} title="Italic">
            I
          </button>
          <button
            className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground underline min-w-[26px] text-xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fmt("underline")}
            title="Underline"
          >
            U
          </button>
          <div className="w-px h-3.5 bg-(--border) mx-[3px]" />
          <button className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground" onMouseDown={(e) => e.preventDefault()} onClick={insertLink} title="Link">
            <Link2 size={12} />
          </button>
          <button className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("insertUnorderedList")} title="Bullet list">
            <List size={12} />
          </button>
          <div className="flex-1" />
          {/* Send button group */}
          <div className="flex items-stretch rounded-[9px] overflow-hidden gap-px shrink-0">
            <button
              onClick={() => void doSend()}
              disabled={sending}
              className={`flex items-center gap-1.5 px-4 py-[7px] bg-foreground text-white border-none text-[12.5px] font-semibold font-[inherit] transition-[background] ${sending ? "cursor-not-allowed opacity-70" : "cursor-pointer opacity-100"}`}
            >
              {sending ? (
                <>
                  <RefreshCw size={11} className="animate-spin" />
                  Sending…
                </>
              ) : (
                <>Send</>
              )}
            </button>
            <div className="w-px bg-white/15 shrink-0" />
            <button
              onClick={() => void doSend()}
              disabled={sending}
              className={`flex items-center gap-[5px] px-4 py-[7px] bg-foreground text-white border-none text-[12.5px] font-semibold font-[inherit] transition-[background] whitespace-nowrap ${sending ? "cursor-not-allowed opacity-70" : "cursor-pointer opacity-100"}`}
            >
              Send &amp; Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
