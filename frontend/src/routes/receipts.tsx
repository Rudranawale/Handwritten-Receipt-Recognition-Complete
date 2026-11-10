import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpDown, Download, FileJson, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageTitle, StatusBadge, btn, inputCls } from "@/components/AppShell";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { download, fmtDate, inr, toCSV, useReceipts, type Receipt } from "@/lib/receipts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/receipts")({
  head: () => ({
    meta: [
      { title: "Receipts Dataset — ReceiptIQ" },
      { name: "description", content: "Search, sort, filter and export every scanned receipt." },
      { property: "og:title", content: "Receipts Dataset — ReceiptIQ" },
      { property: "og:description", content: "Search, sort, filter and export every scanned receipt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceiptsPage,
});

type SortKey = "date" | "total";

function ReceiptsPage() {
  const receipts = useReceipts();
  const [q, setQ] = useState("");
  const [store, setStore] = useState("All");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [open, setOpen] = useState<Receipt | null>(null);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return receipts
      .filter((r) => store === "All" || r.store === store)
      .filter((r) => !s || r.store.toLowerCase().includes(s) || r.id.toLowerCase().includes(s) || r.items.some((i) => i.name.toLowerCase().includes(s)))
      .sort((a, b) => (sort.key === "date" ? a.date.localeCompare(b.date) : a.total - b.total) * sort.dir);
  }, [receipts, q, store, sort]);

  const toggle = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));
  const allStores = [...new Set([receipts.map((r) => r.store)])];

  return (
    <>
      <PageTitle
        title="Receipts Dataset"
        sub={`${rows.length} of ${receipts.length} receipts`}
        action={
          <div className="flex gap-2">
            <button className={btn.ghost} onClick={() => download("receipts.csv", toCSV(rows), "text/csv")}><Download className="size-4" /> Export CSV</button>
            <button className={btn.primary} onClick={() => download("receipts.json", JSON.stringify(rows.map(({ image: _i, ...r }) => r), null, 2), "application/json")}><FileJson className="size-4" /> Download JSON</button>
          </div>
        }
      />
      <div className="card-surface overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input className={cn(inputCls, "pl-9")} placeholder="Search store, item or receipt ID…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={cn(inputCls, "w-auto")} value={store} onChange={(e) => setStore(e.target.value)}>
            <option>All</option>
            {allStores.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Store</th>
                <th className="px-5 py-3"><button onClick={() => toggle("date")} className="inline-flex items-center gap-1 uppercase hover:text-foreground">Date <ArrowUpDown className="size-3" /></button></th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">GST</th>
                <th className="px-5 py-3 text-right"><button onClick={() => toggle("total")} className="inline-flex items-center gap-1 uppercase hover:text-foreground">Total <ArrowUpDown className="size-3" /></button></th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer transition hover:bg-muted/40">
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{r.id}</td>
                  <td className="px-5 py-3.5 font-medium">{r.store}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{fmtDate(r.date)}</td>
                  <td className="px-5 py-3.5" title={r.items.map((i) => i.name).join(", ")}>{r.items.length}</td>
                  <td className="px-5 py-3.5">{inr(r.gst)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold">{inr(r.total)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No receipts match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <ReceiptPanel receipt={open} onClose={() => setOpen(null)} />
    </>
  );
}
