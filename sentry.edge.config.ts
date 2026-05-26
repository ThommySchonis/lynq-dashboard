// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { createPiiFilter } from "@/lib/sentry/pii-filter";

const edgeSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

Sentry.init({
  dsn: "https://8e494edd541ddd5c5c940d205fdbddff@o4511359613140992.ingest.de.sentry.io/4511359620350032",

  // Safe-by-default: PII is only added for consenting users via beforeSend
  sendDefaultPii: false,

  beforeSend: createPiiFilter(edgeSupabase),
});
