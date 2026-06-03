import { redirect } from "next/navigation";
import KratosFlowForm from "@/app/login/KratosFlowForm";

interface RecoveryPageProps {
  searchParams: Promise<{ flow?: string }>;
}

export default async function RecoveryPage({ searchParams }: RecoveryPageProps) {
  const { flow } = await searchParams;
  const kratosUrl =
    process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ?? "http://localhost:4433";

  if (!flow) {
    redirect(`${kratosUrl}/self-service/recovery/browser`);
  }

  const flowRes = await fetch(
    `${kratosUrl}/self-service/recovery/flows?id=${flow}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!flowRes.ok) {
    redirect("/recovery");
  }

  const flowData = await flowRes.json();

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Recover account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your email address and we&apos;ll send you a recovery link.
        </p>
        <KratosFlowForm flow={flowData} />
        <p className="mt-4 text-sm text-gray-500 text-center">
          Remember your password?{" "}
          <a href="/login" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
