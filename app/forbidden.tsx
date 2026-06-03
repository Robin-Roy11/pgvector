import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border shadow-sm p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access denied</h1>
        <p className="text-gray-600 mb-6">
          You don&apos;t have permission to access this resource.
          Contact your organization admin if you think this is a mistake.
        </p>
        <Link
          href="/"
          className="inline-block bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
