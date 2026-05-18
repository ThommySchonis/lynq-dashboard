"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Circle, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

interface OnboardingStatus {
  macros_count?: number;
  email_connected?: boolean;
  shopify_connected?: boolean;
  team_member_count?: number;
}

interface SetupChecklistProps {
  status: OnboardingStatus;
  onDismissed?: () => void;
}

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string | null;
}

function buildItems(status: OnboardingStatus): ChecklistItem[] {
  return [
    { key: "account", label: "Account created", done: true, href: null },
    { key: "workspace", label: "Workspace ready", done: true, href: null },
    {
      key: "macros",
      label: "Generate AI macro library",
      done: (status.macros_count ?? 0) > 0,
      href: "/settings/workspace/macros/generate",
    },
    {
      key: "email",
      label: "Connect email",
      done: !!status.email_connected,
      href: "/settings/integrations/email",
    },
    {
      key: "shopify",
      label: "Connect Shopify",
      done: !!status.shopify_connected,
      href: "/settings/integrations/shopify",
    },
    {
      key: "team",
      label: "Invite first team member",
      done: (status.team_member_count ?? 0) > 1,
      href: "/settings/workspace/members",
    },
  ];
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const content = (
    <>
      <span className="flex w-3 justify-center">
        {item.done ? (
          <Check size={10} strokeWidth={3} className="text-green-500" />
        ) : (
          <Circle size={10} strokeWidth={2} className="text-white/40" />
        )}
      </span>
      <span className={item.done ? "line-through" : ""}>
        {item.label}
      </span>
    </>
  );

  if (item.done || !item.href) {
    return (
      <div
        className={`flex items-center gap-2 text-[11px] ${item.done ? "text-white/45" : "text-white/70"}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className="flex items-center gap-2 text-[11px] text-white/70 no-underline hover:text-white/90"
    >
      {content}
    </Link>
  );
}

export function SetupChecklist({ status, onDismissed }: SetupChecklistProps) {
  const [dismissing, setDismissing] = useState(false);

  const items = buildItems(status);
  const done = items.filter((i) => i.done).length;
  const total = items.length;

  if (done >= total) return null;

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
        body: JSON.stringify({ dismiss_setup_checklist: true }),
      });
    } catch {
      // best-effort
    }
    onDismissed?.();
  }

  return (
    <div className="mx-2 mb-2 rounded-lg border border-primary/18 bg-primary/10 p-2.5 px-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white">
          Setup ({done}/{total})
        </span>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          disabled={dismissing}
          aria-label="Hide setup checklist"
          title="Hide setup checklist"
          className="flex cursor-pointer items-center border-none bg-transparent p-0 text-white/40 hover:text-white/60 disabled:cursor-wait"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <ChecklistRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}

export default SetupChecklist;
