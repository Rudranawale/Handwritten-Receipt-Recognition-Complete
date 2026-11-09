// import { useSyncExternalStore } from "react";

// export type Item = { name: string; qty: number; price: number; category: Category };
// export type Category = "Dairy" | "Grains" | "Produce" | "Snacks" | "Household" | "Spices";
// export type Receipt = {
//   id: string;
//   store: string;
//   date: string; // YYYY-MM-DD
//   items: Item[];
//   gst: number;
//   total: number;
//   status: "Processed" | "Verified";
//   image?: string;
// };

// export const CATEGORIES: Category[] = ["Dairy", "Grains", "Produce", "Snacks", "Household", "Spices"];

// const CATALOG: Record<string, [Category, number]> = {
//   "Amul Milk 1L": ["Dairy", 66],
//   Paneer: ["Dairy", 90],
//   Curd: ["Dairy", 45],
//   Butter: ["Dairy", 58],
//   "Atta 5kg": ["Grains", 245],
//   "Basmati Rice 1kg": ["Grains", 120],
//   "Toor Dal": ["Grains", 160],
//   Onion: ["Produce", 40],
//   Tomato: ["Produce", 35],
//   Potato: ["Produce", 30],
//   "Parle-G": ["Snacks", 10],
//   Namkeen: ["Snacks", 55],
//   "Surf Excel": ["Household", 130],
//   "Vim Bar": ["Household", 20],
//   Haldi: ["Spices", 38],
//   "Garam Masala": ["Spices", 72],
// };
// export const STORES = ["Gupta Kirana Store", "Sharma General Store", "Patel Provisions", "Shree Ram Traders", "Fresh Mart"];

// let seed = 7;
// const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

// export function makeItems(n: number): Item[] {
//   const names = Object.keys(CATALOG);
//   const picked = new Set<string>();
//   while (picked.size < n) picked.add(names[Math.floor(rand() * names.length)]!);
//   return [...picked].map((name) => {
//     const [category, base] = CATALOG[name]!;
//     return { name, category, qty: 1 + Math.floor(rand() * 3), price: Math.round(base * (0.9 + rand() * 0.25)) };
//   });
// }

// export const subtotal = (items: Item[]) => items.reduce((s, i) => s + i.qty * i.price, 0);

// function build(id: number, store: string, date: string, status: Receipt["status"]): Receipt {
//   const items = makeItems(3 + Math.floor(rand() * 5));
//   const sub = subtotal(items);
//   const gst = Math.round(sub * 0.05);
//   return { id: `RC-${1000 + id}`, store, date, items, gst, total: sub + gst, status };
// }

// const SEED: Receipt[] = Array.from({ length: 34 }, (_, i) => {
//   const month = 4 + Math.floor(i / 6); // May..Oct 2026
//   const day = 1 + ((i * 5) % 27);
//   const store = i % 3 === 0 ? STORES[0]! : STORES[Math.floor(rand() * STORES.length)]!;
//   return build(i, store, `2026-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, i % 4 === 0 ? "Processed" : "Verified");
// }).sort((a, b) => b.date.localeCompare(a.date));

// let receipts = SEED;
// const listeners = new Set<() => void>();
// const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

// export function useReceipts() {
//   return useSyncExternalStore(subscribe, () => receipts, () => SEED);
// }
// export function addReceipt(r: Receipt) {
//   receipts = [r, ...receipts];
//   listeners.forEach((l) => l());
// }
// export function nextId() {
//   return `RC-${1000 + receipts.length + Math.floor(Math.random() * 900)}`;
// }

// export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
// export const fmtDate = (d: string) =>
//   new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// export function monthlyByCategory(list: Receipt[]) {
//   const map = new Map<string, Record<string, number | string>>();
//   for (const r of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
//     const key = new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" });
//     const row = map.get(key) ?? { month: key, Dairy: 0, Grains: 0, Produce: 0, Other: 0 };
//     for (const i of r.items) {
//       const k = ["Dairy", "Grains", "Produce"].includes(i.category) ? i.category : "Other";
//       row[k] = (row[k] as number) + i.qty * i.price;
//     }
//     map.set(key, row);
//   }
//   return [...map.values()];
// }

