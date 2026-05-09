"use client";

import { Avatar as ShadAvatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast as sonnerToast } from "sonner";
import {
  Archive,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  ImageIcon,
  LayoutGrid,
  Link2,
  List,
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
  Settings,
  Smile,
  SquarePen,
  Star,
  Trash2,
  Truck,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  authFetch,
  CANCEL_REASONS,
  EMOJIS,
  extractEmail,
  extractName,
  fmtPrice,
  relTime as formatDate,
  plainTextToSafeHtml,
  REFUND_REASONS,
  sanitizeHtml,
} from "../../lib/inbox-utils";
import { supabase } from "../../lib/supabase";
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
// Macros — managed by Zustand store (stores/macros.ts)

// ─── Demo data removed — unified inbox API is the sole data source ───

// ─── Helpers (imported from lib/inbox-utils) ─────────────────

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

// ─── Compose View (full-screen inline, no backdrop) ──────────
// ─── Create Ticket (full-screen inline view) ──────────────────
function CreateTicketView({ token, connectedEmail, onClose, onSuccess, macros = [] }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [cc, setCC] = useState("");
  const [bcc, setBcc] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [macroSearch, setMacroSearch] = useState("");
  const [showMacroDD, setShowMacroDD] = useState(false);
  const bodyRef = useRef(null);
  const macroRef = useRef(null);

  useEffect(() => {
    function h(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => {
    setTimeout(() => bodyRef.current?.focus(), 150);
  }, []);

  function fmt(cmd, val) {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, val || null);
  }
  function insertLink() {
    const url = normalizeSafeUrl(prompt("URL:"));
    if (!url) {
      onSuccess("Only http, https, or mailto links are allowed", "error");
      return;
    }
    fmt("createLink", url);
  }
  function applyMacro(m) {
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
    const data = await res.json();
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
    <div className="flex-1 flex flex-col overflow-hidden border-l border-border bg-(--bg-surface) relative z-[1]">
      {/* ── Top bar: Subject + controls ── */}
      <div className="border-b border-border shrink-0">
        {/* Row 1 */}
        <div className="flex items-center px-3.5 py-2.5 gap-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-(--text-1) font-[inherit] min-w-0"
          />
          {/* Priority */}
          <div className="flex items-center gap-1 px-[9px] py-[3px] rounded-md border border-border text-[11.5px] text-(--text-2) cursor-default whitespace-nowrap shrink-0">
            <Zap size={9} />
            normal
          </div>
          {/* Prev/Next */}
          <button className="bg-none border border-border rounded-md px-[7px] py-1 cursor-pointer text-(--text-2) flex shrink-0" title="Previous">
            <ChevronLeft size={11} />
          </button>
          <button className="bg-none border border-border rounded-md px-[7px] py-1 cursor-pointer text-(--text-2) flex shrink-0" title="Next">
            <ChevronRight size={11} />
          </button>
          {/* Customer search */}
          <div className="flex items-center gap-1.5 bg-(--bg-input) border border-border rounded-lg px-2.5 py-[5px] w-60 shrink-0">
            <Search size={11} className="text-(--text-3)" />
            <input
              placeholder="Search customers by email, order..."
              className="bg-transparent border-none outline-none text-[11.5px] text-(--text-1) font-[inherit] w-full"
            />
          </div>
          {/* Settings */}
          <button className="bg-none border border-border rounded-md px-[7px] py-[5px] cursor-pointer text-(--text-2) flex shrink-0" title="Settings">
            <Settings size={15} />
          </button>
          {/* Unassigned */}
          <button className="flex items-center gap-[5px] px-2.5 py-1 bg-(--bg-input) border border-border rounded-[7px] text-[11.5px] text-(--text-2) cursor-pointer font-[inherit] whitespace-nowrap shrink-0">
            Unassigned
            <ChevronDown size={10} />
          </button>
          {/* Close */}
          <button onClick={onClose} className="bg-none border-none cursor-pointer text-(--text-3) p-1 flex shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Row 2: Tags + metadata */}
        <div className="flex items-center px-3.5 py-1.5 gap-3.5 text-xs text-(--text-2) border-t border-border flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 bg-(--bg-input) border border-border rounded-[5px] px-[7px] py-[1px] text-[11.5px] text-(--text-1)"
              >
                {t}
                <button
                  onClick={() => setTags((p) => p.filter((x) => x !== t))}
                  className="bg-none border-none cursor-pointer text-(--text-3) p-0 leading-none flex"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
            <button
              onClick={() => setShowTagInput((v) => !v)}
              className="inline-flex items-center gap-[3px] bg-none border-none cursor-pointer text-(--text-2) text-[11.5px] font-[inherit] p-0"
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
                className="bg-transparent border-none border-b border-b-(--border-hover) outline-none text-[11.5px] text-(--text-1) font-[inherit] w-[84px]"
              />
            )}
          </div>
          <div className="w-px h-[13px] bg-(--border) shrink-0" />
          <span>
            Contact reason: <button className="text-(--text-2) bg-none border-none cursor-pointer font-[inherit] text-xs p-0">+Add</button>
          </span>
          <div className="w-px h-[13px] bg-(--border) shrink-0" />
          <span>
            Product: <button className="text-(--text-2) bg-none border-none cursor-pointer font-[inherit] text-xs p-0">+Add</button>
          </span>
          <div className="w-px h-[13px] bg-(--border) shrink-0" />
          <span>
            Resolution: <button className="text-(--text-2) bg-none border-none cursor-pointer font-[inherit] text-xs p-0">+Add</button>
          </span>
        </div>
      </div>

      {/* ── Empty thread area ── */}
      <div className="flex-1 overflow-y-auto min-h-5" />

      {/* ── Bottom compose section ── */}
      <div className="border-t border-border shrink-0">
        {/* To row */}
        <div className="flex items-center px-3.5 py-2 border-b border-border gap-2">
          <span className="text-[10.5px] font-bold text-(--text-3) tracking-[.08em] uppercase w-[38px] shrink-0">To</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Search customers..."
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-(--text-1) font-[inherit]"
          />
          <button
            onClick={() => setShowCC((v) => !v)}
            className={`text-[10.5px] font-semibold border border-border rounded-[5px] px-[9px] py-[2px] cursor-pointer font-[inherit] shrink-0 transition-all ${showCC ? "text-(--text-1) bg-(--bg-surface-2)" : "text-(--text-3) bg-none"}`}
          >
            Cc / Bcc
          </button>
        </div>

        {/* From row */}
        {connectedEmail && (
          <div className="flex items-center px-3.5 py-2 border-b border-border gap-2">
            <span className="text-[10.5px] font-bold text-(--text-3) tracking-[.08em] uppercase w-[38px] shrink-0">From</span>
            <span className="text-[13px] text-(--text-2)">{connectedEmail}</span>
          </div>
        )}

        {/* CC + Bcc row */}
        {showCC && (
          <div className="flex items-center px-3.5 py-2 border-b border-border gap-2 bg-(--bg-input)">
            <span className="text-[10.5px] font-bold text-(--text-3) tracking-[.08em] uppercase w-[38px] shrink-0">CC</span>
            <input
              value={cc}
              onChange={(e) => setCC(e.target.value)}
              placeholder="cc@email.com"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-(--text-1) font-[inherit]"
            />
            <span className="text-[10.5px] font-bold text-(--text-3) tracking-[.08em] uppercase w-[38px] shrink-0">BCC</span>
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="bcc@email.com"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-(--text-1) font-[inherit]"
            />
          </div>
        )}

        {/* Macro search row */}
        <div className="flex items-center px-3.5 py-[7px] border-b border-border gap-2 relative">
          <Plus size={13} className="text-(--text-3)" />
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
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-(--text-1) font-[inherit]"
          />
          {macroSearch && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setMacroSearch("");
                setShowMacroDD(false);
              }}
              className="bg-none border-none cursor-pointer text-(--text-3) p-[2px] flex"
            >
              <X size={11} />
            </button>
          )}
          <ChevronDown size={11} className="text-(--text-3)" />
          {showMacroDD && macroHits.length > 0 && (
            <div className="absolute bottom-[calc(100%+3px)] left-0 right-0 bg-(--bg-surface) border border-border rounded-xl shadow-[0_-8px_24px_rgba(0,0,0,0.1)] z-[60] max-h-[220px] overflow-y-auto p-1">
              {macroHits.map((m) => (
                <button
                  key={m.id}
                  onMouseDown={() => applyMacro(m)}
                  className="block w-full text-left px-[11px] py-2 bg-none border-none cursor-pointer rounded-[7px] font-[inherit] transition-[background] duration-100 hover:bg-(--bg-input)"
                >
                  <div className="text-[12.5px] font-semibold text-(--text-1)">{m.name}</div>
                  <div className="text-[11.5px] text-(--text-2) overflow-hidden text-ellipsis whitespace-nowrap mt-px">{m.body?.replace(/\n/g, " ")}</div>
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
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) doSend();
          }}
          className="compose-ta min-h-[130px] px-4 py-3 text-[13.5px] leading-[1.75] overflow-y-auto"
        />

        {/* Suggested macros */}
        {!body && suggested.length > 0 && (
          <div className="px-3.5 pt-[7px] pb-2 border-t border-border flex items-center gap-[7px] flex-wrap">
            <Clock size={11} className="text-(--text-3)" />
            <span className="text-[11px] text-(--text-3) font-medium">Suggested macros</span>
            {suggested.map((m) => (
              <button
                key={m.id}
                onClick={() => applyMacro(m)}
                className="px-2.5 py-[2px] bg-(--bg-input) border border-border rounded-full text-[11.5px] text-(--text-1) cursor-pointer font-[inherit] transition-[border-color] hover:border-(--border-hover)"
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar + Send buttons */}
        <div className="flex items-center px-3 py-[7px] border-t border-border gap-[3px]">
          <button className="rtbar-btn font-bold min-w-[26px] text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("bold")} title="Bold">
            B
          </button>
          <button className="rtbar-btn italic min-w-[26px] text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("italic")} title="Italic">
            I
          </button>
          <button
            className="rtbar-btn underline min-w-[26px] text-xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fmt("underline")}
            title="Underline"
          >
            U
          </button>
          <div className="w-px h-3.5 bg-(--border) mx-[3px]" />
          <button className="rtbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={insertLink} title="Link">
            <Link2 size={12} />
          </button>
          <button className="rtbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("insertUnorderedList")} title="Bullet list">
            <List size={12} />
          </button>
          <div className="flex-1" />
          {/* Send button group */}
          <div className="flex items-stretch rounded-[9px] overflow-hidden gap-px shrink-0">
            <button
              onClick={doSend}
              disabled={sending}
              className={`flex items-center gap-1.5 px-4 py-[7px] bg-(--text-1) text-white border-none text-[12.5px] font-semibold font-[inherit] transition-[background] ${sending ? "cursor-not-allowed opacity-70" : "cursor-pointer opacity-100"}`}
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
              onClick={doSend}
              disabled={sending}
              className={`flex items-center gap-[5px] px-4 py-[7px] bg-(--text-1) text-white border-none text-[12.5px] font-semibold font-[inherit] transition-[background] whitespace-nowrap ${sending ? "cursor-not-allowed opacity-70" : "cursor-pointer opacity-100"}`}
            >
              Send &amp; Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Refund Modal ─────────────────────────────────────────────
function RefundModal({ order, token, onClose, onSuccess }) {
  const [mode, setMode] = useState("items"); // 'items' | 'full' | 'custom'
  const [qtys, setQtys] = useState(Object.fromEntries((order.lineItems || []).map((li) => [li.id, 0])));
  const [customAmount, setCustomAmount] = useState("");
  const [restock, setRestock] = useState(false);
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState("");
  const [shipping, setShipping] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "full") setQtys(Object.fromEntries((order.lineItems || []).map((li) => [li.id, li.quantity])));
    else if (mode === "items") setQtys(Object.fromEntries((order.lineItems || []).map((li) => [li.id, 0])));
  }, [mode]);

  const itemsTotal = (order.lineItems || []).reduce((s, li) => s + (qtys[li.id] || 0) * Number(li.price), 0);
  const totalRefund = mode === "custom" ? Number(customAmount) || 0 : itemsTotal;
  const canSubmit = reason && (mode === "custom" ? Number(customAmount) > 0 : totalRefund > 0);

  async function handleRefund() {
    setLoading(true);
    let body;
    if (mode === "custom") {
      body = { customAmount: Number(customAmount), notify, reason };
    } else {
      const lineItems = (order.lineItems || []).filter((li) => qtys[li.id] > 0).map((li) => ({ lineItemId: li.id, quantity: qtys[li.id] }));
      body = { lineItems, restock, notify, reason, shipping };
    }
    const res = await authFetch(`/api/shopify/orders/${order.id}/refund`, { method: "POST", body: JSON.stringify(body) }, token);
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess("Refund processed!");
    else onSuccess(data.error || "Refund failed", "error");
  }

  const MODES = [
    { v: "items", l: "By items" },
    { v: "full", l: "Full refund" },
    { v: "custom", l: "Custom amount" },
  ];

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Refund — ${order.name}`}</DialogTitle>
        </DialogHeader>
        {/* 3-way mode toggle */}
        <div className="flex gap-[5px] mb-[18px] p-1 bg-(--bg-input) rounded-[11px] border border-border">
          {MODES.map((o) => (
            <button
              key={o.v}
              onClick={() => setMode(o.v)}
              className={`flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold font-[inherit] cursor-pointer transition-all border border-transparent ${mode === o.v ? "bg-(--text-1) text-white" : "bg-transparent text-(--text-3)"}`}
            >
              {o.l}
            </button>
          ))}
        </div>

        {/* Custom amount input */}
        {mode === "custom" && (
          <div className="mb-[18px]">
            <label className="modal-label">Refund amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-(--text-3) pointer-events-none">€</span>
              <input
                type="number"
                className="modal-input pl-7"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                max={order.totalPrice}
                autoFocus
              />
            </div>
            {Number(customAmount) > 0 && (
              <div className="mt-2 text-xs text-(--text-3)">
                Max: <span className="text-(--text-2) font-semibold">{fmtPrice(order.totalPrice, order.currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* Line items table (items + full mode) */}
        {mode !== "custom" && (
          <div className="mb-4">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center pb-2 mb-1.5 border-b border-white/[0.07]">
              <span className="info-label">Product</span>
              <span className="info-label">Price</span>
              <span className="info-label text-center min-w-20">Qty</span>
              <span className="info-label text-right">Total</span>
            </div>
            {(order.lineItems || []).map((li) => (
              <div key={li.id} className="li-row">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-(--text-1)">{li.title}</div>
                  {li.variantTitle && <div className="text-[11.5px] text-(--text-3)">{li.variantTitle}</div>}
                </div>
                <span className="text-[12.5px] text-(--text-2) min-w-[60px] text-right">{fmtPrice(li.price, order.currency)}</span>
                <div className="flex items-center gap-1.5 min-w-20 justify-center">
                  <button
                    className="qty-btn"
                    onClick={() =>
                      setQtys((q) => ({
                        ...q,
                        [li.id]: Math.max(0, q[li.id] - 1),
                      }))
                    }
                    disabled={!qtys[li.id] || mode === "full"}
                  >
                    −
                  </button>
                  <span className="text-[13px] font-semibold text-(--text-1) min-w-5 text-center">{qtys[li.id]}</span>
                  <button
                    className="qty-btn"
                    onClick={() =>
                      setQtys((q) => ({
                        ...q,
                        [li.id]: Math.min(li.quantity, q[li.id] + 1),
                      }))
                    }
                    disabled={qtys[li.id] >= li.quantity || mode === "full"}
                  >
                    +
                  </button>
                  <span className="text-[11px] text-(--text-3)">/{li.quantity}</span>
                </div>
                <span className="text-[13px] font-bold text-(--text-1) min-w-[60px] text-right">
                  {fmtPrice((qtys[li.id] || 0) * Number(li.price), order.currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 mb-4">
          {mode !== "custom" && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Checkbox checked={restock} onCheckedChange={() => setRestock((v) => !v)} />
              <span className="text-[13px] text-(--text-2)">Restock items</span>
            </label>
          )}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={notify} onCheckedChange={() => setNotify((v) => !v)} />
            <span className="text-[13px] text-(--text-2)">Notify customer</span>
          </label>
          {mode !== "custom" && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Checkbox checked={shipping} onCheckedChange={() => setShipping((v) => !v)} />
              <span className="text-[13px] text-(--text-2)">Refund shipping costs</span>
            </label>
          )}
        </div>

        <div className="mb-4">
          <label className="modal-label">Reason</label>
          <select className="modal-select" value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="" disabled>
              Select a reason…
            </option>
            {REFUND_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-(--bg-surface-2) border border-border rounded-xl px-[15px] py-[13px]">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-(--text-1)">Refund total</span>
            <span className={`text-[15px] font-extrabold ${totalRefund > 0 ? "text-green-400" : "text-(--text-3)"}`}>
              {fmtPrice(totalRefund, order.currency)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-danger" onClick={handleRefund} disabled={loading || !canSubmit}>
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : "Process refund"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cancel Modal ─────────────────────────────────────────────
function CancelModal({ order, token, onClose, onSuccess }) {
  const [reason, setReason] = useState("customer");
  const [restock, setRestock] = useState(true);
  const [notify, setNotify] = useState(true);
  const [refund, setRefund] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    const res = await authFetch(
      `/api/shopify/orders/${order.id}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason, restock, notify, refund }),
      },
      token,
    );
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess("Order cancelled");
    else onSuccess(data.error || "Failed to cancel order", "error");
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Cancel order — ${order.name}`}</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <label className="modal-label">Reason for cancellation</label>
          <select className="modal-select" value={reason} onChange={(e) => setReason(e.target.value)}>
            {CANCEL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-3 mb-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={restock} onCheckedChange={() => setRestock((v) => !v)} />
            <span className="text-[13px] text-(--text-2)">Restock items</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={notify} onCheckedChange={() => setNotify((v) => !v)} />
            <span className="text-[13px] text-(--text-2)">Notify customer</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={refund} onCheckedChange={() => setRefund((v) => !v)} />
            <span className="text-[13px] text-(--text-2)">Refund payment</span>
          </label>
        </div>
        <DialogFooter>
          <button className="btn-ghost" onClick={onClose}>
            Keep order
          </button>
          <button className="btn-danger" onClick={handleCancel} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : "Cancel order"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Duplicate Modal ──────────────────────────────────────────
function DuplicateModal({ order, token, onClose, onSuccess }) {
  const [note, setNote] = useState(`Duplicate of ${order.name}`);
  const [keepAddress, setKeepAddress] = useState(true);
  const [discountType, setDiscountType] = useState("none"); // 'none' | 'percentage' | 'fixed'
  const [discountValue, setDiscountValue] = useState("");
  const [loading, setLoading] = useState(false);

  const originalTotal = Number(order.totalPrice) || 0;
  const discountAmount =
    discountType === "percentage"
      ? (originalTotal * (Number(discountValue) || 0)) / 100
      : discountType === "fixed"
        ? Math.min(Number(discountValue) || 0, originalTotal)
        : 0;
  const newTotal = Math.max(0, originalTotal - discountAmount);

  async function handleDuplicate() {
    setLoading(true);
    const res = await authFetch(
      `/api/shopify/orders/${order.id}/duplicate`,
      {
        method: "POST",
        body: JSON.stringify({
          keepAddress,
          note,
          tags: "",
          discountType: discountType !== "none" ? discountType : undefined,
          discountValue: discountType !== "none" ? Number(discountValue) : undefined,
        }),
      },
      token,
    );
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess(`Draft ${data.draftOrder?.name || ""} created!`);
    else onSuccess(data.error || "Duplicate failed", "error");
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Duplicate — ${order.name}`}</DialogTitle>
        </DialogHeader>
        {/* Products */}
        <div className="bg-(--bg-surface-2) border border-border rounded-xl px-3.5 py-2.5 mb-3.5">
          {(order.lineItems || []).map((li) => (
            <div key={li.id} className="flex justify-between py-[5px] border-b border-white/5">
              <span className="text-[12.5px] text-(--text-2)">
                {li.quantity}× {li.title}
                {li.variantTitle ? ` · ${li.variantTitle}` : ""}
              </span>
              <span className="text-[12.5px] text-(--text-2)">{fmtPrice(Number(li.price) * li.quantity, order.currency)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-1">
            <span className="text-[12.5px] text-(--text-2)">Original</span>
            <span className="text-[13px] font-bold text-(--text-1)">{fmtPrice(originalTotal, order.currency)}</span>
          </div>
        </div>

        {/* Discount section */}
        <div className="mb-3.5">
          <label className="modal-label">Discount</label>
          <div className={`flex gap-1.5 ${discountType !== "none" ? "mb-2.5" : "mb-0"}`}>
            {[
              { v: "none", l: "None" },
              { v: "percentage", l: "Percentage %" },
              { v: "fixed", l: "Fixed amount" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => {
                  setDiscountType(o.v);
                  setDiscountValue("");
                }}
                className={`flex-1 px-2 py-[7px] rounded-lg text-[11.5px] font-semibold font-[inherit] cursor-pointer transition-all border border-transparent ${discountType === o.v ? "bg-(--text-1) text-white" : "bg-(--bg-input) text-(--text-3)"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {discountType !== "none" && (
            <div className="flex items-center gap-2.5">
              <input
                type="number"
                className="modal-input flex-1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "e.g. 10" : "e.g. 5.00"}
                min="0"
                max={discountType === "percentage" ? 100 : undefined}
              />
              <span className="text-[12.5px] font-bold text-(--text-2) shrink-0">{discountType === "percentage" ? "%" : "€"}</span>
            </div>
          )}
        </div>

        {/* New total preview */}
        {discountType !== "none" && Number(discountValue) > 0 && (
          <div className="bg-(--bg-surface-2) border border-border rounded-xl px-3.5 py-2.5 mb-3.5 flex justify-between items-center">
            <div>
              <div className="text-[11px] text-(--text-3) mb-[2px]">Discount</div>
              <div className="text-[12.5px] font-bold text-rose-400">− {fmtPrice(discountAmount, order.currency)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-(--text-3) mb-[2px]">New total</div>
              <div className="text-[15px] font-extrabold text-green-400">{fmtPrice(newTotal, order.currency)}</div>
            </div>
          </div>
        )}

        <div className="mb-3.5">
          <label className="modal-label">Note</label>
          <input className="modal-input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <Checkbox checked={keepAddress} onCheckedChange={() => setKeepAddress((v) => !v)} />
          <span className="text-[13px] text-(--text-2)">Copy shipping address</span>
        </label>
        <DialogFooter>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-send flex items-center gap-[7px]" onClick={handleDuplicate} disabled={loading}>
            {loading ? (
              <Loader2 size={13} className="animate-spin text-white" />
            ) : (
              <span className="flex">
                <Copy size={12} />
              </span>
            )}
            Create draft
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Address Modal ───────────────────────────────────────
function EditAddressModal({ order, token, onClose, onSuccess }) {
  const sa = order.shippingAddress || {};
  const [form, setForm] = useState({
    firstName: sa.firstName || "",
    lastName: sa.lastName || "",
    address1: sa.address1 || "",
    address2: sa.address2 || "",
    city: sa.city || "",
    zip: sa.zip || "",
    country: sa.country || "",
    countryCode: sa.countryCode || "",
    phone: sa.phone || "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    setLoading(true);
    const res = await authFetch(`/api/shopify/orders/${order.id}/address`, { method: "PUT", body: JSON.stringify(form) }, token);
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess("Address updated");
    else onSuccess(data.error || "Failed to save address", "error");
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Edit address — ${order.name}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="modal-row">
            <div>
              <label className="modal-label">First name</label>
              <input className="modal-input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div>
              <label className="modal-label">Last name</label>
              <input className="modal-input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="modal-label">Address line 1</label>
            <input className="modal-input" value={form.address1} onChange={(e) => set("address1", e.target.value)} />
          </div>
          <div>
            <label className="modal-label">Address line 2 (optional)</label>
            <input className="modal-input" value={form.address2} onChange={(e) => set("address2", e.target.value)} />
          </div>
          <div className="modal-row">
            <div>
              <label className="modal-label">City</label>
              <input className="modal-input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label className="modal-label">Zip code</label>
              <input className="modal-input" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
            </div>
          </div>
          <div className="modal-row">
            <div>
              <label className="modal-label">Country</label>
              <input className="modal-input" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <label className="modal-label">Phone</label>
              <input className="modal-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-send" onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fulfill Modal ────────────────────────────────────────────
function FulfillModal({ order, token, onClose, onSuccess }) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCompany, setTrackingCompany] = useState("");
  const [notify, setNotify] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleFulfill() {
    setLoading(true);
    const res = await authFetch(
      `/api/shopify/orders/${order.id}/fulfill`,
      {
        method: "POST",
        body: JSON.stringify({ trackingNumber, trackingCompany, notify }),
      },
      token,
    );
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess("Order marked as fulfilled");
    else onSuccess(data.error || "Failed to fulfill order", "error");
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Fulfill order — ${order.name}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="bg-green-400/5 border border-green-400/15 rounded-xl px-3.5 py-2.5 text-[12.5px] text-green-400/80">
            All items will be marked as fulfilled.
          </div>
          <div>
            <label className="modal-label">Tracking number (optional)</label>
            <input className="modal-input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. 3SBME123456789" />
          </div>
          <div>
            <label className="modal-label">Carrier (optional)</label>
            <input className="modal-input" value={trackingCompany} onChange={(e) => setTrackingCompany(e.target.value)} placeholder="e.g. PostNL, DHL, UPS…" />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Checkbox checked={notify} onCheckedChange={() => setNotify((v) => !v)} />
            <span className="text-[13px] text-(--text-2)">Send shipping confirmation to customer</span>
          </label>
        </div>
        <DialogFooter>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-send flex items-center gap-[7px]" onClick={handleFulfill} disabled={loading}>
            {loading ? (
              <Loader2 size={13} className="animate-spin text-white" />
            ) : (
              <span className="flex">
                <Truck size={12} />
              </span>
            )}
            Mark as fulfilled
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Note Modal ───────────────────────────────────────────────
function NoteModal({ order, token, onClose, onSuccess }) {
  const [note, setNote] = useState(order.note || "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const res = await authFetch(`/api/shopify/orders/${order.id}/note`, { method: "PUT", body: JSON.stringify({ note }) }, token);
    const data = await res.json();
    setLoading(false);
    if (data.success) onSuccess("Note saved");
    else onSuccess(data.error || "Failed to save note", "error");
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Note — ${order.name}`}</DialogTitle>
        </DialogHeader>
        <div>
          <label className="modal-label">Internal note (visible in Shopify)</label>
          <textarea
            className="modal-input resize-y min-h-[100px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Add a note to this order…"
          />
        </div>
        <DialogFooter>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-send" onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ticket action bar ────────────────────────────────────────
function TicketActionBar({ meta, status, onClose, onAddTag, onRemoveTag, onFieldChange }) {
  const fieldButton = (key, label) => (
    <button
      onClick={() => onFieldChange(key, label)}
      className="inline-flex items-center gap-1 border-none bg-transparent p-0 text-[10.5px] text-(--text-3) font-[inherit]"
    >
      <span className="text-(--text-2) font-semibold">{label}:</span>
      <span>{meta[key] || "+Add"}</span>
    </button>
  );

  return (
    <div className="flex items-center gap-2 pt-2 mt-[9px] border-t border-(--border) min-h-[42px] flex-wrap">
      <button
        onClick={onClose}
        className="inline-flex items-center gap-[5px] h-[26px] px-2.5 border border-black/9 rounded-[5px] bg-[#FAFAFA] text-(--text-2) text-xs font-semibold font-[inherit]"
        title="Close ticket"
      >
        <span className="text-xs">✓</span>
        {status === "closed" ? "Closed" : "Close"}
      </button>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(meta.tags || []).map((tag) => (
          <button
            key={tag}
            onClick={() => onRemoveTag(tag)}
            title="Remove tag"
            className="inline-flex items-center gap-1 h-[22px] px-2 border border-black/9 rounded-full bg-[#F5F5F5] text-(--text-2) text-[11px] font-medium font-[inherit]"
          >
            {tag}
            <span className="text-(--text-3)">×</span>
          </button>
        ))}
        <button onClick={onAddTag} className="border-none bg-transparent text-[10.5px] text-(--text-3) font-[inherit] p-0">
          +Add tag
        </button>
      </div>

      <div className="grid grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-[18px] flex-[1_1_420px] min-w-[320px]">
        {fieldButton("contactReason", "Contact reason")}
        {fieldButton("product", "Product")}
        {fieldButton("resolution", "Resolution")}
      </div>

      <select
        value={meta.assignee || "Unassigned"}
        onChange={(e) => onFieldChange("assignee", e.target.value)}
        className="ml-auto border border-(--border) rounded-lg bg-(--bg-surface) text-(--text-2) text-[11px] py-1 px-2 font-[inherit] outline-none"
      >
        <option>Unassigned</option>
        <option>Support</option>
        <option>Admin</option>
        <option>Escalated</option>
      </select>
    </div>
  );
}

// ─── Macro Panel ──────────────────────────────────────────────
function MacroPanel({ macros, aiMacros, onInsert, onClose, customerName, onManage, onCreateNew, favs, onToggleFav }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [gearOpen, setGearOpen] = useState(false);
  const searchRef = useRef(null);
  const gearRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  useEffect(() => {
    function h(e) {
      if (e.key === "Escape") {
        if (gearOpen) setGearOpen(false);
        else onClose();
      }
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, gearOpen]);
  useEffect(() => {
    if (!gearOpen) return;
    function h(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) setGearOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [gearOpen]);

  function toggleFav(id, e) {
    e.stopPropagation();
    onToggleFav(id);
  }

  const filtered = macros.filter((m) => !search || (m.name + m.body + (m.tags || []).join("")).toLowerCase().includes(search.toLowerCase()));
  const favMacros = filtered.filter((m) => favs.includes(m.id));
  const nonFavMacros = filtered.filter((m) => !favs.includes(m.id));
  const active = selected || filtered[0] || null;

  const StarIcon = ({ filled }) => <Star size={13} fill={filled ? "#f59e0b" : "none"} stroke={filled ? "#f59e0b" : "currentColor"} />;

  function applyMacro(m) {
    const firstName = (customerName || "").split(" ")[0] || "there";
    const body = m.body.replace(/{{name}}/gi, firstName).replace(/{{firstname}}/gi, firstName);
    onInsert(body);
  }

  function renderPreview(body) {
    return body.split(/({{[^}]+}})/).map((part, i) =>
      part.match(/{{[^}]+}}/) ? (
        <span key={i} className="macro-var">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }

  return (
    <div className="border-t border-(--border) animate-[fadeUp_.18s_ease_both] flex flex-col h-[min(360px,46vh)] min-h-[220px] bg-(--bg-surface)">
      {/* Search + gear row */}
      <div className="flex items-center gap-2 py-2 px-3 border-b border-(--border) bg-(--bg-surface-2) shrink-0">
        <span className="text-(--text-3) flex shrink-0">
          <Zap size={13} />
        </span>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search macros by name, tag or content…"
          className="flex-1 bg-transparent border-none outline-none text-[12.5px] text-(--text-1) font-[inherit]"
        />
        {aiMacros?.length > 0 && (
          <span className="text-[10px] font-bold py-0.5 px-[7px] rounded-[5px] bg-(--bg-surface-2) text-(--text-2) tracking-[.04em] shrink-0">AI ✦</span>
        )}
        {/* Gear settings */}
        <div ref={gearRef} className="relative shrink-0">
          <button
            onClick={() => setGearOpen((p) => !p)}
            style={{
              color: gearOpen ? "var(--text-1)" : "var(--text-2)",
              display: "flex",
              padding: "5px 6px",
              borderRadius: 6,
              background: gearOpen ? "var(--bg-surface-2)" : "transparent",
              border: gearOpen ? "1px solid var(--border)" : "1px solid transparent",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              if (!gearOpen) {
                e.currentTarget.style.background = "var(--bg-surface)";
                e.currentTarget.style.border = "1px solid var(--border)";
              }
            }}
            onMouseLeave={(e) => {
              if (!gearOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.border = "1px solid transparent";
              }
            }}
            title="Macro settings"
          >
            <Settings size={15} />
          </button>
          {gearOpen && (
            <div className="macro-gear-menu">
              <button
                className="macro-gear-item"
                onClick={() => {
                  setGearOpen(false);
                  onManage();
                }}
              >
                <FileText size={13} />
                Manage macros
              </button>
              <button
                className="macro-gear-item"
                onClick={() => {
                  setGearOpen(false);
                  active && onManage(active);
                }}
              >
                <SquarePen size={13} />
                Edit macro
              </button>
              <button
                className="macro-gear-item"
                onClick={() => {
                  setGearOpen(false);
                  onCreateNew();
                }}
              >
                <Plus size={13} />
                Create new macro
              </button>
              <div className="macro-gear-divider" />
              <button
                className="macro-gear-item danger"
                onClick={() => {
                  setGearOpen(false);
                  active && confirm("Delete this macro?") && onDeleteMacro && onDeleteMacro(active.id);
                }}
              >
                <Trash2 size={13} />
                Delete macro
              </button>
              <div className="macro-gear-divider" />
              <button
                className="macro-gear-item"
                onClick={() => {
                  setGearOpen(false);
                  onManage();
                }}
              >
                <User size={13} />
                My macro preferences
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex py-[5px] px-1.5 rounded-md border border-transparent transition-all duration-150"
          style={{ color: "var(--text-2)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-1)";
            e.currentTarget.style.background = "var(--bg-surface)";
            e.currentTarget.style.border = "1px solid var(--border)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-2)";
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.border = "1px solid transparent";
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Two-panel — fills remaining height */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="macro-list sscroll border-r border-(--border)">
          {aiMacros?.length > 0 && (
            <>
              <div className="macro-suggest">AI suggestions ✦</div>
              {aiMacros.map((m) => (
                <div
                  key={m.id}
                  className={`macro-item${active?.id === m.id ? " mi-active" : ""}`}
                  onClick={() => setSelected(m)}
                  onDoubleClick={() => applyMacro(m)}
                >
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-(--text-1) mb-[3px]">{m.name}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="h-px bg-(--border) my-1" />
            </>
          )}
          {filtered.length === 0 && <div className="py-5 px-3.5 text-xs text-(--text-3) text-center">No macros found</div>}
          {/* Favorites section */}
          {favMacros.length > 0 && (
            <>
              <div className="macro-suggest flex items-center gap-1">
                <Star size={9} fill="#f59e0b" stroke="#f59e0b" />
                Favorites
              </div>
              {favMacros.map((m) => (
                <div
                  key={m.id}
                  className={`macro-item${active?.id === m.id ? " mi-active" : ""}`}
                  onClick={() => setSelected(m)}
                  onDoubleClick={() => applyMacro(m)}
                >
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-(--text-1) mb-[3px]">{m.name}</div>
                      <div className="flex gap-1 flex-wrap">
                        {(m.tags || []).map((t) => (
                          <span key={t} className="macro-tag">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="macro-star fav mt-px" onClick={(e) => toggleFav(m.id, e)} title="Remove from favorites">
                      <StarIcon filled />
                    </button>
                  </div>
                </div>
              ))}
              {nonFavMacros.length > 0 && <div className="h-px bg-(--border) my-1" />}
            </>
          )}
          {/* All / remaining macros */}
          {nonFavMacros.length > 0 && (
            <>
              {favMacros.length > 0 && <div className="macro-suggest">All macros</div>}
              {nonFavMacros.map((m) => (
                <div
                  key={m.id}
                  className={`macro-item${active?.id === m.id ? " mi-active" : ""}`}
                  onClick={() => setSelected(m)}
                  onDoubleClick={() => applyMacro(m)}
                >
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-(--text-1) mb-[3px]">{m.name}</div>
                      <div className="flex gap-1 flex-wrap">
                        {(m.tags || []).map((t) => (
                          <span key={t} className="macro-tag">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="macro-star mt-px" onClick={(e) => toggleFav(m.id, e)} title="Add to favorites">
                      <StarIcon filled={false} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Preview — no buttons here */}
        {active ? (
          <div className="macro-preview sscroll flex-1">{renderPreview(active.body)}</div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-(--text-3) text-[12.5px]">Select a macro to preview</div>
        )}
      </div>

      {/* Full-width footer — always visible, connected to bottom of panel */}
      <div className="border-t border-(--border) py-2 px-3.5 flex items-center justify-end gap-2 shrink-0 bg-(--bg-surface)">
        <button className="btn-ghost text-[11.5px] py-1.5 px-3.5" onClick={onClose}>
          Close
        </button>
        <button
          className="btn-send text-[11.5px] py-1.5 px-4"
          style={{
            opacity: active ? 1 : 0.45,
            cursor: active ? "pointer" : "default",
          }}
          onClick={() => active && applyMacro(active)}
        >
          Insert
        </button>
      </div>
    </div>
  );
}

// ─── Macro Editor ─────────────────────────────────────────────
function MacroEditor({ macro, onSave, onDuplicate, onDelete, onBack }) {
  const isNew = !macro?.id;
  const [name, setName] = useState(macro?.name || "");
  const [body, setBody] = useState(macro?.body || "");
  const [tags, setTags] = useState((macro?.tags || []).join(", "));
  const [language, setLang] = useState(macro?.language || "English");
  const [tagInput, setTagInput] = useState((macro?.tags || []).join(", "));
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.value = macro?.body || "";
  }, []);

  function insertVar(v) {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart,
      e = ta.selectionEnd;
    const newVal = ta.value.slice(0, s) + v + ta.value.slice(e);
    ta.value = newVal;
    setBody(newVal);
    ta.focus();
    ta.setSelectionRange(s + v.length, s + v.length);
  }

  function handleSave() {
    if (!name.trim()) return;
    const t = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({
      id: macro?.id || `m_${Date.now()}`,
      name: name.trim(),
      body: bodyRef.current?.value || body,
      tags: t,
      language,
      usageCount: macro?.usageCount || 0,
      updatedAt: new Date().toISOString(),
      archived: macro?.archived || false,
    });
  }

  const VARS = [
    { label: "Customer first name", value: "{{name}}" },
    { label: "Order number", value: "{{order_number}}" },
    { label: "Tracking link", value: "{{tracking_link}}" },
    { label: "Agent name", value: "{{agent_name}}" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-(--bg-page)">
      {/* Top bar */}
      <div className="flex items-center gap-2.5 py-3.5 px-6 border-b border-(--border) bg-(--bg-surface) shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-[5px] text-(--text-2) text-[13px] py-1 px-0 font-[inherit]">
          <ChevronLeft size={16} />
          Back
        </Button>
        <span className="text-(--border) text-[16px]">|</span>
        <span className="text-sm font-semibold text-(--text-1)">{isNew ? "Create macro" : `Edit: ${macro.name}`}</span>
      </div>

      {/* Form */}
      <div className="max-w-[860px] w-full mx-auto py-8 px-6 flex gap-8">
        {/* Left col — main */}
        <div className="flex-1 flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-(--text-2) mb-1.5">
              Macro name <span className="text-(--danger)">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Delivery - Delay"
              className="w-full py-[9px] px-3 border border-(--border) rounded-lg text-[13px] text-(--text-1) bg-(--bg-surface) font-[inherit]"
            />
            <div className="text-[11px] text-(--text-3) mt-[5px]">Name that all agents will see while searching for it</div>
          </div>

          {/* Response text */}
          <div>
            <label className="block text-xs font-semibold text-(--text-2) mb-1.5">Response text</label>
            {/* Recipient row */}
            <div className="flex items-center gap-2 py-[7px] px-3 rounded-t-lg border border-(--border) border-b-0 bg-(--bg-surface-2) text-xs text-(--text-2)">
              <span className="font-semibold">To:</span>
              <span className="py-0.5 px-2 rounded-[5px] bg-(--bg-surface-2) text-(--text-2) font-semibold text-[11px] border border-(--border)">
                Current client
              </span>
            </div>
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 py-[5px] px-2.5 border border-(--border) border-b-0 bg-(--bg-surface) flex-wrap">
              {["B", "I", "U"].map((f) => (
                <button
                  key={f}
                  style={{
                    fontWeight: f === "B" ? 700 : 400,
                    fontStyle: f === "I" ? "italic" : "normal",
                    textDecoration: f === "U" ? "underline" : "none",
                  }}
                  className="py-[3px] px-[7px] rounded-[5px] border border-transparent bg-none text-(--text-2) text-[13px] font-[inherit]"
                >
                  {f}
                </button>
              ))}
              <span className="w-px h-4 bg-(--border) mx-1" />
              {VARS.map((v) => (
                <button
                  key={v.value}
                  onClick={() => insertVar(v.value)}
                  className="py-0.5 px-2 rounded-[5px] border border-(--border) bg-(--bg-surface-2) text-(--text-2) text-[11px] font-medium font-[inherit] whitespace-nowrap"
                >
                  {v.label}
                </button>
              ))}
            </div>
            {/* Body */}
            <textarea
              ref={bodyRef}
              defaultValue={macro?.body || ""}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your macro response here. Use the variable buttons above to insert dynamic values."
              className="w-full min-h-[200px] py-3 px-3.5 border border-(--border) rounded-b-lg resize-y text-[13px] leading-[1.75] text-(--text-1) bg-(--bg-surface) font-[inherit] outline-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-(--text-2) mb-1.5">
              Tags <span className="text-[11px] font-normal text-(--text-3)">(comma separated)</span>
            </label>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. shipping, support"
              className="w-full py-[9px] px-3 border border-(--border) rounded-lg text-[13px] text-(--text-1) bg-(--bg-surface) font-[inherit]"
            />
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between pt-2 border-t border-(--border)">
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                className="py-[9px] px-[18px] rounded-lg border-none bg-(--text-1) text-(--bg-surface) font-semibold text-[13px] font-[inherit]"
              >
                {isNew ? "Create macro" : "Update macro"}
              </Button>
              {!isNew && (
                <Button
                  variant="outline"
                  onClick={() => onDuplicate(macro)}
                  className="py-[9px] px-4 rounded-lg border border-(--border) bg-(--bg-surface) text-(--text-1) font-medium text-[13px] font-[inherit]"
                >
                  Duplicate macro
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {!isNew && (
                <Button
                  variant="destructive"
                  onClick={() => onDelete(macro.id)}
                  className="py-[9px] px-4 rounded-lg border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.06)] text-(--danger) font-medium text-[13px] font-[inherit]"
                >
                  Delete macro
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right col — language */}
        <div className="w-[220px] shrink-0 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-(--text-2) mb-1.5">Language</label>
            <select
              value={language}
              onChange={(e) => setLang(e.target.value)}
              className="w-full py-[9px] px-3 border border-(--border) rounded-lg text-[13px] text-(--text-1) bg-(--bg-surface) font-[inherit] outline-none cursor-pointer"
            >
              {["English", "Dutch", "German", "French", "Spanish", "Italian", "Portuguese"].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-(--text-3) mt-[5px]">Language in which this macro is written</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Macro Manager ─────────────────────────────────────────────
function MacroManager({ macros, favs, onClose, onSaveMacro, onDeleteMacro, onToggleFav }) {
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [langFilter, setLangF] = useState("all");
  const [tagFilter, setTagF] = useState("all");
  const [editing, setEditing] = useState(null); // null=list, 'new'=create, macro=edit

  const allTags = [...new Set(macros.flatMap((m) => m.tags || []))].sort();
  const allLangs = [...new Set(macros.map((m) => m.language || "English"))].sort();

  const visible = macros.filter((m) => {
    if (tab === "active" && m.archived) return false;
    if (tab === "archived" && !m.archived) return false;
    if (search && !(m.name + m.body + (m.tags || []).join("")).toLowerCase().includes(search.toLowerCase())) return false;
    if (langFilter !== "all" && m.language !== langFilter) return false;
    if (tagFilter !== "all" && !(m.tags || []).includes(tagFilter)) return false;
    return true;
  });

  function handleSave(m) {
    onSaveMacro(m);
    setEditing(null);
  }
  function handleDuplicate(m) {
    onSaveMacro({
      ...m,
      id: `m_${Date.now()}`,
      name: `${m.name} (copy)`,
      usageCount: 0,
      updatedAt: new Date().toISOString(),
    });
    setEditing(null);
  }
  function handleDelete(id) {
    if (!confirm("Delete this macro? This cannot be undone.")) return;
    onDeleteMacro(id);
    setEditing(null);
  }
  function handleArchive(m) {
    onSaveMacro({
      ...m,
      archived: !m.archived,
      updatedAt: new Date().toISOString(),
    });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  if (editing) {
    return (
      <div className="fixed inset-0 bg-(--bg-page) z-[200] flex flex-col">
        <MacroEditor
          macro={editing === "new" ? null : editing}
          onSave={handleSave}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onBack={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-(--bg-page) z-[200] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 py-3.5 px-7 border-b border-(--border) bg-(--bg-surface) shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} className="flex items-center gap-[5px] text-(--text-2) text-[13px] py-1 px-0 font-[inherit]">
          <ChevronLeft size={16} />
          Back to inbox
        </Button>
        <span className="flex-1 text-[16px] font-bold text-(--text-1)">Macros</span>
        {/* Filters */}
        <div className="relative flex items-center">
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 9,
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search macros..."
            className="pl-[30px] pr-3 py-[7px] border border-(--border) rounded-lg text-[12.5px] text-(--text-1) bg-(--bg-surface-2) w-[200px] font-[inherit]"
          />
        </div>
        <select
          value={langFilter}
          onChange={(e) => setLangF(e.target.value)}
          className="py-[7px] px-2.5 border border-(--border) rounded-lg text-[12.5px] text-(--text-2) bg-(--bg-surface-2) cursor-pointer font-[inherit] outline-none"
        >
          <option value="all">Language</option>
          {allLangs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagF(e.target.value)}
          className="py-[7px] px-2.5 border border-(--border) rounded-lg text-[12.5px] text-(--text-2) bg-(--bg-surface-2) cursor-pointer font-[inherit] outline-none"
        >
          <option value="all">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button
          onClick={() => setEditing("new")}
          className="py-2 px-4 rounded-lg border-none bg-(--text-1) text-white font-semibold text-[13px] font-[inherit] whitespace-nowrap"
        >
          Create macro
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-7 border-b border-(--border) bg-(--bg-surface) shrink-0">
        {["active", "archived"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              borderBottom: `2px solid ${tab === t ? "#111111" : "transparent"}`,
              color: tab === t ? "var(--text-1)" : "var(--text-2)",
              fontWeight: tab === t ? 600 : 500,
            }}
            className="py-2.5 px-4 bg-none border-none text-[13px] font-[inherit] capitalize transition-all duration-150"
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-7">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-(--border)">
              {[
                ["MACRO", ""],
                ["TAGS", "160px"],
                ["LANGUAGE", "110px"],
                ["USAGE", "90px"],
                ["LAST UPDATED", "140px"],
                ["", "56px"],
              ].map(([h, w]) => (
                <th
                  key={h}
                  style={{ width: w || "auto" }}
                  className="py-2.5 pr-3 pl-0 text-[10.5px] font-bold text-(--text-3) tracking-[.05em] text-left whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-(--text-3) text-[13px]">
                  No macros found
                </td>
              </tr>
            )}
            {visible.map((m) => (
              <tr
                key={m.id}
                className="border-b border-(--border)"
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Name */}
                <td className="py-3 pr-3 pl-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFav(m.id);
                      }}
                      style={{
                        color: favs.includes(m.id) ? "#f59e0b" : "var(--text-3)",
                        opacity: favs.includes(m.id) ? 1 : 0.4,
                      }}
                      className="bg-none border-none flex p-0.5 shrink-0 transition-opacity duration-150"
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = favs.includes(m.id) ? 1 : 0.4)}
                    >
                      <Star size={13} fill={favs.includes(m.id) ? "#f59e0b" : "none"} stroke={favs.includes(m.id) ? "#f59e0b" : "currentColor"} />
                    </button>
                    <button onClick={() => setEditing(m)} className="bg-none border-none font-[inherit] text-left p-0 text-(--text-1) text-[13px] font-medium">
                      {m.name}
                    </button>
                  </div>
                </td>
                {/* Tags */}
                <td className="py-3 pr-3 pl-0">
                  <div className="flex gap-1 flex-wrap">
                    {(m.tags || []).map((t) => (
                      <span key={t} className="text-[10px] font-semibold py-0.5 px-[7px] rounded bg-(--bg-surface-2) text-(--text-2) border border-(--border)">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                {/* Language */}
                <td className="py-3 pr-3 pl-0 text-[12.5px] text-(--text-2)">{m.language || "English"}</td>
                {/* Usage */}
                <td className="py-3 pr-3 pl-0 text-[12.5px] text-(--text-2)">{m.usageCount || 0}</td>
                {/* Updated */}
                <td className="py-3 pr-3 pl-0 text-xs text-(--text-3)">{fmtDate(m.updatedAt)}</td>
                {/* Actions */}
                <td className="py-3 pl-0 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditing(m)}
                      title="Edit"
                      className="bg-none border-none text-(--text-3) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                    >
                      <SquarePen size={14} />
                    </button>
                    <button
                      onClick={() => handleArchive(m)}
                      title={m.archived ? "Unarchive" : "Archive"}
                      className="bg-none border-none text-(--text-3) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--text-1)"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      title="Delete"
                      className="bg-none border-none text-(--text-3) flex p-1 rounded-[5px] transition-colors duration-150 hover:text-(--danger)"
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
// ─── Main page ────────────────────────────────────────────────
function InboxPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [threads, setThreads] = useState([]);
  const searchParams = useSearchParams();
  const [activeFolder, setActiveFolder] = useState(searchParams.get("view") || "open");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loadingThreads, setLT] = useState(true);
  const [loadingMsgs, setLM] = useState(false);
  const [reply, setReply] = useState("");
  const [composerTab, setComposerTab] = useState("reply");
  const [sending, setSending] = useState(false);
  // AI state — powered by Zustand store
  const aiLoading = useAIStore((s) => s.aiLoading);
  const analyses = useAIStore((s) => s.analyses);
  const autoTranslate = useAIStore((s) => s.autoTranslate);
  const customerLang = useAIStore((s) => s.customerLang);
  const msgTranslations = useAIStore((s) => s.translations);
  const _setAutoTranslate = useAIStore((s) => s.setAutoTranslate);
  const _setAnalyses = useAIStore((s) => s.setAnalyses);
  const _setTranslation = useAIStore((s) => s.setTranslation);
  const _resetAIForThread = useAIStore((s) => s.resetForThread);
  const _analyzeThreads = useAIStore((s) => s.analyzeThreads);
  const _generateReply = useAIStore((s) => s.generateReply);
  const _translateMessage = useAIStore((s) => s.translateMessage);
  const _detectLanguage = useAIStore((s) => s.detectLanguage);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [counts, setCounts] = useState({
    open: 0,
    pending: 0,
    resolved: 0,
    unlinked: 0,
    trash: 0,
  });
  const [connectedEmail, setConnectedEmail] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [loadingCust, setLoadingCust] = useState(false);
  const [custSearch, setCustSearch] = useState("");
  const [rightTab, setRightTab] = useState("shopify");
  // Macros — powered by Zustand store
  const macros = useMacrosStore((s) => s.macros);
  const aiMacros = useMacrosStore((s) => s.aiMacros);
  const macroFavs = useMacrosStore((s) => s.favs);
  const _saveMacro = useMacrosStore((s) => s.saveMacro);
  const _deleteMacro = useMacrosStore((s) => s.deleteMacro);
  const _toggleMacroFav = useMacrosStore((s) => s.toggleFav);
  const _setAiMacros = useMacrosStore((s) => s.setAiMacros);
  const _fetchMacros = useMacrosStore((s) => s.fetchMacros);
  const [showMacros, setShowMacros] = useState(false);
  const [showMacroManager, setShowMacroManager] = useState(false);

  function saveMacro(m) {
    _saveMacro(m);
  }
  function deleteMacro(id) {
    _deleteMacro(id);
  }
  function toggleMacroFav(id) {
    _toggleMacroFav(id);
  }
  // Order modals
  const [modal, setModal] = useState(null); // { type:'refund'|'cancel'|'duplicate'|'address', order }
  // AI triage + translation — powered by Zustand (declared above)
  // Composer extras
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});
  const [custFieldsOpen, setCustFieldsOpen] = useState(true);
  const [custShowMore, setCustShowMore] = useState(false);
  const [checkedThreads, setCheckedThreads] = useState({});
  // ticketMeta — powered by Zustand store (persisted to localStorage)
  const getTicketMeta = useTicketMetaStore((s) => s.getMeta);
  const _addTag = useTicketMetaStore((s) => s.addTag);
  const _removeTag = useTicketMetaStore((s) => s.removeTag);
  const _updateMeta = useTicketMetaStore((s) => s.updateMeta);

  const msgEnd = useRef(null);
  const replyRef = useRef(null);
  const imgUploadRef = useRef(null);
  const fileUploadRef = useRef(null);

  // ── Auth + load ──
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.href = "/login";
        return;
      }
      setSession(session);
      await triggerSync(session.access_token);
      await loadConversations(session.access_token, "open");
      fetchCounts(session.access_token);
      fetchMacros(session.access_token);
    });
  }, []);

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function h(e) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "j") {
        const i = sortedFiltered.findIndex((t) => t.id === selected?.id);
        if (i < sortedFiltered.length - 1) openThread(sortedFiltered[i + 1]);
      }
      if (e.key === "k") {
        const i = sortedFiltered.findIndex((t) => t.id === selected?.id);
        if (i > 0) openThread(sortedFiltered[i - 1]);
      }
      if (e.key === "r" && selected) setTimeout(() => replyRef.current?.focus(), 10);
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [threads, selected, activeFolder, search, analyses]);

  // ── Status helpers ──
  async function saveStatus(id, s) {
    // Update locally immediately
    setThreads((p) => p.map((t) => (t.id === id ? { ...t, status: s } : t)));
    // Persist via API
    if (session) {
      await authFetch(`/api/inbox/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ status: s }) }, session.access_token);
      fetchCounts(session.access_token);
    }
  }
  const getStatus = (id) => {
    const thread = threads.find((t) => t.id === id);
    return thread?.status || "open";
  };
  // getTicketMeta is from the store (declared above with useState replacements)
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

  // ── Filtered + priority-sorted threads ──
  // Conversations are already filtered by folder via the API; apply local search filter only
  const URGENCY_SCORE = { critical: 4, high: 3, medium: 2, low: 1 };
  const filtered = threads.filter(
    (t) =>
      !search ||
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      (t.customer_name || t.customer_email || t.from || "").toLowerCase().includes(search.toLowerCase()),
  );

  const sortedFiltered = [...filtered].sort((a, b) => {
    const sa = URGENCY_SCORE[analyses[a.id]?.urgency] || 0;
    const sb = URGENCY_SCORE[analyses[b.id]?.urgency] || 0;
    if (sb !== sa) return sb - sa;
    return new Date(b.last_message_at || b.date) - new Date(a.last_message_at || a.date);
  });

  // ── API calls (unified inbox) ──
  async function fetchMacros(token) {
    _fetchMacros(token);
  }

  async function fetchCounts(token) {
    try {
      const res = await authFetch("/api/inbox/counts", {}, token);
      const data = await res.json();
      setCounts({
        open: data.open || 0,
        pending: data.pending || 0,
        resolved: data.resolved || 0,
        unlinked: data.unlinked || 0,
        trash: data.trash || 0,
      });
    } catch {}
  }

  async function triggerSync(token) {
    setSyncing(true);
    try {
      await authFetch("/api/inbox/sync", { method: "POST" }, token);
    } catch {}
    setSyncing(false);
  }

  async function loadConversations(token, folder) {
    setLT(true);
    const folderParam = folder || activeFolder;
    const params = new URLSearchParams();
    if (folderParam === "unlinked") params.set("unlinked", "true");
    else if (folderParam === "trash") params.set("status", "closed");
    else params.set("status", folderParam);
    if (search) params.set("search", search);
    try {
      const res = await authFetch(`/api/inbox/conversations?${params}`, {}, token);
      const data = await res.json();
      const convs = (data.conversations || []).map((c) => ({
        ...c,
        // Map unified fields to the shape the UI expects
        from: c.customer_name ? `${c.customer_name} <${c.customer_email || ""}>` : c.customer_email || "Unknown",
        subject: c.subject || "(no subject)",
        snippet: c.snippet || c.preview || "",
        date: c.last_message_at || c.created_at,
        unread: c.is_unread || false,
      }));
      setThreads(convs);
      analyzeThreads(convs, token);
    } catch {
      setThreads([]);
    }
    setLT(false);
  }

  async function analyzeThreads(threadList, token) {
    _analyzeThreads(threadList, token);
  }

  async function openThread(thread) {
    setSelected(thread);
    setMessages([]);
    setNotes([]);
    setReply("");
    setCustomer(null);
    setLM(true);
    setShowMacros(false);
    _resetAIForThread();
    setShowEmoji(false);
    setAttachments([]);
    setNoteInput("");
    setShowNotes(true);
    if (replyRef.current) replyRef.current.innerHTML = "";
    // Fetch conversation, messages, and notes via unified API
    const res = await authFetch(`/api/inbox/conversations/${thread.id}`, {}, session.access_token);
    const data = await res.json();
    const msgs = (data.messages || []).map((m) => ({
      ...m,
      from: m.from_name ? `${m.from_name} <${m.from_email || ""}>` : m.from_email || m.from || "",
      date: m.sent_at || m.created_at || m.date,
      body: m.body_html || m.body_text || m.body || "",
    }));
    setMessages(msgs);
    setNotes(data.notes || []);
    setLM(false);
    // Mark read locally
    if (thread.unread) setThreads((p) => p.map((t) => (t.id === thread.id ? { ...t, unread: false, is_unread: false } : t)));
    // Fetch Shopify customer data
    const email = extractEmail(thread.from) || data.conversation?.customer_email;
    if (email) {
      setLoadingCust(true);
      const cr = await authFetch(`/api/shopify/customer?email=${encodeURIComponent(email)}`, {}, session.access_token);
      const cd = await cr.json();
      setCustomer(cd);
      setLoadingCust(false);
      // AI macro suggestions
      authFetch(
        "/api/ai/macros",
        {
          method: "POST",
          body: JSON.stringify({
            subject: thread.subject,
            snippet: thread.snippet,
          }),
        },
        session.access_token,
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.macros?.length) _setAiMacros(d.macros);
        })
        .catch(() => {});
      // Detect customer language from snippet
      if (thread.snippet) {
        _detectLanguage(thread.snippet, session.access_token);
      }
    }
  }

  async function addNote() {
    if (!noteInput.trim() || !selected || !session) return;
    setAddingNote(true);
    try {
      const res = await authFetch(
        `/api/inbox/conversations/${selected.id}/notes`,
        { method: "POST", body: JSON.stringify({ body: noteInput.trim() }) },
        session.access_token,
      );
      const data = await res.json();
      if (data.note) setNotes((p) => [...p, data.note]);
      setNoteInput("");
    } catch {
      showT("Failed to add note", "error");
    }
    setAddingNote(false);
  }

  async function handleAiReply() {
    if (!messages.length || !selected) return;
    const reply = await _generateReply(selected, messages, session.access_token);
    if (reply) {
      if (replyRef.current) {
        replyRef.current.innerHTML = plainTextToSafeHtml(reply);
        setReply(replyRef.current.textContent);
      } else setReply(reply);
    } else showT("AI reply failed", "error");
  }

  async function handleSend() {
    const textContent = replyRef.current?.textContent || reply;
    if (!textContent.trim() || !selected) return false;
    setSending(true);
    let bodyHtml = sanitizeHtml(replyRef.current?.innerHTML || reply);
    let bodyText = textContent;
    // Auto-translate outgoing message to customer's language
    if (autoTranslate && customerLang && customerLang.code !== "en") {
      try {
        const tres = await authFetch(
          "/api/ai/translate",
          {
            method: "POST",
            body: JSON.stringify({
              text: textContent,
              targetLang: customerLang.name,
            }),
          },
          session.access_token,
        );
        const td = await tres.json();
        if (td.translated) {
          bodyHtml = plainTextToSafeHtml(td.translated);
          bodyText = td.translated;
        }
      } catch {}
    }
    const res = await authFetch(
      `/api/inbox/conversations/${selected.id}/reply`,
      { method: "POST", body: JSON.stringify({ bodyHtml, bodyText }) },
      session.access_token,
    );
    const data = await res.json();
    if (data.success || data.messageId || data.id) {
      showT("Message sent!", "success");
      if (replyRef.current) replyRef.current.innerHTML = "";
      setReply("");
      setAttachments([]);
      loadConversations(session.access_token);
      fetchCounts(session.access_token);
      setSending(false);
      return true;
    }
    showT(data.error || "Failed to send", "error");
    setSending(false);
    return false;
  }

  async function handleSendResolve() {
    if (!selected) return;
    const currentId = selected.id;
    const currentIdx = sortedFiltered.findIndex((t) => t.id === currentId);
    const nextThread = sortedFiltered.find((t, i) => i !== currentIdx);
    const ok = await handleSend();
    if (ok) {
      await saveStatus(currentId, "resolved");
      showT("Resolved & closed", "success");
      if (nextThread) openThread(nextThread);
      else setSelected(null);
    }
  }

  async function translateMessage(msgId, text) {
    _translateMessage(msgId, text, session.access_token);
  }

  function formatDoc(cmd, val) {
    replyRef.current?.focus();
    document.execCommand(cmd, false, val || null);
  }

  function insertLink() {
    const url = prompt("Enter URL:");
    const safeUrl = normalizeSafeUrl(url);
    if (url && !safeUrl) {
      showT("Only http, https, or mailto links are allowed", "error");
      return;
    }
    if (safeUrl) {
      replyRef.current?.focus();
      document.execCommand("createLink", false, safeUrl);
    }
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) {
      showT("Unsupported image type", "error");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = normalizeSafeUrl(reader.result, { allowImages: true });
      if (!src) {
        showT("Unsupported image type", "error");
        return;
      }
      replyRef.current?.focus();
      document.execCommand("insertImage", false, src);
      setReply(replyRef.current?.textContent || "");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleFileAttach(e) {
    const files = Array.from(e.target.files || []);
    setAttachments((p) => [...p, ...files.map((f) => ({ name: f.name, size: f.size }))]);
    e.target.value = "";
  }

  // EMOJIS imported from lib/inbox-utils

  function showT(msg, type = "success") {
    type === "success" ? sonnerToast.success(msg) : sonnerToast.error(msg);
  }

  async function handleCustSearch(query) {
    if (!query.trim() || !session) return;
    setLoadingCust(true);
    setCustomer(null);
    const isOrder = /^#?\d+$/.test(query.trim());
    const param = isOrder ? `order=${encodeURIComponent(query.trim().replace(/^#/, ""))}` : `email=${encodeURIComponent(query.trim())}`;
    try {
      const res = await authFetch(`/api/shopify/customer?${param}`, {}, session.access_token);
      const data = await res.json();
      setCustomer(data);
    } catch {
      setCustomer(null);
    } finally {
      setLoadingCust(false);
    }
  }

  function handleModalSuccess(msg, type = "success") {
    setModal(null);
    showT(msg, type);
    if (customer && session) {
      const email = extractEmail(selected?.from || "") || selected?.customer_email;
      if (email) {
        authFetch(`/api/shopify/customer?email=${encodeURIComponent(email)}`, {}, session.access_token)
          .then((r) => r.json())
          .then((d) => setCustomer(d))
          .catch(() => {});
      }
    }
  }

  if (!session) return null;

  const FOLDERS = [
    { key: "open", label: "Open", count: counts.open },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "resolved", label: "Resolved", count: counts.resolved },
    { key: "unlinked", label: "Unlinked", count: counts.unlinked },
    { key: "trash", label: "Trash", count: counts.trash },
  ];

  function switchFolder(key) {
    setActiveFolder(key);
    setSelected(null);
    if (session) loadConversations(session.access_token, key);
  }

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
                  await triggerSync(session.access_token);
                  loadConversations(session.access_token);
                  fetchCounts(session.access_token);
                }}
                className={`p-[5px] rounded-[7px] transition-all duration-150 ${syncing ? "text-(--text-2)" : "text-(--text-3)"}`}
                title="Sync & Refresh"
              >
                <span className={`flex ${syncing ? "animate-spin" : ""}`}>
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
            <input className="isearch" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search threads…" />
          </div>

          {/* Folder tabs */}
          <div className="sscroll flex border-b border-border overflow-x-auto">
            {FOLDERS.map((f) => (
              <button key={f.key} className={`vtab${activeFolder === f.key ? " on" : ""}`} onClick={() => switchFolder(f.key)}>
                {f.label}
                {f.count > 0 && (
                  <span
                    className={`ml-1 text-[9px] font-bold px-[5px] py-px rounded-full border border-border ${activeFolder === f.key ? "bg-[#111111] text-white" : "bg-(--bg-surface-2) text-(--text-3)"}`}
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
            const allChecked = listIds.length > 0 && listIds.every((id) => checkedThreads[id]);
            const anyChecked = listIds.some((id) => checkedThreads[id]);
            const checkedCount = listIds.filter((id) => checkedThreads[id]).length;
            return (
              <div className="flex items-center gap-2.5 py-[9px] pl-[15px] pr-3.5 border-b border-border bg-(--bg-surface) sticky top-0 z-[2]">
                <input
                  type="checkbox"
                  className="trow-cb mt-0"
                  checked={allChecked}
                  onChange={(e) => {
                    const next = {};
                    if (e.target.checked) listIds.forEach((id) => (next[id] = true));
                    setCheckedThreads(next);
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
          {/* Demo mode removed — unified inbox API is the sole data source */}
          {loadingThreads &&
            [0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="py-[11px] pr-3.5 pl-3 border-b border-border flex gap-[9px]" style={{ opacity: 1 - i * 0.16 }}>
                <div className="skel w-4 h-4 rounded shrink-0 mt-0.5" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="skel h-3 w-[55%]" />
                  <div className="skel h-[11px] w-[80%]" />
                  <div className="skel h-2.5 w-[70%]" />
                </div>
              </div>
            ))}
          {!loadingThreads && sortedFiltered.length === 0 && (
            <div className="px-5 py-10 text-center text-(--text-3) text-[12.5px]">No conversations in this folder</div>
          )}
          {sortedFiltered.map((thread) => {
            const active = selected?.id === thread.id;
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
          {!selected ? (
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
                      {selected.subject}
                    </div>
                    <div className="text-[11.5px] text-(--text-3)">
                      {extractName(selected.from)} · {messages.length} message
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
                              background: STATUS[getStatus(selected.id)]?.bg,
                              border: `1px solid ${STATUS[getStatus(selected.id)]?.border}`,
                              color: STATUS[getStatus(selected.id)]?.color,
                            }}
                          />
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            background: STATUS[getStatus(selected.id)]?.color,
                          }}
                        />
                        {STATUS[getStatus(selected.id)]?.label}
                        <ChevronDown size={11} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {Object.entries(STATUS).map(([k, s]) => (
                          <DropdownMenuItem key={k} onClick={() => saveStatus(selected.id, k)} style={{ color: s.color }}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                            {s.label}
                            {getStatus(selected.id) === k && <span className="ml-auto text-[10px] text-(--text-3)">&#10003;</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <TicketActionBar
                  meta={getTicketMeta(selected.id)}
                  status={getStatus(selected.id)}
                  onClose={() => saveStatus(selected.id, "closed")}
                  onAddTag={() => addTicketTag(selected.id)}
                  onRemoveTag={(tag) => removeTicketTag(selected.id, tag)}
                  onFieldChange={(field, labelOrValue) =>
                    field === "assignee"
                      ? updateTicketMeta(selected.id, {
                          assignee: labelOrValue,
                        })
                      : updateTicketField(selected.id, field, labelOrValue)
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
                      <div className="skel w-[34px] h-[34px] rounded-full shrink-0" />
                      <div className="skel h-20 w-[60%] rounded-[18px]" />
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
                          <span className="msg-sender">{name}</span>
                          <span className="msg-time">{formatDate(msg.date)}</span>
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
                              <button className="msg-xlate-btn" onClick={() => _setTranslation(msg.id, undefined)}>
                                Show original
                              </button>
                            ) : (
                              <button className="msg-xlate-btn" onClick={() => translateMessage(msg.id, msg.body || msg.snippet || "")}>
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
                      onClick={() => setShowNotes((v) => !v)}
                      className="flex items-center gap-1.5 text-(--text-3) text-[11px] font-bold tracking-[.06em] uppercase py-1.5 px-0 font-inherit"
                    >
                      <span className="flex">
                        <FileText size={12} />
                      </span>
                      Internal Notes ({notes.length})
                      <ChevronDown size={10} className={`transition-transform duration-200 ${showNotes ? "rotate-180" : "rotate-0"}`} />
                    </Button>
                    {showNotes &&
                      notes.map((note, ni) => (
                        <div key={note.id || ni} className="mb-3" style={{ animation: "msgIn .3s cubic-bezier(.16,1,.3,1) both" }}>
                          <div className="text-xs mb-[5px]">
                            <span className="msg-sender text-[rgba(251,191,36,0.75)]">Note</span>
                            <span className="msg-time">{formatDate(note.created_at)}</span>
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
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) addNote();
                    }}
                    placeholder="Add an internal note..."
                    className="flex-1 px-3 py-2 border border-[#FDE68A] rounded-lg text-[12.5px] text-(--text-1) bg-[rgba(251,191,36,0.04)] font-inherit outline-none transition-[border-color] duration-200"
                  />
                  <Button
                    variant="outline"
                    onClick={addNote}
                    disabled={addingNote || !noteInput.trim()}
                    className={`px-3.5 py-2 rounded-lg border border-[#FDE68A] bg-[rgba(251,191,36,0.08)] text-[#F59E0B] text-xs font-semibold font-inherit transition-all duration-150 shrink-0 whitespace-nowrap ${addingNote || !noteInput.trim() ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {addingNote ? "Adding..." : "Add Note"}
                  </Button>
                </div>
                <div ref={msgEnd} />
              </div>

              {/* Composer */}
              <div className="border-t border-border shrink-0 bg-(--bg-surface)">
                {/* Macro panel */}
                {showMacros && (
                  <MacroPanel
                    macros={macros.filter((m) => !m.archived)}
                    aiMacros={aiMacros}
                    customerName={extractName(selected?.from || "")}
                    favs={macroFavs}
                    onToggleFav={toggleMacroFav}
                    onInsert={(body) => {
                      const safeBody = plainTextToSafeHtml(body);
                      if (replyRef.current) {
                        replyRef.current.innerHTML = safeBody;
                        setReply(replyRef.current.textContent);
                      } else setReply(body);
                      setShowMacros(false);
                      setTimeout(() => replyRef.current?.focus(), 10);
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
                        <button key={t.id} className={`ctab${composerTab === t.id ? " on" : ""}`} onClick={() => setComposerTab(t.id)}>
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
                        {extractName(selected.from)}
                        {extractEmail(selected.from) ? ` (${extractEmail(selected.from)})` : ""}
                      </span>
                      <ChevronDown size={11} className="text-(--text-3) shrink-0" />
                    </div>

                    {/* Macro search row */}
                    <div
                      className="flex items-center gap-2 px-3.5 py-[7px] border-b border-border cursor-pointer transition-[background] duration-[120ms] hover:bg-(--bg-surface-2)"
                      onClick={() => setShowMacros(true)}
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
                    <input ref={imgUploadRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <input ref={fileUploadRef} type="file" multiple className="hidden" onChange={handleFileAttach} />

                    {/* Flat compose area */}
                    <div className="compose-box" onClick={() => showEmoji && setShowEmoji(false)}>
                      {/* Auto-translate banner */}
                      {autoTranslate && customerLang && customerLang.code !== "en" && (
                        <div className="xlate-bar">
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
                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-[5px] pt-2 px-3.5 pb-0">
                          {attachments.map((a, i) => (
                            <span key={i} className="attach-chip">
                              <Paperclip size={13} /> {a.name}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
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
                        ref={replyRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder={composerTab === "reply" ? "Click here to reply, or press r." : "Internal note — not visible to customer…"}
                        onInput={(e) => setReply(e.currentTarget.textContent)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                        }}
                        className={`compose-ta min-h-[150px] ${composerTab === "note" ? "bg-[rgba(251,191,36,0.03)]" : "bg-transparent"}`}
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
                            const firstName = extractName(selected?.from || "").split(" ")[0] || "there";
                            const body = m.body.replace(/{{name}}/gi, firstName).replace(/{{firstname}}/gi, firstName);
                            return (
                              <button
                                key={m.id}
                                className="macro-chip-suggest"
                                onClick={() => {
                                  if (replyRef.current) {
                                    replyRef.current.innerHTML = body.replace(/\n/g, "<br>");
                                    setReply(replyRef.current.textContent);
                                  } else setReply(body);
                                  setTimeout(() => replyRef.current?.focus(), 10);
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
                        <button className="rtbar-btn" title="Bold (⌘B)" onClick={() => formatDoc("bold")} onMouseDown={(e) => e.preventDefault()}>
                          <span className="font-extrabold text-[13px]">B</span>
                        </button>
                        <button className="rtbar-btn" title="Italic (⌘I)" onClick={() => formatDoc("italic")} onMouseDown={(e) => e.preventDefault()}>
                          <span className="italic text-[13px]">I</span>
                        </button>
                        <button className="rtbar-btn" title="Underline (⌘U)" onClick={() => formatDoc("underline")} onMouseDown={(e) => e.preventDefault()}>
                          <span className="underline text-[13px]">U</span>
                        </button>
                        <div className="rtbar-sep" />
                        <button className="rtbar-btn" title="Insert link" onClick={insertLink} onMouseDown={(e) => e.preventDefault()}>
                          <Link2 size={13} />
                        </button>
                        <button
                          className="rtbar-btn"
                          title="Insert image"
                          onClick={() => imgUploadRef.current?.click()}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <ImageIcon size={13} />
                        </button>
                        <div className="relative">
                          <button
                            className={`rtbar-btn${showEmoji ? " rton" : ""}`}
                            title="Emoji"
                            onClick={() => setShowEmoji((v) => !v)}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <Smile size={13} />
                          </button>
                          {showEmoji && (
                            <div className="emoji-pop" onClick={(e) => e.stopPropagation()}>
                              <div className="emoji-grid">
                                {EMOJIS.map((em) => (
                                  <button
                                    key={em}
                                    className="emoji-btn"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      replyRef.current?.focus();
                                      document.execCommand("insertText", false, em);
                                      setReply(replyRef.current?.textContent || "");
                                      setShowEmoji(false);
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
                          className="rtbar-btn"
                          title="Attach file"
                          onClick={() => fileUploadRef.current?.click()}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <Paperclip size={13} />
                        </button>
                        <div className="rtbar-sep" />
                        <button
                          className={`rtbar-btn${autoTranslate ? " rton" : ""} gap-1 pl-1.5 pr-2 text-[11px] font-semibold min-w-auto`}
                          title={customerLang ? `Auto-translate to ${customerLang.name}` : "Detect language"}
                          onClick={() => (customerLang ? _setAutoTranslate(!autoTranslate) : null)}
                        >
                          <Globe size={13} />
                          <span>{customerLang ? customerLang.name : "Translate"}</span>
                        </button>
                        <div className="flex-1" />
                        <button
                          className="btn-iris flex items-center gap-1.5 px-[13px] py-[7px]"
                          onClick={handleAiReply}
                          disabled={aiLoading || !messages.length}
                        >
                          {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <span className="text-primary text-[13px] leading-none">✦</span>}
                          {aiLoading ? "Generating…" : "AI Reply"}
                        </button>
                        <button className="btn-close ml-1.5" onClick={handleSendResolve} disabled={!reply.trim() || sending}>
                          <Check size={11} />
                          Send & Close
                        </button>
                        <button className="btn-send flex items-center gap-1.5 ml-1.5" onClick={handleSend} disabled={!reply.trim() || sending}>
                          {sending ? <Loader2 size={13} className="animate-spin text-white" /> : <Send size={13} />}
                          {sending ? "Sending…" : "Send"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ═══════════════ RIGHT: Customer panel ═══════════════ */}
        {selected && (
          <div className="sscroll w-[280px] border-l border-border flex flex-col shrink-0 overflow-y-auto bg-(--bg-surface)">
            {/* Search */}
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <div className="relative">
                <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-(--text-3) flex pointer-events-none">
                  <Search size={14} />
                </span>
                <input
                  className="rp-search"
                  placeholder="Search by email or #order number..."
                  value={custSearch}
                  onChange={(e) => setCustSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCustSearch(custSearch);
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
                      ? `${customer.customer.firstName || ""} ${customer.customer.lastName || ""}`.trim() || extractName(selected.from)
                      : extractName(selected.from)
                  }
                  size={28}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-(--text-1) overflow-hidden text-ellipsis whitespace-nowrap">
                    {customer?.customer
                      ? `${customer.customer.firstName || ""} ${customer.customer.lastName || ""}`.trim() || extractName(selected.from)
                      : extractName(selected.from)}
                  </div>
                  <div className="text-[11px] text-(--text-3) mt-px overflow-hidden text-ellipsis whitespace-nowrap">{extractEmail(selected.from)}</div>
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
              <button className="rp-section" onClick={() => setCustFieldsOpen((v) => !v)}>
                <span className="text-[10px] font-bold text-(--text-3) flex-1 tracking-[.07em] uppercase">Customer Fields</span>
                <ChevronDown size={10} className={`transition-transform duration-200 text-(--text-3) shrink-0 ${custFieldsOpen ? "rotate-180" : "rotate-0"}`} />
              </button>
              {custFieldsOpen && (
                <div className="px-3.5 pb-2.5 pt-0 flex flex-col">
                  <div className="rp-kv">
                    <span className="rp-kv-l">Email</span>
                    <span className="rp-kv-v text-[11px] break-all">{extractEmail(selected.from)}</span>
                  </div>
                  {loadingCust && [0, 1].map((i) => <div key={i} className="skel h-[18px] rounded-[5px] my-1" />)}
                  {customer?.customer && !loadingCust && (
                    <>
                      {customer.customer.phone && (
                        <div className="rp-kv">
                          <span className="rp-kv-l">Phone</span>
                          <span className="rp-kv-v">{customer.customer.phone}</span>
                        </div>
                      )}
                      {(customer.customer.city || customer.customer.country) && (
                        <div className="rp-kv">
                          <span className="rp-kv-l">Location</span>
                          <span className="rp-kv-v">{[customer.customer.city, customer.customer.country].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                      {customer.customer.createdAt && (
                        <div className="rp-kv">
                          <span className="rp-kv-l">Customer since</span>
                          <span className="rp-kv-v">
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
                    <span key={tag} className="rp-tag">
                      {tag.trim()}
                    </span>
                  ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              <button className={`rp-tab${rightTab === "info" ? " on" : ""}`} onClick={() => setRightTab("info")}>
                Customer
              </button>
              <button className={`rp-tab${rightTab === "shopify" ? " on" : ""}`} onClick={() => setRightTab("shopify")}>
                Orders
                {(customer?.orders || []).length > 0 ? ` (${customer.orders.length})` : ""}
              </button>
            </div>

            {/* ── Customer tab ── */}
            {rightTab === "info" && (
              <div className="shrink-0">
                {loadingCust && (
                  <div className="px-3.5 py-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skel h-5 rounded-[5px] mb-2" />
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
                        href={`mailto:${extractEmail(selected.from)}`}
                        className="text-xs text-(--text-1) no-underline overflow-hidden text-ellipsis whitespace-nowrap hover:underline"
                      >
                        {extractEmail(selected.from)}
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
                        onClick={() => setCustShowMore((v) => !v)}
                        className="flex items-center gap-1 py-[5px] px-0 text-xs text-(--text-2) font-inherit font-medium"
                      >
                        {custShowMore ? "Show less" : "Show more"}
                        <ChevronDown size={10} className={`transition-transform duration-200 ${custShowMore ? "rotate-180" : "rotate-0"}`} />
                      </Button>
                    )}
                    {custShowMore && customer?.customer && (
                      <div className="flex flex-col pt-1 border-t border-border">
                        {(customer.customer.city || customer.customer.country) && (
                          <div className="rp-kv">
                            <span className="rp-kv-l">Location</span>
                            <span className="rp-kv-v">{[customer.customer.city, customer.customer.country].filter(Boolean).join(", ")}</span>
                          </div>
                        )}
                        {customer.customer.createdAt && (
                          <div className="rp-kv">
                            <span className="rp-kv-l">Customer since</span>
                            <span className="rp-kv-v">
                              {new Date(customer.customer.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        )}
                        <div className="rp-kv">
                          <span className="rp-kv-l">Orders</span>
                          <span className="rp-kv-v">{customer.customer.ordersCount ?? "—"}</span>
                        </div>
                        <div className="rp-kv">
                          <span className="rp-kv-l">Total spent</span>
                          <span className="rp-kv-v font-bold text-(--text-1)">{fmtPrice(customer.customer.totalSpent, customer.customer.currency)}</span>
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
                  {selected?.id && <span className="text-[11px] text-(--text-3)">1 ticket, 1 open</span>}
                </div>
              </div>
            )}

            {/* ── Orders tab ── */}
            {rightTab === "shopify" && (
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
                      <div className="skel h-4 rounded-[5px] mb-2 w-[60%]" />
                      <div className="skel h-3 rounded-[5px] mb-[5px] w-[80%]" />
                      <div className="skel h-3 rounded-[5px] w-[50%]" />
                    </div>
                  ))}
                {!loadingCust && !customer?.customer && <div className="py-6 text-center text-xs text-(--text-3)">No Shopify data found</div>}
                {!loadingCust && customer?.customer && (customer.orders || []).length === 0 && (
                  <div className="py-6 text-center text-xs text-(--text-3)">No orders</div>
                )}

                {/* Order sections */}
                {(customer?.orders || []).map((order, oi) => {
                  const isOpen = expandedOrders[order.id] === undefined ? oi === 0 : expandedOrders[order.id];
                  const shippingOpen = expandedSubs[`${order.id}_shipping`] === undefined ? true : !!expandedSubs[`${order.id}_shipping`];
                  const trackOpen = expandedSubs[`${order.id}_track`] === undefined ? true : !!expandedSubs[`${order.id}_track`];
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
                        className="rp-order-hdr"
                        onClick={() =>
                          setExpandedOrders((v) => ({
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
                            <button className="rp-action" onClick={() => setModal({ type: "duplicate", order })}>
                              <span className="flex">
                                <Copy size={12} />
                              </span>
                              Duplicate
                            </button>
                            {canRefund && (
                              <button className="rp-action" onClick={() => setModal({ type: "refund", order })}>
                                <RotateCcw size={11} />$ Refund
                              </button>
                            )}
                            {canCancel && (
                              <button className="rp-action danger" onClick={() => setModal({ type: "cancel", order })}>
                                <XCircle size={11} />
                                Cancel
                              </button>
                            )}
                            <button className="rp-action px-[7px] py-1" onClick={() => setModal({ type: "note", order })}>
                              <MoreHorizontal size={13} />
                            </button>
                          </div>

                          {/* Key-value rows */}
                          <div className="mb-1">
                            <div className="rp-kv">
                              <span className="rp-kv-l">Created</span>
                              <span className="rp-kv-v">
                                {new Date(order.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            <div className="rp-kv">
                              <span className="rp-kv-l">Total</span>
                              <span className="rp-kv-v font-bold text-(--text-1)">{fmtPrice(order.totalPrice, order.currency)}</span>
                            </div>
                          </div>

                          {/* Tracking — collapsible (default open) */}
                          {(order.fulfillments || []).length > 0 && (
                            <>
                              <button
                                className="rp-subsec"
                                onClick={() =>
                                  setExpandedSubs((v) => ({
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
                                    <div className="rp-kv">
                                      <span className="rp-kv-l">Carrier</span>
                                      <span className="rp-kv-v">{f.trackingCompany || "—"}</span>
                                    </div>
                                    {f.trackingNumber && (
                                      <div className="rp-kv">
                                        <span className="rp-kv-l">Tracking #</span>
                                        <span className="rp-kv-v font-mono text-[10.5px]">{f.trackingNumber}</span>
                                      </div>
                                    )}
                                    <div className="rp-kv">
                                      <span className="rp-kv-l">Status</span>
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
                                className="rp-subsec"
                                onClick={() =>
                                  setExpandedSubs((v) => ({
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
                                      onClick={() => setModal({ type: "address", order })}
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
                                      <div key={row.l} className="rp-kv">
                                        <span className="rp-kv-l">{row.l}</span>
                                        <span className="rp-kv-v">{row.v}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* Line items — each item as its own collapsible sub-section */}
                          {(order.lineItems || []).map((item, ii) => {
                            const itemKey = `${order.id}_item_${item.id}`;
                            const itemOpen = expandedSubs[itemKey] === undefined ? true : !!expandedSubs[itemKey];
                            return (
                              <div key={item.id}>
                                <button
                                  className="rp-subsec"
                                  onClick={() =>
                                    setExpandedSubs((v) => ({
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
                                    <div className="rp-kv">
                                      <span className="rp-kv-l">Amount</span>
                                      <span className="rp-kv-v">{fmtPrice(Number(item.price) * item.quantity, order.currency)}</span>
                                    </div>
                                    {item.sku && (
                                      <div className="rp-kv">
                                        <span className="rp-kv-l">Sku</span>
                                        <span className="rp-kv-v font-mono text-[10.5px]">{item.sku}</span>
                                      </div>
                                    )}
                                    {item.variantTitle && (
                                      <div className="rp-kv">
                                        <span className="rp-kv-l">Variant</span>
                                        <span className="rp-kv-v">{item.variantTitle}</span>
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
      {modal?.type === "refund" && (
        <RefundModal order={modal.order} token={session.access_token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "cancel" && (
        <CancelModal order={modal.order} token={session.access_token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "duplicate" && (
        <DuplicateModal order={modal.order} token={session.access_token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "address" && (
        <EditAddressModal order={modal.order} token={session.access_token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "fulfill" && (
        <FulfillModal order={modal.order} token={session.access_token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "note" && <NoteModal order={modal.order} token={session.access_token} onClose={() => setModal(null)} onSuccess={handleModalSuccess} />}

      {/* Macro Manager overlay */}
      {showMacroManager && (
        <MacroManager
          macros={macros}
          favs={macroFavs}
          onClose={() => setShowMacroManager(false)}
          onSaveMacro={(m) => {
            saveMacro(m);
            sonnerToast.success("Macro saved");
          }}
          onDeleteMacro={(id) => {
            deleteMacro(id);
            sonnerToast("Macro deleted");
          }}
          onToggleFav={toggleMacroFav}
        />
      )}
    </div>
  );
}

// Wrapper checks email-connection status before rendering the inbox.
// If no email account is connected for this workspace, render the
// onboarding empty state instead.
export default function InboxPageWrapper() {
  // null = checking, true = connected, false = not connected
  const [emailConnected, setEmailConnected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      try {
        const res = await fetch("/api/inbox/accounts", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setEmailConnected(Boolean(data?.accounts?.length > 0));
      } catch {
        if (!cancelled) setEmailConnected(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (emailConnected === null) return null; // brief loading flash, no spinner

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
