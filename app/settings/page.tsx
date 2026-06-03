import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import KratosFlowForm from "@/app/login/KratosFlowForm";

interface SettingsPageProps {
  searchParams: Promise<{ flow?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await requireSession();
  const { flow } = await searchParams;
  const kratosUrl =
    process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ?? "http://localhost:4433";

  if (!flow) {
    redirect(`${kratosUrl}/self-service/settings/browser`);
  }

  const flowRes = await fetch(
    `${kratosUrl}/self-service/settings/flows?id=${flow}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!flowRes.ok) {
    redirect("/settings");
  }

  const flowData = await flowRes.json();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Account settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            {session.userEmail} &middot; {session.orgSlug}
          </p>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <KratosFlowForm flow={flowData} />
        </div>
      </div>
    </main>
  );
}
