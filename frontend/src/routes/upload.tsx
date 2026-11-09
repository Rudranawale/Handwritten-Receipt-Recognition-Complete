import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Plus, Trash2, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageTitle, btn, inputCls } from "@/components/AppShell";
import { Dropzone } from "@/components/Dropzone";
import { API_URL } from "@/lib/api";
import { inr, refreshReceipts, saveReceipt, subtotal, type Item } from "@/lib/receipts";
import { takePendingFile } from "@/lib/pending";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload & Scan Receipts — SpendIQ" },
      { name: "description", content: "Upload handwritten receipts and review AI-extracted items, GST and totals." },
      { property: "og:title", content: "Upload & Scan Receipts — SpendIQ" },
      { property: "og:description", content: "Upload handwritten receipts and review AI-extracted data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

const STEPS = ["Grayscale", "Text Detection", "Parsing OCR", "Saving to DB"];

type Draft = { store: string; date: string; items: Item[]; gst: number };

// ── JSON returned by POST /upload ─────────────────────────────────────────
interface StructuredItem { name: string; quantity: number | null; rate: number | null; amount: number | null }
interface Structured {
  shop: string | null;
  date: string | null;
  items: StructuredItem[];
  total: number | null;
  tax: number | null;
}
interface UploadResponse {
  receipt_id: number;
  filename: string;
  structured: Structured | null;
  ocr: { full_text: string };
}

// "03/11/2026", "3-11-26", "3 Nov 2026"  ->  "2026-11-03"  ("" if unreadable)
function toISODate(raw?: string | null): string {
  if (!raw) return "";
  const t = raw.trim();
  const m = t.replace(/\s+/g, "").replace(/[/.]/g, "-").match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]);
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return "";
  }
  const p = new Date(t + " UTC");
  return isNaN(p.getTime()) ? "" : p.toISOString().slice(0, 10);
}

function toDraft(s: Structured | null): Draft {
  if (!s) return { store: "", date: "", gst: 0, items: [{ name: "", qty: 1, price: 0 }] };
  const items: Item[] = s.items.map((i) => {
    const qty = i.quantity && i.quantity > 0 ? i.quantity : 1;
    const price = i.rate ?? (i.amount != null ? i.amount / qty : 0);
    return { name: i.name, qty, price: Math.round(price * 100) / 100 };
  });
  return {
    store: s.shop ?? "",
    date: toISODate(s.date),
    gst: s.tax ?? 0,
    items: items.length ? items : [{ name: "", qty: 1, price: 0 }],
  };
}

