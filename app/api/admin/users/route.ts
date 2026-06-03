import { requireAdmin, writeKetoTuple } from "@/lib/auth";

export async function GET() {
  const session = await requireAdmin();

  const kratosAdminUrl = process.env.KRATOS_ADMIN_URL ?? "http://localhost:4434";

  // Fetch identities from Kratos that belong to this org
  const res = await fetch(`${kratosAdminUrl}/admin/identities?per_page=250`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return Response.json({ error: "Failed to fetch identities" }, { status: 500 });
  }

  const identities: {
    id: string;
    traits: { email?: string; name?: { first?: string; last?: string }; org_id?: string; role?: string };
    created_at: string;
  }[] = await res.json();

  // Filter to only identities in this org
  const orgUsers = identities
    .filter((identity) => identity.traits.org_id === session.orgId)
    .map((identity) => ({
      id: identity.id,
      email: identity.traits.email,
      name: identity.traits.name,
      role: identity.traits.role ?? "member",
      createdAt: identity.created_at,
    }));

  return Response.json({ users: orgUsers, orgId: session.orgId });
}

export async function POST(request: Request) {
  const session = await requireAdmin();

  const body: { userId: string; role?: "admin" | "member" | "viewer" } =
    await request.json();

  if (!body.userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const role = body.role ?? "member";

  await writeKetoTuple("Organization", session.orgId, role, body.userId);

  return Response.json({ success: true, userId: body.userId, role });
}
