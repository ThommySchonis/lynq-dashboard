"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { supabase } from "@/lib/supabase";

export function SentryUserSync() {
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        Sentry.setUser({ id: session.user.id, email: session.user.email });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        Sentry.setUser(null);
        return;
      }
      Sentry.setUser({ id: session.user.id, email: session.user.email });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

export default SentryUserSync;
