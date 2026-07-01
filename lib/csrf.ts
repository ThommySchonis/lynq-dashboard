import { ALLOWED_APP_ORIGINS } from "@/lib/allowed-origins";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ALLOWED_ORIGINS = ALLOWED_APP_ORIGINS;

const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks/shopify",
  "/api/webhooks/email",
  "/api/webhooks/whop",
  // MCP endpoint authenticates via an Authorization bearer token (not cookies),
  // so it is not a CSRF vector. MCP clients send a cross-origin/absent Origin,
  // which the origin check would otherwise reject.
  "/api/v1/mcp",
  // SSE transport shares the same MCP route handler and self-auth; same exemption
  // applies — not a CSRF vector.
  "/api/v1/sse",
  // OAuth endpoints: register/token are cross-origin (no Origin); authorize is
  // same-origin. None are cookie-authenticated, so not a CSRF vector.
  "/api/oauth/",
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
