"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ImageOff, ScanSearch, Target } from "lucide-react";
import Image from "next/image";
import type { AuditResponse, ScanStatus } from "@/components/scan-context";

type AnalysisCanvasProps = {
  previewUrl: string | null;
  result: AuditResponse | null;
  status: ScanStatus;
  selectedAnomalyId: string | null;
  onSelect: (id: string) => void;
};

const severityColour = { MINOR: "#60e7a6", MODERATE: "#ffcb66", SEVERE: "#ff6577", CRITICAL: "#ff3755" } as const;

export function AnalysisCanvas({ previewUrl, result, status, selectedAnomalyId, onSelect }: AnalysisCanvasProps) {
  const reducedMotion = useReducedMotion();
  const active = !["IDLE", "COMPLETE", "ERROR", "QUEUED_OFFLINE"].includes(status);
  const anomalies = result?.morphologicalProfile.tiles.flatMap((tile) => tile.anomalies) ?? [];
  const dimensions = result ? { width: result.sourceImage.widthPx, height: result.sourceImage.heightPx } : { width: 1000, height: 720 };

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-glow" aria-labelledby="analysis-heading">
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><div className="flex items-center gap-2"><ScanSearch size={17} className="text-signal" aria-hidden="true" /><h2 id="analysis-heading" className="text-sm font-semibold">Spatial anomaly overlay</h2></div><span className="font-mono text-xs text-muted">{result ? `${anomalies.length} VECTOR MARKERS` : "AWAITING FRAME"}</span></div>
      <div className="relative aspect-[4/3] min-h-[300px] bg-[#02070d]">
        {previewUrl ? <Image src={previewUrl} alt="Uploaded structural inspection frame" fill unoptimized sizes="(max-width: 1280px) 100vw, 1100px" className="object-contain" /> : <div className="grid h-full place-items-center p-8 text-center text-muted"><div><ImageOff className="mx-auto mb-3 text-line" size={42} aria-hidden="true" /><p className="text-sm">Your inspection frame will appear here.</p><p className="mt-1 text-xs">KAVACH preserves source-image coordinates for every visible anomaly.</p></div></div>}
        {previewUrl && result && <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Detected anomaly overlays">
          {anomalies.map((anomaly) => {
            const selected = selectedAnomalyId === anomaly.anomalyId;
            const box = anomaly.boundingBoxPx;
            return <g key={anomaly.anomalyId}>
              <rect x={box.xMin} y={box.yMin} width={box.xMax - box.xMin} height={box.yMax - box.yMin} fill={severityColour[anomaly.severity]} fillOpacity={selected ? 0.28 : 0.12} stroke={severityColour[anomaly.severity]} strokeWidth={selected ? 5 : 3} vectorEffect="non-scaling-stroke" />
              <foreignObject x={box.xMin} y={Math.max(0, box.yMin - 35)} width="220" height="32"><button type="button" onClick={() => onSelect(anomaly.anomalyId)} className="rounded bg-canvas/95 px-2 py-1 font-mono text-[11px] font-bold text-ink ring-1 ring-inset ring-white/20 focus:outline-none" aria-label={`Select ${anomaly.type.toLowerCase()} anomaly`}>{anomaly.type.replace("_", " ")} · {Math.round(anomaly.confidence * 100)}%</button></foreignObject>
            </g>;
          })}
        </svg>}
        {active && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <motion.div className="absolute inset-x-0 h-1 bg-signal shadow-[0_0_24px_4px_rgba(73,215,255,.75)]" initial={{ top: "5%" }} animate={reducedMotion ? { opacity: 0.65 } : { top: ["5%", "95%", "5%"] }} transition={reducedMotion ? { duration: 0 } : { duration: 3.4, repeat: Infinity, ease: "linear" }} />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(73,215,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(73,215,255,.07)_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>}
        {active && <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded bg-canvas/90 px-3 py-2 font-mono text-xs text-signal"><Target size={14} aria-hidden="true" />{status.replaceAll("_", " ")}</div>}
      </div>
      <p className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">Overlay geometry is anchored to the normalized source image. Highlighted markers are visual observations, not verified physical dimensions.</p>
    </section>
  );
}
