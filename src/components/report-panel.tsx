"use client";
import { Copy, FileText, Languages, Printer } from "lucide-react";
import type { AuditResponse } from "@/components/scan-context";

export function ReportPanel({ result }: { result: AuditResponse }) {
  async function copyReport() {
    await navigator.clipboard.writeText(`${result.finalAudit.reportEnglish}\n\n${result.finalAudit.reportMalayalam}`);
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-glow" aria-labelledby="report-heading">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Inspection documentation</p><h2 id="report-heading" className="mt-1 text-xl font-semibold">Bilingual audit report</h2></div><div className="flex gap-2"><button type="button" onClick={() => void copyReport()} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink transition hover:border-signal"><Copy size={15} />Copy</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink transition hover:border-signal"><Printer size={15} />Print</button></div></div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-line bg-canvas/45 p-4" lang="en"><div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted"><FileText size={14} />English</div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink">{result.finalAudit.reportEnglish}</p></article>
        <article className="rounded-xl border border-line bg-canvas/45 p-4" lang="ml"><div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted"><Languages size={14} />മലയാളം</div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink">{result.finalAudit.reportMalayalam}</p></article>
      </div>
      <div className="mt-4 rounded-lg border border-warning/35 bg-warning/10 p-3 text-xs leading-5 text-warning">{result.finalAudit.limitations.join(" ")}</div>
    </section>
  );
}
