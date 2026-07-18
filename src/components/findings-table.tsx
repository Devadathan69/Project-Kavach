"use client";
import { ChevronRight, Compass, Ruler, ShieldAlert } from "lucide-react";
import type { AuditResponse } from "@/components/scan-context";

export function FindingsTable({ result, selectedAnomalyId, onSelect }: { result: AuditResponse; selectedAnomalyId: string | null; onSelect: (id: string) => void }) {
  const anomalyById = new Map(result.morphologicalProfile.tiles.flatMap((tile) => tile.anomalies).map((anomaly) => [anomaly.anomalyId, anomaly]));
  const stressById = new Map(result.structuralStress.anomalies.map((stress) => [stress.anomalyId, stress]));
  const findings = [...result.finalAudit.findings].sort((left, right) => left.priority - right.priority);

  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-glow" aria-labelledby="findings-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Prioritised findings</p><h2 id="findings-heading" className="mt-1 text-xl font-semibold">Remedial actions</h2></div><span className="font-mono text-xs text-muted">{findings.length} FINDINGS</span></div>
      <div className="mt-4 grid gap-3">
        {findings.map((finding) => {
          const anomaly = anomalyById.get(finding.anomalyId);
          const stress = stressById.get(finding.anomalyId);
          const selected = selectedAnomalyId === finding.anomalyId;
          if (!anomaly) return null;
          return <button key={finding.anomalyId} type="button" onClick={() => onSelect(finding.anomalyId)} className={`grid w-full gap-4 rounded-xl border p-4 text-left transition sm:grid-cols-[auto_1fr_auto] sm:items-center ${selected ? "border-signal bg-signal/10" : "border-line bg-canvas/40 hover:border-signal/50"}`}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-panel font-mono text-sm font-bold text-signal">{finding.priority}</span>
            <span><span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{anomaly.type.replace("_", " ")}</span><span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted">{anomaly.severity}</span>{stress?.diagonalShearAssessment.isCandidate && <span className="inline-flex items-center gap-1 rounded-full border border-critical/40 bg-critical/10 px-2 py-0.5 font-mono text-[10px] text-critical"><ShieldAlert size={11} />SHEAR SCREEN</span>}</span><span className="mt-1 block text-sm leading-5 text-muted">{finding.finding}</span><span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span className="inline-flex items-center gap-1"><Compass size={13} />{stress?.orientationDegrees === null || !stress ? "No vector" : `${stress.orientationDegrees.toFixed(1)}°`}</span><span className="inline-flex items-center gap-1"><Ruler size={13} />{anomaly.crackGeometry.lengthMm === null ? "Scale unavailable" : `${anomaly.crackGeometry.lengthMm.toFixed(1)} mm`}</span></span></span>
            <span className="flex items-center gap-2 text-sm text-signal"><span>{finding.targetTimeframe}</span><ChevronRight size={17} aria-hidden="true" /></span>
          </button>;
        })}
      </div>
    </section>
  );
}
