import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Dropzone({ onFile, compact }: { onFile: (f: File) => void; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition",
        compact ? "gap-2 p-6" : "gap-4 p-12 md:p-16",
        over ? "border-primary bg-violet-soft" : "border-input bg-muted/40 hover:border-primary/60 hover:bg-violet-soft/50",
      )}
    >
      <div className={cn("grid place-items-center rounded-2xl bg-violet-soft text-primary", compact ? "size-12" : "size-16")}>
        <UploadCloud className={compact ? "size-6" : "size-8"} />
      </div>
      <div>
        <p className={cn("font-semibold", !compact && "text-lg")}>Drop handwritten grocery receipts here</p>
        <p className="mt-1 text-sm text-muted-foreground">or click to browse · JPG, PNG up to 10 MB</p>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </div>
  );
}
