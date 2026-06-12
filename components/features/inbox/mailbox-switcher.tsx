"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStoreStore } from "@/stores/store";
import { useInboxUI } from "@/stores/inbox-ui";
import { useEmailAccountsForStore, type EmailAccountForStore } from "@/hooks/inbox/use-inbox-data";

export function MailboxSwitcher() {
  const [open, setOpen] = useState(false);
  const activeStoreId = useStoreStore((s) => s.activeStoreId);
  const selectedEmailAccountId = useInboxUI((s) => s.selectedEmailAccountId);
  const setSelectedEmailAccountId = useInboxUI((s) => s.setSelectedEmailAccountId);

  const { data: accounts = [], isLoading } = useEmailAccountsForStore(activeStoreId);

  // Reset selection to "All emails" whenever the active store changes.
  // Skip the very first run (preserve persisted selection on mount) and
  // skip null→X transitions (those are initial hydration of the persisted
  // store, not a deliberate switch).
  const previousStoreId = useRef<string | null>(activeStoreId);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      previousStoreId.current = activeStoreId;
      return;
    }
    if (previousStoreId.current === null) {
      previousStoreId.current = activeStoreId;
      return;
    }
    if (previousStoreId.current !== activeStoreId) {
      previousStoreId.current = activeStoreId;
      if (selectedEmailAccountId !== null) {
        setSelectedEmailAccountId(null);
      }
    }
  }, [activeStoreId, selectedEmailAccountId, setSelectedEmailAccountId]);

  // Validate the persisted selection against the freshly-loaded account list:
  // if the mailbox is gone, fall back to All emails.
  useEffect(() => {
    if (isLoading) return;
    if (!selectedEmailAccountId) return;
    const stillExists = accounts.some((a) => a.id === selectedEmailAccountId);
    if (!stillExists) setSelectedEmailAccountId(null);
  }, [isLoading, accounts, selectedEmailAccountId, setSelectedEmailAccountId]);

  const selectedAccount = selectedEmailAccountId ? (accounts.find((a) => a.id === selectedEmailAccountId) ?? null) : null;

  const triggerLabel = (() => {
    if (isLoading) return "Loading…";
    if (accounts.length === 0) return "No mailboxes connected";
    if (!selectedAccount) {
      if (accounts.length === 1) {
        return accounts[0].display_name?.trim() || accounts[0].email_address || "Mailbox";
      }
      return "All emails";
    }
    return selectedAccount.display_name?.trim() || selectedAccount.email_address || "Mailbox";
  })();

  const interactive = accounts.length > 1 && !isLoading;
  const showChevron = interactive;

  function handleSelect(accountId: string | null) {
    setSelectedEmailAccountId(accountId);
    setOpen(false);
  }

  return (
    <Popover open={interactive ? open : false} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={!interactive}
            className={cn(
              "mb-2.5 flex w-full items-center gap-2 rounded-xl border border-border bg-input px-3 py-[9px] text-left",
              "transition-colors",
              interactive ? "cursor-pointer hover:border-border-hover" : "cursor-default opacity-80",
            )}
            aria-label="Filter inbox by mailbox"
          />
        }
      >
        <Mail size={14} className="shrink-0 text-foreground-2" />
        <span className="flex-1 truncate text-[12.5px] font-medium text-foreground">{triggerLabel}</span>
        {showChevron && <ChevronDown size={14} className="shrink-0 text-foreground-3" />}
      </PopoverTrigger>

      <PopoverContent side="bottom" align="start" sideOffset={6} className="w-64 p-1">
        <div className="flex flex-col">
          <MailboxRow label="All emails" sublabel={null} active={selectedEmailAccountId === null} onClick={() => handleSelect(null)} statusDot={null} />
          {accounts.length > 0 && <div className="my-1 border-t border-border" />}
          {accounts.map((account: EmailAccountForStore) => (
            <MailboxRow
              key={account.id}
              label={account.email_address}
              sublabel={account.display_name?.trim() || null}
              active={selectedEmailAccountId === account.id}
              onClick={() => handleSelect(account.id)}
              statusDot={account.status === "active" ? "ok" : "down"}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MailboxRowProps {
  label: string;
  sublabel: string | null;
  active: boolean;
  onClick: () => void;
  statusDot: "ok" | "down" | null;
}

function MailboxRow({ label, sublabel, active, onClick, statusDot }: MailboxRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors", "hover:bg-accent", active && "bg-accent")}
    >
      {statusDot && <span className={cn("size-2 shrink-0 rounded-full", statusDot === "ok" ? "bg-green-500" : "bg-red-500")} aria-hidden />}
      {!statusDot && <span className="size-2 shrink-0 rounded-full bg-transparent" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-foreground">{label}</p>
        {sublabel && <p className="truncate text-[11px] text-muted-foreground">{sublabel}</p>}
      </div>
      {active && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
    </button>
  );
}
