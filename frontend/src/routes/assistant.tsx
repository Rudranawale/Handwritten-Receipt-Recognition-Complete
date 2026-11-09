import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageTitle, inputCls } from "@/components/AppShell";
import { askBackend, type AskTable } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI Spending Assistant — SpendIQ" },
      { name: "description", content: "Ask questions about your receipts in plain English or Hindi." },
      { property: "og:title", content: "AI Spending Assistant — SpendIQ" },
      { property: "og:description", content: "Ask questions about your receipts in plain English or Hindi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Assistant,
});

const SUGGESTIONS = [
  "Total kitna kharch hua?",
  "Sabse mehnga item kaunsa hai?",
  "Kis shop par sabse zyada kharch hua?",
  "Kitni receipts hain?",
  "Last receipt dikhao",
  "Items list dikhao",
];
type Msg = { role: "user" | "ai"; text: string; table?: AskTable; sql?: string };

function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Namaste! Apni receipts ke baare mein poochho: total kharch, sabse mehnga item, shop-wise kharch ya kisi item ka rate." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, thinking]);

  const ask = async (q: string) => {
    if (!q.trim() || thinking) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    try {
      const a = await askBackend(q);
      setMsgs((m) => [...m, { role: "ai", ...a }]);
    } catch {
      setMsgs((m) => [...m, { role: "ai", text: "Backend se connect nahi ho paaya. Check karo ki FastAPI server (port 8000) chal raha hai." }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      <PageTitle title="AI Assistant" sub="Ask questions in plain English or Hindi." />
      <div className="mb-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-primary hover:bg-violet-soft hover:text-primary">
            <Sparkles className="size-3.5 text-gold" />{s}
          </button>
        ))}
      </div>
      <div className="card-surface flex h-[calc(100vh-17rem)] min-h-[420px] flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-1", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("grid size-8 shrink-0 place-items-center rounded-full", m.role === "ai" ? "brand-gradient text-primary-foreground" : "bg-muted")}>
                {m.role === "ai" ? <Bot className="size-4" /> : <User className="size-4" />}
              </div>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-3 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60")}>
                <p className="whitespace-pre-line">{m.text}</p>
                {m.table && m.table.rows.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full overflow-hidden rounded-lg bg-card text-xs">
                      <thead className="text-left capitalize text-muted-foreground"><tr>{m.table.head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-border">{m.table.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
                {m.sql && <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">SQL: {m.sql}</p>}
              </div>
            </div>
          ))}
          {thinking && <div className="flex gap-3"><div className="brand-gradient grid size-8 place-items-center rounded-full text-primary-foreground"><Bot className="size-4" /></div><div className="flex items-center gap-1 rounded-2xl bg-muted/60 px-4">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 120}ms` }} />)}</div></div>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-border p-4">
          <input className={inputCls} placeholder="e.g. Rahul Auto Works par total kitna kharch hua?" value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" disabled={!input.trim() || thinking} className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40" aria-label="Send"><Send className="size-4" /></button>
        </form>
      </div>
    </>
  );
}

