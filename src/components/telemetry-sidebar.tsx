import { Compass, Droplets, MapPin, ScanLine, ThermometerSun, Waves } from "lucide-react";
import type { AuditResponse } from "@/components/scan-context";

export function TelemetrySidebar({ result }: { result: AuditResponse | null }) {
  if (!result) {
    return <aside className="rounded-2xl border border-line bg-panel p-5 shadow-glow"><p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Technical telemetry</p><p className="mt-4 text-sm leading-6 text-muted">Capture metadata, tile dimensions, crack vectors, and environmental context appear here after a completed audit.</p></aside>;
  }

  const environment = result.environmentalContext;
  const primaryStress = result.structuralStress.anomalies.find((item) => item.diagonalShearAssessment.isCandidate) ?? result.structuralStress.anomalies[0];
  const coordinate = environment.coordinates.latitude === null ? "Not supplied" : `${environment.coordinates.latitude.toFixed(5)}, ${environment.coordinates.longitude?.toFixed(5)}`;

  return (
    <aside className="rounded-2xl border border-line bg-panel p-5 shadow-glow" aria-label="Technical telemetry">
      <div className="flex items-center justify-between"><p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Technical telemetry</p><ScanLine size={17} className="text-signal" aria-hidden="true" /></div>
      <div className="mt-4 grid gap-3">
        <Telemetry icon={<MapPin size={16} />} label="Capture coordinates" value={coordinate} />
        <Telemetry icon={<ScanLine size={16} />} label="Normalized image" value={`${result.sourceImage.widthPx} × ${result.sourceImage.heightPx} px`} subvalue={`${result.morphologicalProfile.tiles.length} high-detail tiles`} />
        <Telemetry icon={<Compass size={16} />} label="Primary orientation" value={primaryStress?.orientationDegrees === null || !primaryStress ? "Not applicable" : `${primaryStress.orientationDegrees.toFixed(1)}°`} subvalue={primaryStress?.vector ? `Vector ${primaryStress.vector.dx.toFixed(3)}, ${primaryStress.vector.dy.toFixed(3)}` : undefined} />
        <Telemetry icon={<Waves size={16} />} label="Coastal / salinity exposure" value={environment.coastalExposure.salinityExposure ? `${environment.coastalExposure.salinityExposure} salinity` : "Unavailable"} subvalue={environment.coastalExposure.coastDistanceKm === null ? undefined : `${environment.coastalExposure.coastDistanceKm.toFixed(1)} km to coast`} />
        <Telemetry icon={<Droplets size={16} />} label="Monsoon / humidity" value={environment.climate.monsoonRainfallMmAnnual === null ? "Unavailable" : `${Math.round(environment.climate.monsoonRainfallMmAnnual).toLocaleString()} mm / year`} subvalue={environment.climate.humidityPercent === null ? undefined : `${environment.climate.humidityPercent.toFixed(0)}% humidity`} />
        <Telemetry icon={<ThermometerSun size={16} />} label="Temperature / drainage" value={environment.climate.temperatureC === null ? environment.structure.drainageCondition : `${environment.climate.temperatureC.toFixed(1)}°C`} subvalue={`Drainage: ${environment.structure.drainageCondition}`} />
      </div>
      <div className="mt-4 rounded-lg border border-line bg-canvas/50 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Analysis provenance</p><p className="mt-1 text-xs text-ink">{result.demoMode ? "Deterministic demonstration fixture" : result.modelName ?? "Live model"}</p><p className="mt-1 font-mono text-[10px] text-muted">Policy {result.analysisVersion}</p></div>
    </aside>
  );
}

function Telemetry({ icon, label, value, subvalue }: { icon: React.ReactNode; label: string; value: string; subvalue?: string }) {
  return <div className="rounded-lg border border-line bg-canvas/45 p-3"><div className="flex items-center gap-2 text-muted">{icon}<span className="text-xs">{label}</span></div><p className="mt-1.5 break-words text-sm font-medium text-ink">{value}</p>{subvalue && <p className="mt-1 text-xs text-muted">{subvalue}</p>}</div>;
}
