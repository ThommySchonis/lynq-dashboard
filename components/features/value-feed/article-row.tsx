"use client";

import { KIND_LABEL, readTimeOf } from "@/lib/value-feed-utils";
import type { NormalizedFeedItem } from "@/hooks/value-feed";

interface ArticleRowProps {
  item: NormalizedFeedItem;
  onOpen: () => void;
}

/**
 * Horizontal article row in the feed list (Figma "Article" node 396:8212).
 * Gradient thumb + meta / title / body / footer (read time + Read more).
 */
export function ArticleRow({ item, onOpen }: ArticleRowProps) {
  return (
    <article className="flex items-stretch gap-[18px] rounded-[20px] border border-border bg-card py-3.5 pl-5 pr-6 shadow-[0_12px_32px_rgba(28,15,54,0.07)]">
      {/* Thumb (Figma IMAGE-SVG node 403:807) */}
      <div
        aria-hidden="true"
        className="size-[92px] shrink-0 rounded-[14px] bg-[url('/textures/value-feed-thumb.svg')] bg-cover bg-center"
      />

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Meta */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-3">{KIND_LABEL[item.kind]}</span>
          <span aria-hidden="true" className="w-2.5" />
          <span className="text-xs leading-4 text-foreground-4">{item.dateText}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-5 text-foreground">{item.title}</h3>

        {/* Body */}
        {item.body && <p className="line-clamp-2 text-sm leading-5 text-foreground-2">{item.body}</p>}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-0.5">
          <span className="text-xs leading-4 text-foreground-4">{readTimeOf(item.body)}</span>
          <button
            type="button"
            onClick={onOpen}
            className="cursor-pointer text-xs font-medium leading-4 text-primary transition-colors hover:text-primary-hover"
          >
            Read more&nbsp;&nbsp;→
          </button>
        </div>
      </div>
    </article>
  );
}
