"use client";

import { SessionContext } from "@/lib/auth";

interface ConsentFormProps {
  consentChallenge: string;
  requestedScopes: string[];
  session: SessionContext;
}

export default function ConsentForm({
  consentChallenge,
  requestedScopes,
  session,
}: ConsentFormProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Requested permissions:</p>
        <ul className="space-y-1">
          {requestedScopes.map((scope) => (
            <li key={scope} className="text-sm text-gray-600 flex items-center gap-2">
              <span className="text-green-500">✓</span> {scope}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-500">
        Authorizing as <strong>{session.userEmail}</strong> in org{" "}
        <strong>{session.orgSlug}</strong>
      </p>

      <form
        action="/api/oauth/consent"
        method="POST"
        className="flex gap-3"
      >
        <input type="hidden" name="consent_challenge" value={consentChallenge} />
        <input type="hidden" name="grant_scope" value={requestedScopes.join(",")} />

        <button
          type="submit"
          name="action"
          value="allow"
          className="flex-1 bg-gray-900 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Allow access
        </button>
        <button
          type="submit"
          name="action"
          value="deny"
          className="flex-1 bg-white border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Deny
        </button>
      </form>
    </div>
  );
}
