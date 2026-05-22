// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { shouldSendPii } from '@/lib/cookies/analytics'

Sentry.init({
  dsn: "https://8e494edd541ddd5c5c940d205fdbddff@o4511359613140992.ingest.de.sentry.io/4511359620350032",

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: shouldSendPii(),

  // Drop the noise that isn't actionable for us:
  //   - ResizeObserver loop messages: benign browser warnings
  //   - Network/Abort errors: client offline or user-cancelled requests
  //   - ChunkLoadError: stale client cache after a deploy (already self-heals on reload)
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Network request failed',
    'NetworkError',
    'ChunkLoadError',
    'Loading chunk',
    'AbortError',
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
