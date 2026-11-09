import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PageTitle } from "@/components/AppShell";
// import { CATEGORIES, inr, useReceipts } from "@/lib/receipts";
import { cn } from "@/lib/utils";
import { inr, useReceipts } from "@/lib/receipts";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Analytics — SpendIQ" },
      { name: "description", content: "Category breakdown, store analytics and scanning preferences." },
      { property: "og:title", content: "Settings & Analytics — SpendIQ" },
      { property: "og:description", content: "Category breakdown, store analytics and scanning preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--muted-foreground)", "var(--accent-foreground)"];

function SettingsPage() {
  const receipts = useReceipts();
  const [prefs, setPrefs] = useState({ autoVerify: false, hindi: true, gst: true });

  // const byCat = useMemo(() => CATEGORIES.map((c) => ({ name: c, value: receipts.flatMap((r) => r.items).filter((i) => i.category === c).reduce((a, i) => a + i.qty * i.price, 0) })), [receipts]);
  // const byStore = useMemo(() => {
  //   const m = receipts.reduce<Record<string, number>>((a, r) => ((a[r.store] = (a[r.store] ?? 0) + r.total), a), {});
  //   const max = Math.max(...Object.values(m));
  //   return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ name, v, pct: (v / max) * 100 }));
  // }, [receipts]);
  const byCat = useMemo(() => {
  const m: Record<string, number> = {};
  for (const r of receipts) for (const i of r.items) m[i.name] = (m[i.name] ?? 0) + i.qty * i.price;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [receipts]);
  
  return (
    <>
      <PageTitle title="Settings & Analytics" sub="Understand your spending patterns and tune scanning." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h3 className="font-semibold">Spend by category</h3>
          <div className="flex flex-wrap items-center gap-6">
            <div className="h-60 w-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={byCat} dataKey="value" innerRadius={60} outerRadius={95} paddingAngle={3}>{byCat.map((_, i) => <Cell key={i} fill={COLORS[i]} stroke="none" />)}</Pie><Tooltip formatter={(v: number) => inr(v)} /></PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">{byCat.map((c, i) => <li key={c.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: COLORS[i] }} />{c.name}<span className="ml-auto pl-4 font-semibold">{inr(c.value)}</span></li>)}</ul>
          </div>
        </div>
        <div className="card-surface p-5">
          <h3 className="mb-4 font-semibold">Spend by store</h3>
          <div className="space-y-4">
            {byStore.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex justify-between text-sm"><span>{s.name}</span><span className="font-semibold">{inr(s.v)}</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="brand-gradient h-full rounded-full" style={{ width: `${s.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card-surface p-5 lg:col-span-2">
          <h3 className="mb-2 font-semibold">Scanning preferences</h3>
          {([
            ["autoVerify", "Auto-verify high-confidence scans", "Skip manual review when extraction confidence is above 95%."],
            ["hindi", "Hindi / Hinglish recognition", "Read item names written in Devanagari or transliterated Hindi."],
            ["gst", "Auto-calculate GST", "Fill in 5% GST when it isn't written on the receipt."],
          ] as const).map(([k, t, d]) => (
            <div key={k} className="flex items-center justify-between gap-4 border-t border-border py-4 first:border-0">
              <div><p className="font-medium">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
              <button role="switch" aria-checked={prefs[k]} onClick={() => setPrefs((p) => ({ ...p, [k]: !p[k] }))}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", prefs[k] ? "bg-primary" : "bg-input")}>
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-card shadow transition-all", prefs[k] ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