// export function toCSV(list: Receipt[]) {
//   const rows = [["id", "store", "date", "item", "category", "qty", "price", "gst", "total", "status"]];
//   for (const r of list)
//     for (const i of r.items) rows.push([r.id, r.store, r.date, i.name, i.category, String(i.qty), String(i.price), String(r.gst), String(r.total), r.status]);
//   return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
// }

// export function download(name: string, content: string, type: string) {
//   const url = URL.createObjectURL(new Blob([content], { type }));
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = name;
//   a.click();
//   URL.revokeObjectURL(url);
// }

// /* ---------- Natural-language query engine (works offline over the dataset) ---------- */
// export type Answer = { text: string; table?: { head: string[]; rows: string[][] } };

// const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// const HINDI: Record<string, string> = { doodh: "dairy", "दूध": "dairy", aata: "atta", "आटा": "atta", chawal: "rice", kitna: "how much", "कितना": "how much", kharcha: "spend" };

// export function answerQuery(q: string, list: Receipt[]): Answer {
//   let s = q.toLowerCase();
//   for (const [h, e] of Object.entries(HINDI)) s = s.replaceAll(h, e);

//   let scoped = list;
//   const latest = list[0]?.date.slice(0, 7);
//   const mIdx = MONTHS.findIndex((m) => new RegExp(`\\b${m}`).test(s));
//   if (s.includes("this month") && latest) scoped = scoped.filter((r) => r.date.startsWith(latest));
//   else if (mIdx >= 0) scoped = scoped.filter((r) => Number(r.date.slice(5, 7)) === mIdx + 1);
//   const monthLabel = s.includes("this month") ? "this month" : mIdx >= 0 ? `in ${MONTHS[mIdx]!.charAt(0).toUpperCase() + MONTHS[mIdx]!.slice(1)}` : "overall";

//   const store = STORES.find((st) => s.includes(st.split(" ")[0]!.toLowerCase()));
//   if (store) scoped = scoped.filter((r) => r.store === store);

//   const cat = CATEGORIES.find((c) => s.includes(c.toLowerCase()));
//   const itemName = Object.keys(CATALOG).find((n) => s.includes(n.split(" ")[0]!.toLowerCase()));

//   if ((s.includes("highest") || s.includes("max") || s.includes("most expensive")) && itemName) {
//     const hits = scoped.flatMap((r) => r.items.filter((i) => i.name === itemName).map((i) => ({ r, i })));
//     if (!hits.length) return { text: `I couldn't find any purchases of ${itemName}.` };
//     hits.sort((a, b) => b.i.price - a.i.price);
//     const top = hits[0]!;
//     return {
//       text: `The highest price paid for ${itemName} was ${inr(top.i.price)} at ${top.r.store} on ${fmtDate(top.r.date)}.`,
//       table: { head: ["Date", "Store", "Price"], rows: hits.slice(0, 5).map((h) => [fmtDate(h.r.date), h.r.store, inr(h.i.price)]) },
//     };
//   }

//   if (cat && (s.includes("spend") || s.includes("how much") || s.includes("spent"))) {
//     const lines = scoped.flatMap((r) => r.items.filter((i) => i.category === cat).map((i) => ({ r, i })));
//     const sum = lines.reduce((a, l) => a + l.i.qty * l.i.price, 0);
//     return {
//       text: `You spent ${inr(sum)} on ${cat.toLowerCase()} ${monthLabel}${store ? ` at ${store}` : ""} across ${lines.length} line items.`,
//       table: { head: ["Item", "Qty", "Amount"], rows: Object.entries(lines.reduce<Record<string, [number, number]>>((acc, l) => {
//         const v = acc[l.i.name] ?? [0, 0];
//         acc[l.i.name] = [v[0] + l.i.qty, v[1] + l.i.qty * l.i.price];
//         return acc;
//       }, {})).map(([n, [q2, a]]) => [n, String(q2), inr(a)]) },
//     };
//   }

