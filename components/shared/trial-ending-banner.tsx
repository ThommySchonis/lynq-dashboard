"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "trial_banner_dismissed_until";

interface TrialEndingBannerProps {
  onDismissed?: () => void;
}

export function TrialEndingBanner({ onDismissed }: TrialEndingBannerProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      const ts = window.localStorage.getItem(DISMISS_KEY);
      if (ts && Number.parseInt(ts, 10) > Date.now()) setHidden(true);
    } catch {
      // ignore
    }
  }, []);

  function handleDismiss() {
    try {
      const until = Date.now() + 24 * 60 * 60 * 1000;
      window.localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // ignore
    }
    setHidden(true);
    onDismissed?.();
  }

  if (hidden) return null;

  return (
    <div className="relative z-5 mx-6 mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/12 to-amber-600/6 p-3.5 px-[18px] shadow-[0_1px_2px_rgba(28,15,54,0.04)]">
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="mb-0.5 text-sm font-semibold -tracking-[0.01em] text-amber-800">
          Your trial ends tomorrow
        </div>
        <div className="text-[13px] leading-normal text-amber-900">
          Pick a plan to continue using Lynq &amp; Flow.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="bg-amber-500 text-white hover:bg-amber-600" render={<Link href="/settings/billing" />}>
          See plans
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="cursor-pointer rounded-md border-none bg-transparent px-3 py-2 text-xs font-medium text-amber-800 hover:text-amber-900"
        >
          Remind me tomorrow
        </button>
      </div>
    </div>
  );
}

export default TrialEndingBanner;
