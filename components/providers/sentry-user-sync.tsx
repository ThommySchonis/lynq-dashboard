"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export function SentryUserSync() {
  useEffect(() => {
    const user = useAuthStore.getState().session?.user;
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email });
    }

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
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

export default SentryUserSync;
