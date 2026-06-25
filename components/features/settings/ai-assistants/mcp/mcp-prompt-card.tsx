"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useCopied } from "@/hooks/use-copied";
import { ASSISTANTS, type StarterPrompt } from "@/lib/mcp-constants";

const PILL =
  "flex flex-1 items-center justify-center gap-2 rounded-[9px] border border-settings-border bg-card py-2 pl-[11px] pr-[13px] text-sm font-medium text-foreground-2 transition-colors hover:bg-foreground/[0.03]";

export function MCPPromptCard({ prompt }: { prompt: StarterPrompt }) {
  const { copied, copy } = useCopied();

  return (
    <div className="flex flex-col rounded-[14px] border border-settings-border bg-card">
      <div className="flex flex-col gap-2 px-5 pb-4 pt-[18px]">
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="text-base font-semibold text-foreground">{prompt.title}</h3>
          <button
            type="button"
            onClick={() => copy(prompt.body)}
            aria-label="Copy prompt"
            className="flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-settings-border bg-foreground/[0.03] text-foreground-3 transition-colors hover:text-foreground"
          >
            {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
          </button>
        </div>
        <p className="text-sm text-foreground-3">{prompt.body}</p>
      </div>

      <div className="h-px w-full bg-settings-border" />

      <div className="flex items-center gap-2.5 px-4 py-3">
        {ASSISTANTS.map(({ id, label, iconSrc, chatUrl }) => (
          <a key={id} href={chatUrl(prompt.body)} target="_blank" rel="noopener noreferrer" className={PILL}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc} alt="" className="size-4 shrink-0" />
            {label}
            <ExternalLink size={14} strokeWidth={1.75} className="text-foreground-4" />
          </a>
        ))}
      </div>
    </div>
  );
}
