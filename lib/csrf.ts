const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Default allowlist when ALLOWED_ORIGINS env var is unset. Covers the
// production app URL (Vercel), the marketing root + www, and the local
// dev port. Vercel preview deployments are matched separately via
// isVercelPreview() so feature-branch URLs don't need an env update.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://lynq-dashboard.vercel.app",
  "https://lynqflow.co",
  "https://www.lynqflow.co",
  "http://localhost:3000",
];

const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks/shopify",
  "/api/webhooks/email",
  "/api/webhooks/whop",
];

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isVercelPreview(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin: string): boolean {
  return getAllowedOrigins().includes(origin) || isVercelPreview(origin);
}

function extractOrigin(referer: string): string | null {
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

interface CsrfResult {
  valid: boolean;
  reason?: string;
}

export function validateCsrfOrigin(request: {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
}): CsrfResult {
  // Skip non-mutating methods
  if (!MUTATING_METHODS.has(request.method)) {
    return { valid: true };
  }

  // Skip exempt webhook paths
  const { pathname } = new URL(request.url);
  if (CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return { valid: true };
  }

  // Check Origin header
  const origin = request.headers.get("origin");
  if (origin) {
    if (isOriginAllowed(origin)) {
      return { valid: true };
    }
    return { valid: false, reason: `Origin not allowed: ${origin}` };
  }

  // Fallback to Referer header
  const referer = request.headers.get("referer");
  if (referer) {
    const refOrigin = extractOrigin(referer);
    if (refOrigin && isOriginAllowed(refOrigin)) {
      return { valid: true };
    }
    return { valid: false, reason: `Referer origin not allowed: ${refOrigin}` };
  }

  // Both missing — reject
  return { valid: false, reason: "Missing Origin and Referer headers" };
}
