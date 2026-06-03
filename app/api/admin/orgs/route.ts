import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const session = await requireAdmin();

  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT id, slug, name, plan, created_at
    FROM organizations
    WHERE id = ${session.orgId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  return Response.json({ org: rows[0] });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();

  const body: { name?: string; plan?: string } = await request.json();

  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    UPDATE organizations
    SET name = COALESCE(${body.name ?? null}, name),
        plan = COALESCE(${body.plan ?? null}, plan)
    WHERE id = ${session.orgId}
  `;

  return Response.json({ success: true });
}
