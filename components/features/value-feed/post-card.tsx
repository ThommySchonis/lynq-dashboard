"use client";

import { useEffect, useRef, useState } from "react";
import { Instrument_Serif } from "next/font/google";
import { ArrowUpRight, Calendar, Clock, Video } from "lucide-react";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  fallback: ["Cormorant Garamond", "Georgia", "Cambria", "serif"],
});

type PostKind = "tip" | "masterclass" | "update";

const TYPE_LABELS: Record<PostKind, { text: string; className: string }> = {
  tip: { text: "TIP", className: "text-[#8A6420]" },
  masterclass: { text: "MASTERCLASS", className: "text-[#5C4FB8]" },
  update: { text: "UPDATE", className: "text-[#0F6E56]" },
};

interface PostCardProps {
  kind: PostKind;
  title: string;
  dateText?: string;
  body?: string;
  author?: { initials: string; name: string; scheduledText?: string };
  /** undefined = no CTA section; null = "Zoom link coming soon" placeholder */
  zoomUrl?: string | null;
  calUrl?: string | null;
  youtubeUrl?: string | null;
}

export default function PostCard({ kind, title, dateText, body, author, zoomUrl, calUrl, youtubeUrl }: PostCardProps) {
  const isMasterclass = kind === "masterclass";
  const meta = TYPE_LABELS[kind] || TYPE_LABELS.tip;

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!body || expanded) return;
    const el = bodyRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [body, expanded]);

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-white/60 backdrop-blur-[20px] backdrop-saturate-180 transition-shadow duration-200 shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset,0_4px_16px_rgba(127,119,221,0.06),0_1px_3px_rgba(10,6,18,0.04)] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset,0_8px_32px_rgba(127,119,221,0.10),0_2px_6px_rgba(10,6,18,0.05)] ${isMasterclass ? "p-10" : "p-8"}`}
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.65) 100%)",
      }}
    >
      {isMasterclass && (
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, #7F77DD 0%, #6366F1 50%, transparent 100%)",
          }}
        />
      )}

      {/* Type label + date */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className={`text-[11px] uppercase tracking-[0.15em] ${meta.className} ${isMasterclass ? "font-semibold" : "font-medium"}`}>{meta.text}</span>
        {dateText && <span className="text-[13px] text-[#999893]">{dateText}</span>}
      </div>

      {/* Title */}
      <h3
        className={`${display.className} mb-3 font-normal leading-[1.3] -tracking-[0.01em] text-[#0A0612] ${isMasterclass ? "text-[28px]" : "text-2xl"}`}
        style={{ fontFamily: display.style.fontFamily }}
      >
        {title}
      </h3>

      {/* Author — masterclass only */}
      {author && (
        <div className="mt-3.5 mb-4 flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-[0.02em] text-white"
            style={{
              background: "linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)",
            }}
          >
            {author.initials}
          </div>
          <div className="text-sm leading-normal text-[#6B6B66]">
            <span className="font-medium text-[#0A0612]">{author.name}</span> &middot; Lynq &amp; Flow
            {author.scheduledText && <div className="mt-0.5 text-[13px] text-[#6B6B66]">{author.scheduledText}</div>}
          </div>
        </div>
      )}

      {/* Body with line clamp */}
      {body && (
        <>
          <p ref={bodyRef} className={`m-0 whitespace-pre-wrap wrap-break-word text-[15px] leading-[1.7] text-[#2A2825] ${expanded ? "" : "line-clamp-3"}`}>
            {body}
          </p>
          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2.5 cursor-pointer border-none bg-transparent p-0 font-inherit text-[13px] font-medium text-[#6B6B66] transition-colors duration-150 hover:text-[#0A0612]"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </>
      )}

      {/* YouTube link */}
      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B6B66] no-underline transition-colors duration-150 hover:text-[#0A0612]"
        >
          Watch on YouTube
          <ArrowUpRight className="size-[11px]" strokeWidth={2.5} />
        </a>
      )}

      {/* CTAs — masterclass only */}
      {(zoomUrl !== undefined || calUrl) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {zoomUrl ? (
            <a
              href={zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-[7px] rounded-[10px] bg-[#0A0612] px-4 font-inherit text-sm font-medium text-white no-underline transition-colors duration-150 hover:bg-[#1a0f26]"
            >
              <Video className="size-3.5" strokeWidth={2.2} />
              Join Zoom session
            </a>
          ) : (
            <span className="inline-flex h-10 items-center gap-[7px] rounded-[10px] border border-[#EFEDE8] bg-[#FAFAF9] px-4 text-sm font-medium text-[#999893]">
              <Clock className="size-[13px]" />
              Zoom link coming soon
            </span>
          )}
          {calUrl && (
            <a
              href={calUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-[7px] rounded-[10px] border border-[#EFEDE8] bg-transparent px-4 font-inherit text-sm font-medium text-[#2A2825] no-underline transition-colors duration-150 hover:bg-[#F5F4F0]"
            >
              <Calendar className="size-[13px]" />
              Add to calendar
            </a>
          )}
        </div>
      )}
    </article>
  );
}
