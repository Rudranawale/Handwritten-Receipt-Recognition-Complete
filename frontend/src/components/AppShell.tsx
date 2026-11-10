import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UploadCloud, Database, Bot, Settings, ScanLine, PanelLeftClose, PanelLeft, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useReceipts } from "@/lib/receipts";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/upload", label: "Upload & Scan", icon: UploadCloud },
  { to: "/receipts", label: "Receipts Dataset", icon: Database },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
  { to: "/settings", label: "Settings & Analytics", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const receipts = useReceipts();
  const limit = 100;

  return (
    <div className="flex min-h-screen w-full">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-sidebar/50 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-[76px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="brand-gradient glow grid size-9 shrink-0 place-items-center rounded-xl">
            <ScanLine className="size-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="text-lg font-bold tracking-tight">ReceiptIQ</span>}
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                title={label}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                {active && <span className="brand-gradient absolute left-0 top-2 bottom-2 w-1 rounded-r-full" />}
                <Icon className={cn("size-5 shrink-0", active && "text-mint")} />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="m-3 rounded-2xl border border-sidebar-border bg-sidebar-accent p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-muted">Monthly storage</p>
            <div className="mt-3 flex items-baseline justify-between text-sm">
              <span className="font-semibold">{receipts.length} / {limit} scans</span>
              <span className="text-sidebar-muted">{(receipts.length * 0.42).toFixed(1)} MB</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sidebar">
              <div className="brand-gradient h-full rounded-full transition-all" style={{ width: `${Math.min(100, (receipts.length / limit) * 100)}%` }} />
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mx-3 mb-4 hidden items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground md:flex"
        >
          {collapsed ? <PanelLeft className="size-5" /> : <><PanelLeftClose className="size-5" /> Collapse</>}
        </button>
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col transition-all duration-300", collapsed ? "md:pl-[76px]" : "md:pl-64")}>
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-x-0 border-t-0 px-4 md:px-8">
          <button className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
          <h1 className="text-sm font-semibold text-muted-foreground">{NAV.find((n) => (n.to === "/" ? path === "/" : path.startsWith(n.to)))?.label}</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="brand-gradient grid size-9 place-items-center rounded-full text-sm font-bold text-primary-foreground">RN</div>
          </div>
        </header>
        <main key={path} className="page-enter flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: "Processed" | "Verified" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
      status === "Verified" ? "bg-mint-soft text-mint" : "bg-gold-soft text-gold")}>
      <span className="size-1.5 rounded-full bg-current" />{status}
    </span>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-muted",
};
export const inputCls = "w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20";
