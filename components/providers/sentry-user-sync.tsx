"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { shouldSendPii } from "@/lib/cookies/analytics";

export function SentryUserSync() {
  useEffect(() => {
    const user = useAuthStore.getState().session?.user;
    if (user) {
      if (shouldSendPii()) {
        Sentry.setUser({ id: user.id, email: user.email });
      } else {
        Sentry.setUser({ id: user.id });
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        Sentry.setUser(null);
        return;
      }
      if (shouldSendPii()) {
        Sentry.setUser({ id: session.user.id, email: session.user.email });
      } else {
        Sentry.setUser({ id: session.user.id });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

export default SentryUserSync;
