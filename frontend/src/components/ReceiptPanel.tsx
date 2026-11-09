import { X } from "lucide-react";
import { fmtDate, inr, subtotal, type Receipt } from "@/lib/receipts";
import { StatusBadge } from "./AppShell";

export function ReceiptPanel({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  if (!receipt) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-sidebar/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-card shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-start justify-between border-b border-border p-6">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{receipt.id}</p>
            <h3 className="mt-1 text-xl font-bold">{receipt.store}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{fmtDate(receipt.date)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {receipt.image && <img src={receipt.image} alt="Receipt" className="mb-5 max-h-56 w-full rounded-xl object-cover" />}
          <div className="mb-4"><StatusBadge status={receipt.status} /></div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="pb-2">Item</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {receipt.items.map((i, k) => (
                <tr key={k}>
                  {/* <td className="py-2.5"><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.category}</p></td> */}
                  <td className="py-2.5"><p className="font-medium">{i.name}</p></td>
                  <td className="py-2.5 text-right">{i.qty}</td>
                  <td className="py-2.5 text-right">{inr(i.price)}</td>
                  <td className="py-2.5 text-right font-semibold">{inr(i.qty * i.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1.5 border-t border-border bg-muted/40 p-6 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(subtotal(receipt.items))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{inr(receipt.gst)}</span></div>
          <div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span>{inr(receipt.total)}</span></div>
        </div>
      </aside>
    </div>
  );
}
