"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isTrialExpired } from "@/lib/trialStatus";
import { parseJson } from "@/lib/utils/typed-json";

interface OnboardingStatus {
  subscription_status?: string
  trial_ends_at?: string | null
}

const ALLOW_PATHS = [
  "/pricing-required",
  "/settings/billing",
  "/login",
  "/signup",
  "/forgot-password",
  "/invites",
  "/admin",
];

function isAllowed(pathname: string | null) {
  if (!pathname) return true;
  return ALLOW_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function BlockedStateGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isAllowed(pathname)) {
      setChecked(true);
      return;
    }

    let cancelled = false;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setChecked(true);
        return;
      }

      try {
        const res = await fetch("/api/onboarding/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 402 && !cancelled) router.replace("/pricing-required");
          else if (!cancelled) setChecked(true);
          return;
        }

        const data = await parseJson<OnboardingStatus>(res);

        if (data?.subscription_status === "paying") {
          if (!cancelled) setChecked(true);
          return;
        }

        const subStatus = data?.subscription_status;
        const trialEndsAt = data?.trial_ends_at;
        const blocked =
          subStatus === "expired" ||
          isTrialExpired({
            subscription_status: subStatus,
            trial_ends_at: trialEndsAt,
          });

        if (blocked && !cancelled) {
          router.replace("/pricing-required");
        } else if (!cancelled) {
          setChecked(true);
        }
      } catch {
        if (!cancelled) setChecked(true);
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!checked) return null;
  return children;
}

export default BlockedStateGuard;
