"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";

interface WelcomeBannerProps {
  firstName?: string;
  onDismissed?: () => void;
}

export function WelcomeBanner({ firstName, onDismissed }: WelcomeBannerProps) {
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
    try {
      const session = useAuthStore.getState().session;
      if (!session) return;
      await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ dismiss_welcome: true }),
      });
    } catch {
      // network blip
    }
    onDismissed?.();
  }

  return (
    <div className="relative z-5 mx-6 mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-indigo-500/6 p-4 px-5 shadow-[0_1px_2px_rgba(28,15,54,0.04)]">
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="mb-1 text-sm font-semibold -tracking-[0.01em] text-foreground">
          Welcome to Lynq &amp; Flow{firstName ? `, ${firstName}` : ""}
        </div>
        <div className="text-[13px] leading-normal text-[#6B5E7B]">
          You&apos;re on a 7-day free trial. Connect your email and Shopify
          below to start handling customer support.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="bg-primary text-white hover:bg-[#8B5CF6]" render={<Link href="/settings/workspace/stores" />}>
          Connect Gmail
        </Button>
        <Button size="sm" className="bg-primary text-white hover:bg-[#8B5CF6]" render={<Link href="/settings/workspace/stores" />}>
          Connect Outlook
        </Button>
        <Button size="sm" className="bg-primary text-white hover:bg-[#8B5CF6]" render={<Link href="/settings/integrations/shopify" />}>
          Connect Shopify
        </Button>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          disabled={dismissing}
          className="cursor-pointer rounded-md border-none bg-transparent px-3 py-2 text-xs font-medium text-[#6B5E7B] disabled:cursor-wait"
        >
          {dismissing ? "Dismissing\u2026" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}

export default WelcomeBanner;
