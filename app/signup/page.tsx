import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import KratosFlowForm from "@/app/login/KratosFlowForm";

interface SignupPageProps {
  searchParams: Promise<{ flow?: string; return_to?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { flow, return_to } = await searchParams;
  const session = await getSessionContext();

  if (session) {
    redirect(return_to ?? "/");
  }

  const kratosUrl =
    process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ?? "http://localhost:4433";

  if (!flow) {
    redirect(`${kratosUrl}/self-service/registration/browser`);
  }

  const flowRes = await fetch(
    `${kratosUrl}/self-service/registration/flows?id=${flow}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!flowRes.ok) {
    redirect("/signup");
  }

  const flowData = await flowRes.json();

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your email determines your organization — one account per org.
        </p>
        <KratosFlowForm flow={flowData} />
        <p className="mt-4 text-sm text-gray-500 text-center">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
