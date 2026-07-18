"use client";
import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import type { QueuedAudit } from "@/lib/offline-queue";

export function OfflineQueueStatus({ audits, onRetry, onClear, isRetrying }: { audits: QueuedAudit[]; onRetry: () => void; onClear: () => void; isRetrying: boolean }) {
  if (audits.length === 0) return null;
  return (
    <section className="rounded-xl border border-warning/45 bg-warning/10 p-4" aria-live="polite" aria-labelledby="queue-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><CloudOff className="mt-0.5 text-warning" size={20} aria-hidden="true" /><div><h2 id="queue-heading" className="text-sm font-semibold text-warning">{audits.length} audit{audits.length === 1 ? "" : "s"} waiting on this device</h2><p className="mt-1 text-xs leading-5 text-warning/90">Queued images and metadata remain only in this browser until submission succeeds or you remove them.</p></div></div><div className="flex gap-2"><button type="button" onClick={onRetry} disabled={isRetrying || !navigator.onLine} className="inline-flex items-center gap-2 rounded-md border border-warning/50 px-3 py-2 text-xs font-medium text-warning disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />Retry now</button><button type="button" onClick={onClear} disabled={isRetrying} className="inline-flex items-center gap-2 rounded-md border border-warning/50 px-3 py-2 text-xs font-medium text-warning disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={14} />Clear queue</button></div></div>
      <ul className="mt-3 divide-y divide-warning/20 rounded-lg border border-warning/25 bg-canvas/40 px-3">{audits.map((audit) => <li key={audit.id} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="min-w-0 truncate text-ink">{audit.metadata.assetName} · {audit.file.name}</span><span className="shrink-0 font-mono text-warning">{audit.retryCount ? `retry ${audit.retryCount}` : "pending"}</span></li>)}</ul>
    </section>
  );
}
