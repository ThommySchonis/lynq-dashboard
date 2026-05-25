const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ALLOWED_ORIGINS = [
  "https://lynq-dashboard.vercel.app",
  "http://localhost:3000",
];

const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks/shopify",
  "/api/webhooks/email",
  "/api/webhooks/whop",
];

function isVercelPreview(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
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
    if (ALLOWED_ORIGINS.includes(origin) || isVercelPreview(origin)) {
      return { valid: true };
    }
    return { valid: false, reason: `Origin not allowed: ${origin}` };
  }

  // Fallback to Referer header
  const referer = request.headers.get("referer");
  if (referer) {
    const refOrigin = extractOrigin(referer);
    if (
      refOrigin &&
      (ALLOWED_ORIGINS.includes(refOrigin) || isVercelPreview(refOrigin))
    ) {
      return { valid: true };
    }
    return { valid: false, reason: `Referer origin not allowed: ${refOrigin}` };
  }

  // Both missing — reject
  return { valid: false, reason: "Missing Origin and Referer headers" };
}