//   if (s.includes("show") || s.includes("receipt") || s.includes("list") || store) {
//     return {
//       text: `Found ${scoped.length} receipt${scoped.length === 1 ? "" : "s"}${store ? ` from ${store}` : ""} ${monthLabel}, totalling ${inr(scoped.reduce((a, r) => a + r.total, 0))}.`,
//       table: { head: ["ID", "Date", "Store", "Total"], rows: scoped.slice(0, 8).map((r) => [r.id, fmtDate(r.date), r.store, inr(r.total)]) },
//     };
//   }

//   if (s.includes("spend") || s.includes("how much") || s.includes("total")) {
//     const sum = scoped.reduce((a, r) => a + r.total, 0);
//     return { text: `Your total spend ${monthLabel} is ${inr(sum)} across ${scoped.length} receipts.` };
//   }

//   return { text: "I can answer questions about spend by category, store, month, or item prices. Try one of the suggestions above." };
// }
import { useEffect, useSyncExternalStore } from "react";
import { API_URL } from "@/lib/api";

export type Item = { name: string; qty: number; price: number };
export type Receipt = {
  id: string; // display id, e.g. RC-1007
  dbId: number; // MySQL id (used for updates)
  store: string;
  date: string; // YYYY-MM-DD
  items: Item[];
  gst: number;
  total: number;
  status: "Processed" | "Verified";
  image?: string;
};

// Kept only so older pages (receipts.tsx / settings.tsx) don't crash until they are updated.
export const CATEGORIES: string[] = [];
export const STORES: string[] = [];

/* ---------- live data from the FastAPI backend ---------- */
type ApiReceipt = Omit<Receipt, "image"> & { image?: string };

const EMPTY: Receipt[] = [];
let receipts: Receipt[] = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
const emit = () => listeners.forEach((l) => l());

export function refreshReceipts(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetch(`${API_URL}/receipts`)
    .then((res) => {
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      return res.json() as Promise<ApiReceipt[]>;
    })
    .then((data) => {
      receipts = data.map((r) => ({ ...r, image: r.image ? `${API_URL}${r.image}` : undefined }));
      emit();
    })
    .catch((e) => console.error("Could not load receipts:", e))
    .finally(() => { inflight = null; });
  return inflight;
}

let requested = false;
export function useReceipts() {
  useEffect(() => {
    if (!requested) { requested = true; void refreshReceipts(); }
  }, []);
  return useSyncExternalStore(subscribe, () => receipts, () => EMPTY);
}

export type SavePayload = { store: string; date: string; gst: number; total: number; items: Item[] };

export async function saveReceipt(dbId: number, payload: SavePayload) {
  const res = await fetch(`${API_URL}/receipts/${dbId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = "Could not save receipt";
    try { detail = (await res.json()).detail ?? detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  await refreshReceipts();
}

/* ---------- helpers ---------- */
export const subtotal = (items: Item[]) => items.reduce((s, i) => s + i.qty * i.price, 0);

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
export const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function monthlySpend(list: Receipt[]) {
  const map = new Map<string, { month: string; total: number }>();
  for (const r of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = r.date.slice(0, 7);
    const label = new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" });
    const row = map.get(key) ?? { month: label, total: 0 };
    row.total += r.total;
    map.set(key, row);
  }
  return [...map.values()].slice(-6);
}

export function toCSV(list: Receipt[]) {
  const rows = [["id", "store", "date", "item", "qty", "price", "gst", "total", "status"]];
  for (const r of list)
    for (const i of r.items) rows.push([r.id, r.store, r.date, i.name, String(i.qty), String(i.price), String(r.gst), String(r.total), r.status]);
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

