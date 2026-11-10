

export type AskTable = {
  head: string[];
  rows: (string | number)[][];
};

export type AskResult = {
  text: string;
  table?: AskTable;
  sql?: string;
};

// Deployed backend URL
export const API_URL =
  "https://hrr-backend-qp67.onrender.com";

const pretty = (k: string) => k.replace(/_/g, " ");

const cell = (v: unknown): string | number =>
  v === null || v === undefined
    ? "—"
    : typeof v === "number"
      ? v.toLocaleString("en-IN")
      : String(v);

export async function askBackend(
  question: string
): Promise<AskResult> {
  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    throw new Error(`Server error (${res.status})`);
  }

  const data = await res.json();

  let rows: Record<string, unknown>[] = data.rows ?? [];

  // Handle nested items from last-receipt responses
  const nested = rows.find((r) => Array.isArray(r.items));

  if (nested) {
    rows = nested.items as Record<string, unknown>[];
  }

  let text: string = data.answer ?? "No answer received.";

  if (data.examples?.length) {
    text += "\n" + data.examples
      .map((e: string) => `• ${e}`)
      .join("\n");
  }

  const hideTable =
    data.intent === "total_spend" ||
    data.intent === "count_receipts";

  const table: AskTable | undefined =
    rows.length && !hideTable
      ? {
          head: Object.keys(rows[0]).map(pretty),
          rows: rows.map((r) =>
            Object.values(r).map(cell)
          ),
        }
      : undefined;

  return {
    text,
    table,
    sql: data.sql ?? undefined,
  };
}
