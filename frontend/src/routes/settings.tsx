
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  BarChart3,
  Store,
  ReceiptText,
  SlidersHorizontal,
  ShieldCheck,
  Languages,
  Calculator,
  TrendingUp,
} from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { inr, useReceipts } from "@/lib/receipts";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Analytics — ReceiptIQ" },
      {
        name: "description",
        content: "ReceiptIQ spending insights and scanning preferences.",
      },
      {
        property: "og:title",
        content: "Settings & Analytics — ReceiptIQ",
      },
    ],
  }),
  component: SettingsPage,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--muted-foreground)",
  "var(--accent-foreground)",
];

function SettingsPage() {
  const receipts = useReceipts();

  const [prefs, setPrefs] = useState({
    autoVerify: false,
    hindi: true,
    gst: true,
  });

  const byCat = useMemo(() => {
    const m: Record<string, number> = {};

    for (const r of receipts) {
      for (const i of r.items ?? []) {
        m[i.name] = (m[i.name] ?? 0) + i.qty * i.price;
      }
    }

    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [receipts]);

  const byStore = useMemo(() => {
    const m: Record<string, number> = {};

    for (const r of receipts) {
      const store = r.store || "Unknown Store";
      m[store] = (m[store] ?? 0) + r.total;
    }

    const max = Math.max(1, ...Object.values(m));

    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({
        name,
        v,
        pct: (v / max) * 100,
      }));
  }, [receipts]);

  const totalItemSpend = byCat.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const totalStoreSpend = byStore.reduce(
    (sum, store) => sum + store.v,
    0
  );

  const preferenceItems = [
    {
      key: "autoVerify",
      title: "Auto-verify high-confidence scans",
      description:
        "Skip manual review when extraction confidence is above 95%.",
      icon: ShieldCheck,
      tag: "Verification",
    },
    {
      key: "hindi",
      title: "Hindi / Hinglish recognition",
      description:
        "Read item names written in Devanagari or transliterated Hindi.",
      icon: Languages,
      tag: "Language",
    },
    {
      key: "gst",
      title: "Auto-calculate GST",
      description:
        "Fill in 5% GST when it isn't written on the receipt.",
      icon: Calculator,
      tag: "Tax",
    },
  ] as const;

  return (
    <div className="space-y-7">
      <PageTitle
        title="Settings & Analytics"
        sub="Your spending insights and receipt scanning preferences."
      />

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card-surface flex items-center gap-4 p-5">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ReceiptText className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Receipts processed
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {receipts.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Total saved receipts
            </p>
          </div>
        </div>

        <div className="card-surface flex items-center gap-4 p-5">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <TrendingUp className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Total store spending
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {inr(totalStoreSpend)}
            </p>
            <p className="text-xs text-muted-foreground">
              Calculated from saved receipts
            </p>
          </div>
        </div>
      </div>

      {/* Analytics heading */}
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 text-primary" />
        <h3 className="text-lg font-bold tracking-tight">
          Spending insights
        </h3>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Item spending */}
        <section className="card-surface min-w-0 p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold">
                Top items by spending
              </h3>
              <p className="text-xs text-muted-foreground">
                Highest spending items in saved receipts
              </p>
            </div>
          </div>

          {byCat.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-2 text-center">
              <ReceiptText className="size-9 text-muted-foreground" />
              <p className="font-medium">No item data available</p>
              <p className="text-sm text-muted-foreground">
                Upload receipts to see your spending breakdown.
              </p>
            </div>
          ) : (
            <>
              <div className="relative mx-auto mt-4 h-60 w-full max-w-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCat}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={68}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {byCat.map((item, i) => (
                        <Cell
                          key={item.name}
                          fill={COLORS[i % COLORS.length]}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => inr(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    Top 6 items
                  </span>
                  <span className="text-xl font-bold">
                    {inr(totalItemSpend)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Total value
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {byCat.map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{
                        background: COLORS[i % COLORS.length],
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {totalItemSpend
                        ? ((item.value / totalItemSpend) * 100).toFixed(1)
                        : 0}%
                    </span>
                    <span className="font-semibold tabular-nums">
                      {inr(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Store spending */}
        <section className="card-surface min-w-0 p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Store className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold">
                Spending by store
              </h3>
              <p className="text-xs text-muted-foreground">
                Compare total spending across stores
              </p>
            </div>
          </div>

          {byStore.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-2 text-center">
              <Store className="size-9 text-muted-foreground" />
              <p className="font-medium">No store data available</p>
              <p className="text-sm text-muted-foreground">
                Your store comparison will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-7 space-y-6">
              {byStore.map((store, i) => (
                <div key={store.name}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {store.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {inr(store.v)}
                    </span>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="brand-gradient h-full rounded-full transition-all duration-500"
                      style={{ width: `${store.pct}%` }}
                    />
                  </div>

                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {store.pct.toFixed(1)}% of highest store spending
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Preferences */}
      <section className="card-surface overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-5 sm:p-6">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <SlidersHorizontal className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">Scanning preferences</h3>
            <p className="text-xs text-muted-foreground">
              Configure your receipt scanning experience
            </p>
          </div>
        </div>

        <div className="divide-y divide-border px-5 sm:px-6">
          {preferenceItems.map((item) => {
            const Icon = item.icon;
            const enabled = prefs[item.key];

            return (
              <div
                key={item.key}
                className="flex items-center gap-4 py-5"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {item.title}
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-label={item.title}
                  aria-checked={enabled}
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      [item.key]: !p[item.key],
                    }))
                  }
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    enabled ? "bg-primary" : "bg-input"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-card shadow transition-all",
                      enabled ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        ReceiptIQ · Your handwritten receipts, organized intelligently.
      </p>
    </div>
  );
}







// import { createFileRoute } from "@tanstack/react-router";
// import { useMemo, useState } from "react";
// import {
//   Cell,
//   Pie,
//   PieChart,
//   ResponsiveContainer,
//   Tooltip,
// } from "recharts";
// import { PageTitle } from "@/components/AppShell";
// import { cn } from "@/lib/utils";
// import { inr, useReceipts } from "@/lib/receipts";

// export const Route = createFileRoute("/settings")({
//   head: () => ({
//     meta: [
//       { title: "Settings & Analytics — ReceiptIQ" },
//       {
//         name: "description",
//         content:
//           "Category breakdown, store analytics and scanning preferences.",
//       },
//     ],
//   }),
//   component: SettingsPage,
// });

// const COLORS = [
//   "var(--chart-1)",
//   "var(--chart-2)",
//   "var(--chart-3)",
//   "var(--chart-4)",
//   "var(--muted-foreground)",
//   "var(--accent-foreground)",
// ];

// function SettingsPage() {
//   const receipts = useReceipts();

//   const [prefs, setPrefs] = useState({
//     autoVerify: false,
//     hindi: true,
//     gst: true,
//   });

//   // Spending by item
//   const byCat = useMemo(() => {
//     const m: Record<string, number> = {};

//     for (const r of receipts) {
//       for (const i of r.items ?? []) {
//         m[i.name] = (m[i.name] ?? 0) + i.qty * i.price;
//       }
//     }

//     return Object.entries(m)
//       .sort((a, b) => b[1] - a[1])
//       .slice(0, 6)
//       .map(([name, value]) => ({ name, value }));
//   }, [receipts]);

//   // Spending by store
//   const byStore = useMemo(() => {
//     const m: Record<string, number> = {};

//     for (const r of receipts) {
//       const store = r.store || "Unknown Store";
//       m[store] = (m[store] ?? 0) + r.total;
//     }

//     const max = Math.max(1, ...Object.values(m));

//     return Object.entries(m)
//       .sort((a, b) => b[1] - a[1])
//       .map(([name, v]) => ({
//         name,
//         v,
//         pct: (v / max) * 100,
//       }));
//   }, [receipts]);

//   return (
//     <>
//       <PageTitle
//         title="Settings & Analytics"
//         sub="Understand your spending patterns and tune scanning."
//       />

//       <div className="grid gap-4 lg:grid-cols-2">
//         {/* Spending by item */}
//         <div className="card-surface p-5">
//           <h3 className="font-semibold">Spend by category</h3>

//           {byCat.length === 0 ? (
//             <p className="py-12 text-sm text-muted-foreground">
//               No spending data available yet.
//             </p>
//           ) : (
//             <div className="flex flex-wrap items-center gap-6">
//               <div className="h-60 w-60">
//                 <ResponsiveContainer width="100%" height="100%">
//                   <PieChart>
//                     <Pie
//                       data={byCat}
//                       dataKey="value"
//                       innerRadius={60}
//                       outerRadius={95}
//                       paddingAngle={3}
//                     >
//                       {byCat.map((_, i) => (
//                         <Cell
//                           key={i}
//                           fill={COLORS[i % COLORS.length]}
//                           stroke="none"
//                         />
//                       ))}
//                     </Pie>
//                     <Tooltip formatter={(v: number) => inr(v)} />
//                   </PieChart>
//                 </ResponsiveContainer>
//               </div>

//               <ul className="space-y-2 text-sm">
//                 {byCat.map((c, i) => (
//                   <li
//                     key={c.name}
//                     className="flex items-center gap-2"
//                   >
//                     <span
//                       className="size-2.5 rounded-full"
//                       style={{
//                         background: COLORS[i % COLORS.length],
//                       }}
//                     />
//                     {c.name}
//                     <span className="ml-auto pl-4 font-semibold">
//                       {inr(c.value)}
//                     </span>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>

//         {/* Spending by store */}
//         <div className="card-surface p-5">
//           <h3 className="mb-4 font-semibold">Spend by store</h3>

//           {byStore.length === 0 ? (
//             <p className="py-12 text-sm text-muted-foreground">
//               No store data available yet.
//             </p>
//           ) : (
//             <div className="space-y-4">
//               {byStore.map((s) => (
//                 <div key={s.name}>
//                   <div className="mb-1 flex justify-between text-sm">
//                     <span>{s.name}</span>
//                     <span className="font-semibold">
//                       {inr(s.v)}
//                     </span>
//                   </div>

//                   <div className="h-2 rounded-full bg-muted">
//                     <div
//                       className="brand-gradient h-full rounded-full"
//                       style={{ width: `${s.pct}%` }}
//                     />
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>

//         {/* Scanning preferences */}
//         <div className="card-surface p-5 lg:col-span-2">
//           <h3 className="mb-2 font-semibold">
//             Scanning preferences
//           </h3>

//           {(
//             [
//               [
//                 "autoVerify",
//                 "Auto-verify high-confidence scans",
//                 "Skip manual review when extraction confidence is above 95%.",
//               ],
//               [
//                 "hindi",
//                 "Hindi / Hinglish recognition",
//                 "Read item names written in Devanagari or transliterated Hindi.",
//               ],
//               [
//                 "gst",
//                 "Auto-calculate GST",
//                 "Fill in 5% GST when it isn't written on the receipt.",
//               ],
//             ] as const
//           ).map(([k, t, d]) => (
//             <div
//               key={k}
//               className="flex items-center justify-between gap-4 border-t border-border py-4 first:border-0"
//             >
//               <div>
//                 <p className="font-medium">{t}</p>
//                 <p className="text-sm text-muted-foreground">{d}</p>
//               </div>

//               <button
//                 type="button"
//                 role="switch"
//                 aria-checked={prefs[k]}
//                 onClick={() =>
//                   setPrefs((p) => ({
//                     ...p,
//                     [k]: !p[k],
//                   }))
//                 }
//                 className={cn(
//                   "relative h-6 w-11 shrink-0 rounded-full transition",
//                   prefs[k] ? "bg-primary" : "bg-input"
//                 )}
//               >
//                 <span
//                   className={cn(
//                     "absolute top-0.5 size-5 rounded-full bg-card shadow transition-all",
//                     prefs[k] ? "left-[22px]" : "left-0.5"
//                   )}
//                 />
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>
//     </>
//   );
// }


