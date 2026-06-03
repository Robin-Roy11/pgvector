import { headers } from "next/headers";
import { unauthorized, forbidden } from "next/navigation";

export interface SessionContext {
  userId: string;
  orgId: string;
  orgSlug: string;
  userRole: "admin" | "member" | "viewer";
  userEmail: string;
}

/**
 * Reads identity context from headers injected by Oathkeeper.
 * Returns null when unauthenticated (no Oathkeeper session present).
 * Only usable in Server Components and Route Handlers.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const h = await headers();
  const userId = h.get("x-user-id");
  const orgId = h.get("x-org-id");
  const orgSlug = h.get("x-org-slug") ?? h.get("x-org-slug-from-host");
  const userRole = h.get("x-user-role") as SessionContext["userRole"] | null;
  const userEmail = h.get("x-user-email") ?? "";

  if (!userId || !orgId || !orgSlug || !userRole) return null;

  return { userId, orgId, orgSlug, userRole, userEmail };
}

/**
 * Requires an authenticated session or throws Next.js 401 unauthorized().
 * Requires authInterrupts: true in next.config.ts.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) unauthorized();
  return session!;
}

/**
 * Requires admin role or throws Next.js 403 forbidden().
 */
export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.userRole !== "admin") forbidden();
  return session!;
}

/**
 * Checks a Keto permission without throwing — use for conditional UI rendering.
 * Results are cached for 30 seconds to reduce Keto load.
 */
export async function hasPermission(
  orgId: string,
  userId: string,
  relation: "manage" | "search" | "read" | "seed_database" | "invite_members"
): Promise<boolean> {
  const ketoUrl = process.env.KETO_READ_URL;
  if (!ketoUrl) return false;

  try {
    const res = await fetch(
      `${ketoUrl}/relation-tuples/check/openapi?` +
        new URLSearchParams({
          namespace: "Organization",
          object: orgId,
          relation,
          subject_id: userId,
        }),
      { next: { revalidate: 30 } }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.allowed === true;
  } catch {
    return false;
  }
}

/**
 * Writes a Keto relationship tuple (org membership).
 * Call from server-side only (admin API routes or webhooks).
 */
export async function writeKetoTuple(
  namespace: string,
  object: string,
  relation: string,
  subjectId: string
): Promise<void> {
  const ketoWriteUrl = process.env.KETO_WRITE_URL;
  if (!ketoWriteUrl) throw new Error("KETO_WRITE_URL is not set");

  const res = await fetch(`${ketoWriteUrl}/admin/relation-tuples`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ namespace, object, relation, subject_id: subjectId }),
  });

  if (!res.ok) {
    throw new Error(`Keto write failed: ${res.status} ${await res.text()}`);
  }
}
