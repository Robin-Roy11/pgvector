import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Headers injected by Oathkeeper after session validation.
// Strip any incoming copies to prevent client spoofing.
const IDENTITY_HEADERS = [
  "x-user-id",
  "x-org-id",
  "x-org-slug",
  "x-user-role",
  "x-user-email",
] as const;

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/recovery",
  "/verify",
  "/oauth",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/api/auth",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

// Extracts org slug from subdomain: acme.yourapp.com → "acme"
function extractOrgSlug(host: string): string | null {
  const match = host.match(/^([a-z0-9-]+)\.(yourapp\.com|localhost)(:\d+)?$/i);
  return match ? match[1] : null;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host") ?? "";

  // Strip spoofed identity headers from the incoming request before forwarding
  const requestHeaders = new Headers(request.headers);
  for (const header of IDENTITY_HEADERS) {
    requestHeaders.delete(header);
  }

  // Extract org context from subdomain
  const orgSlug = extractOrgSlug(host);
  if (orgSlug) {
    requestHeaders.set("x-org-slug-from-host", orgSlug);
  }

  // Oathkeeper re-injects these after session validation.
  // In dev (no Oathkeeper), they will be absent.
  const userId = request.headers.get("x-user-id");

  const isDev = process.env.NODE_ENV === "development";

  // Defense-in-depth redirect for unauthenticated requests to protected routes.
  // In production, Oathkeeper handles this. This is a fallback layer.
  if (!isDev && !isPublicPath(pathname) && !userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("return_to", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Forward org context as response headers so Server Components can read them
  if (orgSlug) {
    response.headers.set("x-org-slug", orgSlug);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
