import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import ConsentForm from "./ConsentForm";

interface ConsentPageProps {
  searchParams: Promise<{ consent_challenge?: string }>;
}

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const session = await requireSession();
  const { consent_challenge } = await searchParams;

  if (!consent_challenge) {
    redirect("/");
  }

  const hydraAdminUrl =
    process.env.HYDRA_ADMIN_URL ?? "http://localhost:4445";

  // Fetch the consent request from Hydra
  const consentRes = await fetch(
    `${hydraAdminUrl}/admin/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`,
    { cache: "no-store" }
  );

  if (!consentRes.ok) {
    redirect("/oauth/error?error=invalid_consent_challenge");
  }

  const consentRequest = await consentRes.json();

  // If the client has already been granted all requested scopes, auto-accept
  if (consentRequest.skip) {
    const acceptRes = await fetch(
      `${hydraAdminUrl}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_scope: consentRequest.requested_scope,
          grant_access_token_audience: consentRequest.requested_access_token_audience,
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

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Authorize access</h1>
        <p className="text-sm text-gray-600 mb-4">
          <strong>{consentRequest.client?.client_name ?? consentRequest.client?.client_id}</strong>{" "}
          is requesting access to your account.
        </p>
        <ConsentForm
          consentChallenge={consent_challenge}
          requestedScopes={consentRequest.requested_scope ?? []}
          session={session}
        />
      </div>
    </main>
  );
}