function UploadPage() {
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const start = async (f: File) => {
    if (!f.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Image must be smaller than 10 MB"); return; }

    setImage(null);
    setDraft(null);
    setReceiptId(null);
    setStep(0);

    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(f);

    try {
      const formData = new FormData();
      formData.append("file", f);
      const response = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });

      if (!response.ok) {
        let detail = "Upload failed";
        try { detail = (await response.json()).detail ?? detail; } catch { /* ignore */ }
        throw new Error(detail);
      }

      const result: UploadResponse = await response.json();
      setReceiptId(result.receipt_id);
      setDraft(toDraft(result.structured));
      setStep(3);
      void refreshReceipts();
      if (result.structured) toast.success("Receipt scanned. Please review the details.");
      else toast.warning("Receipt saved, but details could not be extracted. Please fill them in.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Could not process receipt: ${msg}`);
      setStep(-1);
      setImage(null);
    }
  };

  // File queued from the Overview page
  useEffect(() => {
    const f = takePendingFile();
    if (f) void start(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate the first steps; it waits at "Parsing OCR" until the backend replies
  useEffect(() => {
    if (step < 0 || step >= 2) return;
    const t = setTimeout(() => setStep((s) => (s >= 0 && s < 2 ? s + 1 : s)), 900);
    return () => clearTimeout(t);
  }, [step]);

  const reset = () => { setImage(null); setStep(-1); setDraft(null); setReceiptId(null); };
  const setItem = (i: number, patch: Partial<Item>) =>
    draft && setDraft({ ...draft, items: draft.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });

  const done = step >= 3;

  const save = async () => {
    if (!draft || receiptId == null) return;
    if (!draft.store.trim()) { toast.error("Shop name is required"); return; }
    setSaving(true);
    try {
      await saveReceipt(receiptId, {
        store: draft.store.trim(),
        date: draft.date,
        gst: draft.gst,
        total: subtotal(draft.items) + draft.gst,
        items: draft.items,
      });
      toast.success("Receipt saved to your dataset");
      navigate({ to: "/receipts" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save receipt");
    } finally {
      setSaving(false);
    }
  };

  if (!image && step < 0) {
    return (
      <>
        <PageTitle title="Upload & Scan" sub="Our AI reads handwritten receipts and turns them into structured data." />
        <div className="card-surface p-4"><Dropzone onFile={start} /></div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Upload & Scan"
        sub="Review the extracted details before saving."
        action={<button onClick={reset} className={btn.ghost}><RotateCcw className="size-4" /> New scan</button>}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card-surface p-5 lg:col-span-2">
          <div className="relative overflow-hidden rounded-xl bg-muted">
            {image && (
              <img src={image} alt="Uploaded receipt" className={cn("max-h-[460px] w-full object-contain transition", step === 0 && "grayscale")} />
            )}
            {!done && <div className="scan-line brand-gradient glow absolute inset-x-0 h-1" />}
          </div>
          <ol className="mt-5 space-y-3">
            {STEPS.map((s, i) => {
              const state = step > i || done ? "done" : step === i ? "active" : "idle";
              return (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className={cn(
                    "grid size-7 place-items-center rounded-full text-xs font-bold transition",
                    state === "done" ? "bg-mint text-primary-foreground"
                      : state === "active" ? "bg-violet-soft text-primary"
                      : "bg-muted text-muted-foreground",
                  )}>
                    {state === "done" ? <Check className="size-4" />
                      : state === "active" ? <Loader2 className="size-4 animate-spin" />
                      : i + 1}
                  </span>
                  <span className={cn(state === "idle" && "text-muted-foreground", state !== "idle" && "font-medium")}>{s}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="card-surface p-5 lg:col-span-3">
          <h3 className="font-semibold">Extracted data</h3>
          {!draft ? (
            <div className="mt-6 space-y-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Shop name</span>
                  <input className={inputCls} value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value })} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Date</span>
                  <input type="date" className={inputCls} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                </label>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Items (from OCR)</span>
                  <button
                    onClick={() => setDraft({ ...draft, items: [...draft.items, { name: "", qty: 1, price: 0 }] })}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                  >
                    <Plus className="size-4" /> Add item
                  </button>
                </div>
                <div className="mb-1 grid grid-cols-12 gap-2 px-1 text-xs uppercase tracking-wider text-muted-foreground">
                  <span className="col-span-6">Item</span><span className="col-span-2">Qty</span><span className="col-span-3">Price (₹)</span>
                </div>
                <div className="space-y-2">
                  {draft.items.map((it, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <input className={cn(inputCls, "col-span-6")} placeholder="Item" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                      <input type="number" min={1} className={cn(inputCls, "col-span-2 px-2")} value={it.qty} onChange={(e) => setItem(i, { qty: Math.max(1, Number(e.target.value)) })} />
                      <input type="number" min={0} className={cn(inputCls, "col-span-3")} value={it.price} onChange={(e) => setItem(i, { price: Math.max(0, Number(e.target.value)) })} />
                      <button
                        onClick={() => setDraft({ ...draft, items: draft.items.filter((_, k) => k !== i) })}
                        className="col-span-1 grid place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-muted/50 p-4">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">GST (₹)</span>
                  <input type="number" className={cn(inputCls, "w-32")} value={draft.gst} onChange={(e) => setDraft({ ...draft, gst: Math.max(0, Number(e.target.value)) })} />
                </label>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{inr(subtotal(draft.items) + draft.gst)}</p>
                </div>
              </div>
              <button onClick={save} disabled={!done || saving} className={cn(btn.primary, "w-full")}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save receipt
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}





// import { createFileRoute, useNavigate } from "@tanstack/react-router";
// import { Check, Loader2, Plus, Trash2, RotateCcw, Save } from "lucide-react";
// import { useEffect, useRef, useState } from "react";
// import { toast } from "sonner";
// import { PageTitle, btn, inputCls } from "@/components/AppShell";
// import { Dropzone } from "@/components/Dropzone";
// import { addReceipt, CATEGORIES, inr, nextId, subtotal, type Item } from "@/lib/receipts";
// import { takePendingFile } from "@/lib/pending";
// import { cn } from "@/lib/utils";

// export const Route = createFileRoute("/upload")({
//   head: () => ({
//     meta: [
//       { title: "Upload & Scan Receipts — SpendIQ" },
//       { name: "description", content: "Upload handwritten receipts and review AI-extracted items, GST and totals." },
//       { property: "og:title", content: "Upload & Scan Receipts — SpendIQ" },
//       { property: "og:description", content: "Upload handwritten receipts and review AI-extracted data." },
//       { property: "og:type", content: "website" },
//       { name: "twitter:card", content: "summary" },
//     ],
//   }),
//   component: UploadPage,
// });

// // Progress step labels shown in the sidebar while scanning
// const STEPS = ["Grayscale", "Text Detection", "Parsing OCR", "Saving to DB"];

// type Draft = { store: string; date: string; items: Item[]; gst: number };

// // ── Shape of the JSON response from POST /upload ──────────────────────────
// interface OcrDetection {
//   text: string;
//   confidence: number;
//   bounding_box: number[][];
// }
// interface UploadResponse {
//   message: string;
//   filename: string;
//   size_bytes: number;
//   status: string;
//   ocr: {
//     full_text: string;
//     detected_text: OcrDetection[];
//   };
// }

// // ── Convert raw OCR text lines into editable draft items ──────────────────
// // This is a simple heuristic: treat each high-confidence detected line as
// // one receipt "item".  The user can edit all fields after the scan.
// function ocrToItems(detections: OcrDetection[]): Item[] {
//   return detections
//     .filter((d) => d.confidence >= 0.3)          // skip very low-confidence noise
//     .map((d) => ({
//       name: d.text,
//       qty: 1,
//       price: 0,                                   // user fills in price
//       category: "Grains" as Item["category"],
//     }))
//     .filter((item) => item.name.trim().length > 0)
//     .slice(0, 20);                                // cap at 20 rows
// }

// function UploadPage() {
//   // const navigate = useNavigate();
//   // const [image, setImage] = useState<string | null>(null);
//   // const [step, setStep] = useState(-1);
//   // const [draft, setDraft] = useState<Draft | null>(null);
//   // // Store the real OCR response so we can use it when the animation finishes
//   // const ocrResponseRef = useRef<UploadResponse | null>(null);
//   const [image, setImage] = useState<string | null>(null);
//   const [step, setStep] = useState(-1);
//   const [draft, setDraft] = useState<Draft | null>(null);
//   const [ocrResponse, setOcrResponse] = useState<UploadResponse | null>(null);
  
  
//   // Called when a file is dropped or selected
//   const start = async (f: File) => {
//     if (!f.type.startsWith("image/")) {
//       toast.error("Please upload an image file");
//       return;
//     }
//     if (f.size > 10 * 1024 * 1024) {
//       toast.error("Image must be smaller than 10 MB");
//       return;
//     }

//     // Reset state for a fresh scan
//     setImage(null);
//     setDraft(null);
//     // ocrResponseRef.current = null;
//     setOcrResponse(null);
//     setStep(0);  // start the animation

//     // Show image preview immediately
//     const reader = new FileReader();
//     reader.onload = () => setImage(reader.result as string);
//     reader.readAsDataURL(f);

//     // POST the image to the FastAPI backend
//     try {
//       const formData = new FormData();
//       formData.append("file", f);

//       const response = await fetch("http://127.0.0.1:8000/upload", {
//         method: "POST",
//         body: formData,
//       });

//       if (!response.ok) {
//         // Parse error detail from FastAPI's JSON error body
//         let detail = "Upload failed";
//         try {
//           const errBody = await response.json();
//           detail = errBody.detail ?? detail;
//         } catch {
//           // ignore parse failure
//         }
//         throw new Error(detail);
//       }

//       const result: UploadResponse = await response.json();
//       console.log("Backend OCR response:", result);

//       // Store the OCR result; the useEffect below will apply it
//       // once the animation reaches step 2 (Parsing OCR)
//       // ocrResponseRef.current = result;
//       setOcrResponse(result);
//       toast.success("Receipt processed successfully!");
//     } catch (error) {
//       console.error("Upload error:", error);
//       const msg = error instanceof Error ? error.message : "Unknown error";
//       toast.error(`Could not process receipt: ${msg}`);
//       // Reset the UI so the user can try again
//       setStep(-1);
//       setImage(null);
//     }
//   };

//   // Trigger start() for any file that was queued from the overview page
//   useEffect(() => {
//     const f = takePendingFile();
//     if (f) start(f);
//   }, []);

//   // Animate through processing steps.
//   // At step 2 ("Parsing OCR"), populate the draft from the real OCR result
//   // instead of generating random fake data.
//   useEffect(() => {
//     if (step < 0 || step >= 3) return;
//     const t = setTimeout(() => {
//       if (step === 2) {
//         // const ocr = ocrResponseRef.current;
//         const ocr = ocrResponse;
//         if (ocr) {
//           // Build draft from actual EasyOCR output
//           const items = ocrToItems(ocr.ocr.detected_text);
//           setDraft({
//             store: "",                               // user fills in store name
//             date: new Date().toISOString().slice(0, 10),
//             items: items.length > 0
//               ? items
//               : [{ name: ocr.ocr.full_text.slice(0, 60) || "Item 1", qty: 1, price: 0, category: "Grains" }],
//             gst: 0,
//           });
//         } else {
//           // Backend hasn't responded yet – wait an extra second and try again
//           setStep(2);
//           return;
//         }
//       }
//       setStep((s) => s + 1);
//     }, 900);
//     return () => clearTimeout(t);
//   // }, [step]);
//   }, [step, ocrResponse]);

//   const reset = () => { setImage(null); setStep(-1); setDraft(null); ocrResponseRef.current = null; };
//   const setItem = (i: number, patch: Partial<Item>) =>
//     draft && setDraft({ ...draft, items: draft.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });

//   const save = () => {
//     if (!draft) return;
//     if (!draft.store.trim()) { toast.error("Shop name is required"); return; }
//     addReceipt({
//       id: nextId(),
//       ...draft,
//       total: subtotal(draft.items) + draft.gst,
//       status: "Verified",
//       ...(image ? { image } : {}),
//     });
//     toast.success("Receipt saved to your dataset");
//     navigate({ to: "/receipts" });
//   };

//   // ── Drop zone (no image selected yet) ───────────────────────────────────
//   if (!image && step < 0) {
//     return (
//       <>
//         <PageTitle title="Upload & Scan" sub="Our AI reads handwritten receipts and turns them into structured data." />
//         <div className="card-surface p-4"><Dropzone onFile={start} /></div>
//       </>
//     );
//   }

//   // ── Show scanning animation while upload + OCR is in progress ───────────
//   const done = step >= 3;
//   return (
//     <>
//       <PageTitle
//         title="Upload & Scan"
//         sub="Review the extracted details before saving."
//         action={<button onClick={reset} className={btn.ghost}><RotateCcw className="size-4" /> New scan</button>}
//       />
//       <div className="grid gap-4 lg:grid-cols-5">
//         {/* Left: image preview + step list */}
//         <div className="card-surface p-5 lg:col-span-2">
//           <div className="relative overflow-hidden rounded-xl bg-muted">
//             {image && (
//               <img
//                 src={image}
//                 alt="Uploaded receipt"
//                 className={cn("max-h-[460px] w-full object-contain transition", step === 0 && "grayscale")}
//               />
//             )}
//             {!done && <div className="scan-line brand-gradient glow absolute inset-x-0 h-1" />}
//           </div>
//           <ol className="mt-5 space-y-3">
//             {STEPS.map((s, i) => {
//               const state = step > i || done ? "done" : step === i ? "active" : "idle";
//               return (
//                 <li key={s} className="flex items-center gap-3 text-sm">
//                   <span className={cn(
//                     "grid size-7 place-items-center rounded-full text-xs font-bold transition",
//                     state === "done" ? "bg-mint text-primary-foreground"
//                       : state === "active" ? "bg-violet-soft text-primary"
//                       : "bg-muted text-muted-foreground",
//                   )}>
//                     {state === "done" ? <Check className="size-4" />
//                       : state === "active" ? <Loader2 className="size-4 animate-spin" />
//                       : i + 1}
//                   </span>
//                   <span className={cn(state === "idle" && "text-muted-foreground", state !== "idle" && "font-medium")}>{s}</span>
//                 </li>
//               );
//             })}
//           </ol>
//         </div>

//         {/* Right: editable extracted data */}
//         <div className="card-surface p-5 lg:col-span-3">
//           <h3 className="font-semibold">Extracted data</h3>
//           {!draft ? (
//             <div className="mt-6 space-y-3">
//               {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}
//             </div>
//           ) : (
//             <div className="mt-4 space-y-5">
//               <div className="grid gap-3 sm:grid-cols-2">
//                 <label className="text-sm">
//                   <span className="mb-1 block text-muted-foreground">Shop name</span>
//                   <input className={inputCls} value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value })} />
//                 </label>
//                 <label className="text-sm">
//                   <span className="mb-1 block text-muted-foreground">Date</span>
//                   <input type="date" className={inputCls} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
//                 </label>
//               </div>
//               <div>
//                 <div className="mb-2 flex items-center justify-between">
//                   <span className="text-sm text-muted-foreground">Items (from OCR)</span>
//                   <button
//                     onClick={() => setDraft({ ...draft, items: [...draft.items, { name: "", qty: 1, price: 0, category: "Grains" }] })}
//                     className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
//                   >
//                     <Plus className="size-4" /> Add item
//                   </button>
//                 </div>
//                 <div className="space-y-2">
//                   {draft.items.map((it, i) => (
//                     <div key={i} className="grid grid-cols-12 gap-2">
//                       <input className={cn(inputCls, "col-span-5")} placeholder="Item" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
//                       <select className={cn(inputCls, "col-span-3")} value={it.category} onChange={(e) => setItem(i, { category: e.target.value as Item["category"] })}>
//                         {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
//                       </select>
//                       <input type="number" min={1} className={cn(inputCls, "col-span-1 px-2")} value={it.qty} onChange={(e) => setItem(i, { qty: Math.max(1, Number(e.target.value)) })} />
//                       <input type="number" min={0} className={cn(inputCls, "col-span-2")} value={it.price} onChange={(e) => setItem(i, { price: Math.max(0, Number(e.target.value)) })} />
//                       <button
//                         onClick={() => setDraft({ ...draft, items: draft.items.filter((_, k) => k !== i) })}
//                         className="col-span-1 grid place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-destructive"
//                         aria-label="Remove"
//                       >
//                         <Trash2 className="size-4" />
//                       </button>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//               <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-muted/50 p-4">
//                 <label className="text-sm">
//                   <span className="mb-1 block text-muted-foreground">GST (₹)</span>
//                   <input type="number" className={cn(inputCls, "w-32")} value={draft.gst} onChange={(e) => setDraft({ ...draft, gst: Math.max(0, Number(e.target.value)) })} />
//                 </label>
//                 <div className="text-right">
//                   <p className="text-sm text-muted-foreground">Total</p>
//                   <p className="text-2xl font-bold">{inr(subtotal(draft.items) + draft.gst)}</p>
//                 </div>
//               </div>
//               <button onClick={save} disabled={!done} className={cn(btn.primary, "w-full")}>
//                 <Save className="size-4" /> Save receipt
//               </button>
//             </div>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }
