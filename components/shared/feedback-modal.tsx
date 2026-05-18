"use client";

import { useState, useEffect, useRef } from "react";
import { Bug, Lightbulb, Loader2, MessageSquare, Send, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";

const TYPES = [
  { key: "bug", label: "Bug", Icon: Bug, placeholder: "What went wrong? Steps to reproduce help us a lot." },
  { key: "feedback", label: "Feedback", Icon: Lightbulb, placeholder: "What would make Lynq & Flow better for you?" },
  { key: "other", label: "Other", Icon: MessageSquare, placeholder: "Tell us what's on your mind." },
] as const;

type FeedbackType = (typeof TYPES)[number]["key"];

interface FeedbackErrorResponse {
  code?: string
  error?: string
}

const MAX_LEN = 5000;
const MIN_LEN = 5;

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}

export function FeedbackModal({ open, onClose, onSuccess, onError }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setType("bug");
      setMessage("");
      setSubmitting(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(240, Math.max(120, el.scrollHeight)) + "px";
  }, [message]);

  if (!open) return null;

  const trimmedLen = message.trim().length;
  const canSubmit = trimmedLen >= MIN_LEN && trimmedLen <= MAX_LEN && !submitting;
  const placeholder = TYPES.find((t) => t.key === type)?.placeholder ?? "";

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const session = useAuthStore.getState().session;
      if (!session) {
        onError?.("You must be logged in to send feedback.");
        setSubmitting(false);
        return;
      }
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type,
          message,
          page_url: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as FeedbackErrorResponse;
        const detail = err.code ? ` (${err.code})` : "";
        onError?.((err.error || "Something went wrong. Please try again.") + detail);
        setSubmitting(false);
        return;
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error("[feedback] submit error:", e);
      onError?.("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fb-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-[480px] max-w-full rounded-xl bg-white p-6 text-foreground shadow-[0_8px_24px_rgba(28,15,54,0.12)] animate-in slide-in-from-bottom-2 zoom-in-[0.98] duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#F0EDF4] pb-4 mb-5">
          <div className="min-w-0 flex-1">
            <h3 id="fb-modal-title" className="m-0 text-lg font-medium -tracking-[0.01em] text-foreground">
              Send feedback
            </h3>
            <p className="mt-1 mb-0 text-[13px] leading-normal text-[#6B5E7B]">
              Found a bug or have a suggestion? Let us know — we read every message.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="flex shrink-0 cursor-pointer items-center border-none bg-transparent p-1 text-[#9B91A8] hover:text-[#6B5E7B] disabled:cursor-not-allowed"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Type selector */}
        <label className="mb-2 block text-[13px] font-medium text-foreground">
          Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(({ key, label, Icon }) => {
            const active = type === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                disabled={submitting}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-inherit transition-colors disabled:cursor-not-allowed ${
                  active
                    ? "border-primary bg-[#EDE5FE] font-medium text-primary"
                    : "border-[#E5E0EB] bg-[#F8F7FA] text-[#6B5E7B] hover:border-primary/40"
                }`}
              >
                <Icon size={14} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Message */}
        <label className="mt-4 mb-2 block text-[13px] font-medium text-foreground">
          Message
        </label>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
          placeholder={placeholder}
          disabled={submitting}
          rows={5}
          className="w-full resize-none rounded-lg border border-[#E5E0EB] bg-white px-3 py-3 text-sm leading-normal text-foreground outline-none transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_0_0_3px_rgba(161,117,252,0.25)]"
          style={{ minHeight: 120, maxHeight: 240 }}
        />
        <div className="mt-1 text-right text-xs text-[#9B91A8]">
          {trimmedLen} / {MAX_LEN}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#F0EDF4] pt-4">
          <span className="flex-1 text-xs leading-snug text-[#9B91A8]">
            We&apos;ll include the page you&apos;re on and your browser info.
          </span>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="gap-1.5 bg-primary text-white hover:bg-[#8B5CF6] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} strokeWidth={1.75} />
              )}
              {submitting ? "Sending\u2026" : "Send feedback"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeedbackModal;
