import { Activity, AlertTriangle, ShieldAlert } from "lucide-react";
import type { AuditResponse } from "@/components/scan-context";

const riskClasses = {
  LOW: "text-safe border-safe/40 bg-safe/10",
  MODERATE: "text-warning border-warning/40 bg-warning/10",
  HIGH: "text-critical border-critical/40 bg-critical/10",
  CRITICAL: "text-critical border-critical/60 bg-critical/15"
} as const;

export function RiskDashboard({ result }: { result: AuditResponse }) {
  const { finalAudit, morphologicalProfile, structuralStress } = result;
  const score = finalAudit.structuralHealthIndex;
  const riskClass = riskClasses[finalAudit.riskLevel];
  const anomalyCount = morphologicalProfile.tiles.reduce((total, tile) => total + tile.anomalies.length, 0);
  const shearCount = structuralStress.anomalies.filter((item) => item.diagonalShearAssessment.isCandidate).length;

  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-panel p-5 shadow-glow lg:grid-cols-[190px_1fr]" aria-labelledby="risk-heading">
      <div className="grid place-items-center">
        <div className="grid h-40 w-40 place-items-center rounded-full p-3" style={{ background: `conic-gradient(${score <= 25 ? "#ff6577" : score <= 50 ? "#ff6577" : score <= 75 ? "#ffcb66" : "#60e7a6"} ${score * 3.6}deg, #263c51 0deg)` }} aria-label={`Structural Health Index: ${score} out of 100`}>
          <div className="grid h-full w-full place-items-center rounded-full bg-canvas text-center"><span className="font-mono text-4xl font-bold">{score}</span><span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted">SHI / 100</span></div>
        </div>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-3"><p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Structural Health Index</p><span className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold ${riskClass}`}>{finalAudit.riskLevel} RISK</span><span className="rounded-full border border-line px-3 py-1 font-mono text-xs text-muted">{finalAudit.remedialUrgency}</span></div>
        <h2 id="risk-heading" className="mt-2 text-2xl font-semibold">{finalAudit.reportTitle}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{finalAudit.executiveSummary}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric icon={<Activity size={17} />} label="Visible anomalies" value={String(anomalyCount)} />
          <Metric icon={<ShieldAlert size={17} />} label="Shear-screen candidates" value={String(shearCount)} />
          <Metric icon={<AlertTriangle size={17} />} label="Human review" value={finalAudit.humanReviewRequired ? "Required" : "Not flagged"} />
        </div>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-canvas/45 p-3"><div className="flex items-center gap-2 text-muted">{icon}<span className="text-xs">{label}</span></div><p className="mt-2 text-sm font-semibold text-ink">{value}</p></div>;
}
