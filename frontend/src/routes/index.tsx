import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { IndianRupee, ReceiptText, Store, BadgePercent, TrendingUp, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTitle, StatusBadge } from "@/components/AppShell";
import { Dropzone } from "@/components/Dropzone";
import { ReceiptPanel } from "@/components/ReceiptPanel";
// import { fmtDate, inr, monthlyByCategory, useReceipts, type Receipt } from "@/lib/receipts";
import { fmtDate, inr, monthlySpend, useReceipts, type Receipt } from "@/lib/receipts";
import { setPendingFile } from "@/lib/pending";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReceiptIQ — Smart Receipt & Expense Dashboard" },
      { name: "description", content: "Scan handwritten receipts with AI and track your grocery spending in one dashboard." },
      { property: "og:title", content: "ReceiptIQ — Smart Receipt & Expense Dashboard" },
      { property: "og:description", content: "Scan handwritten receipts with AI and track your grocery spending." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const receipts = useReceipts();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Receipt | null>(null);

  const stats = useMemo(() => {
    const month = receipts[0]?.date.slice(0, 7) ?? "";
    const prev = (() => { const [y = 2026, m = 1] = month.split("-").map(Number); const d = new Date(y, m - 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
    const sum = (p: string) => receipts.filter((r) => r.date.startsWith(p)).reduce((a, r) => a + r.total, 0);
    const cur = sum(month), last = sum(prev);
    const byStore = receipts.reduce<Record<string, number>>((a, r) => ((a[r.store] = (a[r.store] ?? 0) + r.total), a), {});
    const top = Object.entries(byStore).sort((a, b) => b[1] - a[1])[0];
    return {
      total: receipts.reduce((a, r) => a + r.total, 0),
      cur, trend: last ? ((cur - last) / last) * 100 : 0,
      // verified: Math.round((receipts.filter((r) => r.status === "Verified").length / receipts.length) * 100),
      verified: receipts.length ? Math.round((receipts.filter((r) => r.status === "Verified").length / receipts.length) * 100) : 0,
      top, gst: receipts.reduce((a, r) => a + r.gst, 0),
    };
  }, [receipts]);
  // const chart = useMemo(() => monthlyByCategory(receipts), [receipts]);
  const chart = useMemo(() => monthlySpend(receipts), [receipts]);

  const cards = [
    { label: "Total Spend", value: inr(stats.total), sub: <Trend v={stats.trend} />, icon: IndianRupee, tone: "bg-violet-soft text-violet" },
    { label: "Receipts Scanned", value: String(receipts.length), sub: <span className="text-muted-foreground">{stats.verified}% verified</span>, icon: ReceiptText, tone: "bg-mint-soft text-mint" },
    { label: "Top Store", value: stats.top?.[0] ?? "—", sub: <span className="text-muted-foreground">{inr(stats.top?.[1] ?? 0)} spent</span>, icon: Store, tone: "bg-gold-soft text-gold", small: true },
    { label: "GST Logged", value: inr(stats.gst), sub: <span className="text-muted-foreground">across all receipts</span>, icon: BadgePercent, tone: "bg-accent text-accent-foreground" },
  ];

  return (
    <>
      <PageTitle title="Good evening, Rudra" sub="Here's how your household spending looks." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card-surface p-5 transition hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
              <div className={`grid size-9 place-items-center rounded-xl ${c.tone}`}><c.icon className="size-4.5" /></div>
            </div>
            <p className={`mt-3 font-bold tracking-tight ${c.small ? "text-lg" : "text-2xl"}`}>{c.value}</p>
            <p className="mt-1 text-xs">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Monthly spending by category</h3>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip cursor={{ fill: "var(--muted)" }} formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                {/* <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Dairy" stackId="a" fill="var(--chart-1)" />
                <Bar dataKey="Grains" stackId="a" fill="var(--chart-2)" />
                <Bar dataKey="Produce" stackId="a" fill="var(--chart-3)" />
                <Bar dataKey="Other" stackId="a" fill="var(--chart-4)" radius={[6, 6, 0, 0]} /> */}
                <Bar dataKey="total" name="Spend" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-surface flex flex-col p-5">
          <h3 className="mb-1 font-semibold">Quick upload</h3>
          <p className="mb-4 text-sm text-muted-foreground">Scan a new receipt in seconds.</p>
          <div className="flex-1"><Dropzone compact onFile={(f) => { setPendingFile(f); navigate({ to: "/upload" }); }} /></div>
        </div>
      </div>

      <div className="card-surface mt-4 overflow-hidden">
        <div className="flex items-center justify-between p-5"><h3 className="font-semibold">Recent scans</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-5 py-3">Store</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Items</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {receipts.slice(0, 6).map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer transition hover:bg-muted/40">
                  <td className="px-5 py-3.5 font-medium">{r.store}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{fmtDate(r.date)}</td>
                  <td className="px-5 py-3.5">{r.items.length}</td>
                  <td className="px-5 py-3.5 text-right font-semibold">{inr(r.total)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ReceiptPanel receipt={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Trend({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${up ? "text-destructive" : "text-mint"}`}>
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {Math.abs(v).toFixed(1)}% <span className="font-normal text-muted-foreground">vs last month</span>
    </span>
  );
}
