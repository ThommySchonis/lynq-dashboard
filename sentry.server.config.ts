// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPiiFilter } from "@/lib/sentry/pii-filter";

Sentry.init({
  dsn: "https://8e494edd541ddd5c5c940d205fdbddff@o4511359613140992.ingest.de.sentry.io/4511359620350032",

  // Safe-by-default: PII is only added for consenting users via beforeSend
  sendDefaultPii: false,

  beforeSend: createPiiFilter(supabaseAdmin),
});
