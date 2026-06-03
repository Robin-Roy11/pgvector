import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import KratosFlowForm from "@/app/login/KratosFlowForm";

interface LoginPageProps {
  searchParams: Promise<{ flow?: string; return_to?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { flow, return_to } = await searchParams;
  const session = await getSessionContext();

  if (session) {
    redirect(return_to ?? "/");
  }

  const kratosUrl =
    process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ?? "http://localhost:4433";

  // No flow ID — initialize a new Kratos login flow
  if (!flow) {
    const returnParam = return_to
      ? `&return_to=${encodeURIComponent(return_to)}`
      : "";
    redirect(
      `${kratosUrl}/self-service/login/browser?refresh=true${returnParam}`
    );
  }

  // Fetch the Kratos flow to get its dynamic UI nodes
  const flowRes = await fetch(
    `${kratosUrl}/self-service/login/flows?id=${flow}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!flowRes.ok) {
    // Flow expired or invalid — start fresh
    redirect("/login");
  }

  const flowData = await flowRes.json();

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign in</h1>
        <KratosFlowForm flow={flowData} />
        <p className="mt-4 text-sm text-gray-500 text-center">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
