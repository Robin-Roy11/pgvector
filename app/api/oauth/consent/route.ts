import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await requireSession();

  const formData = await request.formData();
  const consentChallenge = formData.get("consent_challenge") as string;
  const action = formData.get("action") as string;
  const grantScopeRaw = formData.get("grant_scope") as string;

  const hydraAdminUrl = process.env.HYDRA_ADMIN_URL ?? "http://localhost:4445";

  if (action === "deny") {
    const rejectRes = await fetch(
      `${hydraAdminUrl}/admin/oauth2/auth/requests/consent/reject?consent_challenge=${consentChallenge}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "access_denied", error_description: "User denied access" }),
      }
    );
    const rejectData = await rejectRes.json();
    redirect(rejectData.redirect_to);
  }

  const grantedScopes = grantScopeRaw ? grantScopeRaw.split(",") : [];

  const acceptRes = await fetch(
    `${hydraAdminUrl}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${consentChallenge}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_scope: grantedScopes,
        remember: true,
        remember_for: 3600,
        session: {
          access_token: {
            org_id: session.orgId,
            org_slug: session.orgSlug,
            role: session.userRole,
          },
          id_token: {
            email: session.userEmail,
            org_id: session.orgId,
            org_slug: session.orgSlug,
            role: session.userRole,
          },
        },
      }),
    }
  );

  const acceptData = await acceptRes.json();
  redirect(acceptData.redirect_to);
}
