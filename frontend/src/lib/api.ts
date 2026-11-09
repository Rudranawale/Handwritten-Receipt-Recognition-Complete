export type AskTable = { head: string[]; rows: (string | number)[][] };
export type AskResult = { text: string; table?: AskTable; sql?: string };

// Same machine par backend port 8000 par chalta hai. Alag ho toh .env mein VITE_API_URL daalo.
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://127.0.0.1:8000");

const pretty = (k: string) => k.replace(/_/g, " ");
const cell = (v: unknown): string | number =>
  v === null || v === undefined
    ? "—"
    : typeof v === "number"
      ? v.toLocaleString("en-IN")
      : String(v);

export async function askBackend(question: string): Promise<AskResult> {
  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  const data = await res.json();

  let rows: Record<string, unknown>[] = data.rows ?? [];
  // "Last receipt" jawab mein items andar nested aate hain
  const nested = rows.find((r) => Array.isArray(r.items));
  if (nested) rows = nested.items as Record<string, unknown>[];

  let text: string = data.answer;
  if (data.examples?.length) {
    text += "\n" + data.examples.map((e: string) => `• ${e}`).join("\n");
  }

  const hideTable = data.intent === "total_spend" || data.intent === "count_receipts";
  const table: AskTable | undefined =
    rows.length && !hideTable
      ? {
          head: Object.keys(rows[0]).map(pretty),
          rows: rows.map((r) => Object.values(r).map(cell)),
        }
      : undefined;

  return { text, table, sql: data.sql ?? undefined };
}