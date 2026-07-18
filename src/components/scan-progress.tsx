"use client";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, CircleDashed, ScanLine } from "lucide-react";
import type { ScanStatus } from "@/components/scan-context";

const stages: Array<{ id: ScanStatus; label: string }> = [
  { id: "VALIDATING_UPLOAD", label: "Validate intake" },
  { id: "PREPARING_TILES", label: "Prepare high-detail tiles" },
  { id: "ANALYZING_MORPHOLOGY", label: "Profile surface morphology" },
  { id: "RESOLVING_ASSET_CONTEXT", label: "Match nearby structure context" },
  { id: "CALCULATING_STRESS", label: "Calculate stress vectors" },
  { id: "ASSESSING_ENVIRONMENT", label: "Assess environment" },
  { id: "PREDICTING_DEGRADATION", label: "Draft degradation forecast" },
  { id: "SAVING_REPORT", label: "Store audit record" }
];

function activeIndex(status: ScanStatus) {
  if (status === "COMPLETE") return stages.length;
  return stages.findIndex((stage) => stage.id === status);
}

export function ScanProgress({ status, demoMode }: { status: ScanStatus; demoMode: boolean }) {
  const reducedMotion = useReducedMotion();
  const index = activeIndex(status);
  const inProgress = index >= 0 && status !== "COMPLETE" && status !== "ERROR" && status !== "QUEUED_OFFLINE";

  return (
    <section className="rounded-xl border border-line bg-canvas/50 p-4" aria-live="polite" aria-label="Audit processing status">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><ScanLine className="text-signal" size={18} aria-hidden="true" /><div><h2 className="text-sm font-semibold">Analysis pipeline</h2><p className="mt-0.5 text-xs text-muted">{inProgress ? (demoMode ? "Running deterministic demo pipeline" : "Running validated server analysis") : status === "COMPLETE" ? "Validated audit complete" : status === "QUEUED_OFFLINE" ? "Held safely in local queue" : "Awaiting audit"}</p></div></div>
        {inProgress && <span className="font-mono text-xs text-signal">IN PROGRESS</span>}
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage, stageIndex) => {
          const complete = status === "COMPLETE" || stageIndex < index;
          const current = stageIndex === index;
          return <li key={stage.id} className={`relative flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs ${complete ? "border-safe/30 bg-safe/10 text-safe" : current ? "border-signal/50 bg-signal/10 text-ink" : "border-line bg-panel/40 text-muted"}`}>
            {current && !reducedMotion ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}><CircleDashed size={15} aria-hidden="true" /></motion.span> : complete ? <CheckCircle2 size={15} aria-hidden="true" /> : <span className="h-2 w-2 rounded-full bg-current opacity-50" aria-hidden="true" />}
            <span>{stage.label}</span>
          </li>;
        })}
      </ol>
    </section>
  );
}
