"use client";

interface UiNode {
  type: string;
  group: string;
  attributes: {
    name?: string;
    type?: string;
    value?: string;
    label?: string;
    disabled?: boolean;
    node_type?: string;
    onclick?: string;
    autocomplete?: string;
  };
  messages: { id: number; text: string; type: string }[];
  meta: { label?: { text: string } };
}

interface KratosFlow {
  id: string;
  ui: {
    action: string;
    method: string;
    nodes: UiNode[];
    messages?: { id: number; text: string; type: string }[];
  };
}

export default function KratosFlowForm({ flow }: { flow: KratosFlow }) {
  const { action, method, nodes, messages } = flow.ui;

  return (
    <form action={action} method={method} className="space-y-4">
      {messages?.map((msg) => (
        <div
          key={msg.id}
          className={`text-sm rounded-lg p-3 ${
            msg.type === "error"
              ? "bg-red-50 text-red-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {msg.text}
        </div>
      ))}

      {nodes.map((node, i) => {
        const { attributes, meta, messages: nodeMessages } = node;

        if (attributes.node_type === "a") {
          return (
            <a
              key={i}
              href={attributes.value}
              className="block text-sm text-blue-600 hover:underline"
            >
              {meta.label?.text}
            </a>
          );
        }

        if (attributes.type === "submit") {
          return (
            <button
              key={i}
              type="submit"
              name={attributes.name}
              value={attributes.value}
              disabled={attributes.disabled}
              className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {meta.label?.text ?? "Submit"}
            </button>
          );
        }

        if (attributes.type === "hidden") {
          return (
            <input
              key={i}
              type="hidden"
              name={attributes.name}
              value={attributes.value}
            />
          );
        }

        return (
          <div key={i} className="space-y-1">
            {meta.label?.text && (
              <label className="block text-sm font-medium text-gray-700">
                {meta.label.text}
              </label>
            )}
            <input
              type={attributes.type ?? "text"}
              name={attributes.name}
              defaultValue={attributes.value}
              disabled={attributes.disabled}
              autoComplete={attributes.autocomplete}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
            />
            {nodeMessages?.map((msg) => (
              <p
                key={msg.id}
                className={`text-xs ${
                  msg.type === "error" ? "text-red-600" : "text-gray-500"
                }`}
              >
                {msg.text}
              </p>
            ))}
          </div>
        );
      })}
    </form>
  );
}
