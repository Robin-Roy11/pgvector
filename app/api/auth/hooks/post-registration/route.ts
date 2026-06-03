import { neon } from "@neondatabase/serverless";
import { writeKetoTuple } from "@/lib/auth";

// Called by Kratos webhook after successful user registration.
// Provisions the organization in Neon and writes the Keto admin tuple.
export async function POST(request: Request) {
  const hookSecret = request.headers.get("x-hook-secret");
  if (hookSecret !== process.env.KRATOS_HOOK_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    identity?: {
      id: string;
      traits: {
        email?: string;
        org_id?: string;
        org_slug?: string;
        role?: string;
        is_joining_existing_org?: boolean;
      };
    };
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const identity = body.identity;
  if (!identity) {
    return Response.json({ error: "No identity in payload" }, { status: 400 });
  }

  const { id: userId, traits } = identity;
  const { org_id: orgId, org_slug: orgSlug, role = "member", is_joining_existing_org } = traits;

  if (!orgId || !orgSlug) {
    // User registered without org context — skip org provisioning
    return Response.json({ success: true, skipped: true });
  }

  try {
    const url = process.env.DATABASE_URL_UNPOOLED;
    if (!url) throw new Error("DATABASE_URL_UNPOOLED not set");
    const sql = neon(url);

    if (!is_joining_existing_org) {
      // First user in this org — create the organization record
      await sql`
        INSERT INTO organizations (id, slug, name)
        VALUES (${orgId}, ${orgSlug}, ${orgSlug})
        ON CONFLICT (id) DO NOTHING
      `;
      // Write admin relationship to Keto
      await writeKetoTuple("Organization", orgId, "admin", userId);
    } else {
      // Joining existing org as member
      await writeKetoTuple("Organization", orgId, role, userId);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Post-registration hook error:", error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
