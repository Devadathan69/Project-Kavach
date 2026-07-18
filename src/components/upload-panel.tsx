"use client";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Camera, ExternalLink, FileImage, LocateFixed, Ruler, Search, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { AssetContext } from "@/lib/schemas";

export type LiveLocation = {
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  capturedAt: string;
};

export type AuditFormValues = {
  file: File | null;
  assetName: string;
  assetType: string;
  locationMode: "STRUCTURE_LOOKUP" | "LIVE_DEVICE";
  location: LiveLocation | null;
  measurementMode: "UNCALIBRATED" | "REFERENCE_MARKER";
  referenceMarkerMm: number | null;
  assetContextMode: "AUTO" | "CONFIRMED" | "VISUAL_ONLY";
  confirmedAssetCandidateId: string | null;
  offlineConsent: boolean;
};

type UploadPanelProps = {
  onSubmit: (values: AuditFormValues) => Promise<void>;
  onPreview: (file: File | null) => void;
  isBusy: boolean;
  demoMode: boolean;
  modelName: string;
};

function requestLiveLocation() {
  return new Promise<LiveLocation>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser does not provide live location. Use a supported browser and allow location access."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitudeM: position.coords.altitude,
        headingDeg: position.coords.heading,
        accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        capturedAt: new Date(position.timestamp).toISOString()
      }),
      (error) => {
        const messages: Record<number, string> = {
          [error.PERMISSION_DENIED]: "Live location permission was declined. Select structure-name lookup instead, or allow location access and try again.",
          [error.POSITION_UNAVAILABLE]: "Live location is unavailable. Select structure-name lookup, or try again with location services enabled.",
          [error.TIMEOUT]: "Live location took too long. Select structure-name lookup, or try again with location services enabled."
        };
        reject(new Error(messages[error.code] ?? "KAVACH could not obtain a live location."));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );
  });
}

export function UploadPanel({ onSubmit, onPreview, isBusy, demoMode, modelName }: UploadPanelProps) {
  const [values, setValues] = useState<AuditFormValues>({ file: null, assetName: "", assetType: "Concrete structure", locationMode: "STRUCTURE_LOOKUP", location: null, measurementMode: "UNCALIBRATED", referenceMarkerMm: null, assetContextMode: "VISUAL_ONLY", confirmedAssetCandidateId: null, offlineConsent: false });
  const [localError, setLocalError] = useState<string | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [assetContext, setAssetContext] = useState<AssetContext | null>(null);
  const [assetContextPending, setAssetContextPending] = useState(false);
  const [assetContextError, setAssetContextError] = useState<string | null>(null);
  const fileDescription = useMemo(() => values.file ? `${values.file.name} · ${(values.file.size / 1024 / 1024).toFixed(2)} MB` : "JPEG, PNG or WebP · maximum 10 MB", [values.file]);

  function setField<K extends keyof AuditFormValues>(key: K, value: AuditFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setField("file", file);
    onPreview(file);
    setLocalError(null);
  }

  async function acquireLocation() {
    setLocationPending(true);
    setLocalError(null);
    try {
      setField("location", await requestLiveLocation());
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "KAVACH could not obtain a live location.");
    } finally {
      setLocationPending(false);
    }
  }

  async function resolvePublicAsset() {
    if (!values.assetName.trim()) {
      setAssetContextError("Enter the structure name before resolving public evidence.");
      return;
    }
    setAssetContextPending(true);
    setAssetContextError(null);
    setAssetContext(null);
    setValues((current) => ({ ...current, assetContextMode: "VISUAL_ONLY", confirmedAssetCandidateId: null }));
    try {
      const response = await fetch("/api/asset-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetName: values.assetName, assetType: values.assetType })
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error && typeof body.error.message === "string"
          ? body.error.message
          : "KAVACH could not resolve public structure evidence right now.";
        throw new Error(message);
      }
      setAssetContext(body as AssetContext);
    } catch (error) {
      setAssetContextError(error instanceof Error ? error.message : "KAVACH could not resolve public structure evidence right now.");
    } finally {
      setAssetContextPending(false);
    }
  }

  function updateAssetName(assetName: string) {
    setValues((current) => ({ ...current, assetName, assetContextMode: "VISUAL_ONLY", confirmedAssetCandidateId: null }));
    setAssetContext(null);
    setAssetContextError(null);
  }

  function confirmPublicAsset() {
    if (!assetContext?.candidate) return;
    setValues((current) => ({ ...current, assetContextMode: "CONFIRMED", confirmedAssetCandidateId: assetContext.candidate?.candidateId ?? null }));
    setLocalError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.file) {
      setLocalError("Take or select an inspection image before starting an audit.");
      return;
    }
    if (!values.assetName.trim()) {
      setLocalError("Enter the structure name so KAVACH can resolve the inspection location.");
      return;
    }
    if (values.measurementMode === "REFERENCE_MARKER" && values.referenceMarkerMm === null) {
      setLocalError("Enter the known length of the visible reference marker, or choose uncalibrated visual triage.");
      return;
    }
    if (values.locationMode === "LIVE_DEVICE" && !values.location) {
      setLocalError("Capture live location before using the on-site location strategy.");
      return;
    }
    setLocalError(null);
    await onSubmit(values);
  }

  const disabled = isBusy || locationPending;

  return (
    <section className="rounded-2xl border border-line bg-panel/90 p-5 shadow-glow" aria-labelledby="upload-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Intake station</p><h2 id="upload-heading" className="mt-1 text-xl font-semibold">Start a structural audit</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Take a site photo or upload an existing inspection image, then name the structure. You can review and confirm public structure evidence, or run visual-only triage.</p></div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs ${demoMode ? "border-warning/50 bg-warning/10 text-warning" : "border-safe/50 bg-safe/10 text-safe"}`}><ShieldCheck size={14} aria-hidden="true" />{demoMode ? "DETERMINISTIC DEMO MODE" : `LIVE ${modelName.toUpperCase()} MODE`}</span>
      </div>

      <form className="mt-5 grid gap-5" onSubmit={submit} noValidate>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="group grid cursor-pointer gap-2 rounded-xl border border-dashed border-signal/45 bg-canvas/40 p-5 transition hover:border-signal hover:bg-signal/5 focus-within:border-signal" htmlFor="inspection-image"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-signal/15 text-signal"><UploadCloud size={22} aria-hidden="true" /></span><span><span className="block font-semibold">Upload existing image</span><span className="mt-0.5 block text-sm text-muted">{fileDescription}</span></span></span><input id="inspection-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} disabled={disabled} /></label>
          <label className="group grid cursor-pointer gap-2 rounded-xl border border-dashed border-safe/45 bg-canvas/40 p-5 transition hover:border-safe hover:bg-safe/5 focus-within:border-safe" htmlFor="camera-image"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-safe/15 text-safe"><Camera size={22} aria-hidden="true" /></span><span><span className="block font-semibold">Take a photo</span><span className="mt-0.5 block text-sm text-muted">Opens the rear camera on supported phones</span></span></span><input id="camera-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onFileChange} disabled={disabled} /></label>
        </div>

        <div className="grid gap-4 md:grid-cols-2"><Field label="Structure name" required><input value={values.assetName} onChange={(event) => updateAssetName(event.target.value)} required disabled={disabled} placeholder="e.g. East pier 04" /></Field><Field label="Structure type" required><input value={values.assetType} onChange={(event) => setField("assetType", event.target.value)} required disabled={disabled} /></Field></div>

        <section className="rounded-xl border border-line bg-canvas/30 p-4" aria-label="Inspection location strategy">
          <div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-signal/15 text-signal"><Search size={19} aria-hidden="true" /></span><div><h3 className="text-sm font-semibold">Inspection location strategy</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Choose name-based lookup for uploaded photos from a different place. Use live location only when you are currently at the structure.</p></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><button type="button" onClick={() => setField("locationMode", "STRUCTURE_LOOKUP")} disabled={disabled} className={`rounded-lg border p-3 text-left transition ${values.locationMode === "STRUCTURE_LOOKUP" ? "border-signal bg-signal/10" : "border-line hover:border-signal/50"}`}><span className="flex items-center gap-2 text-sm font-semibold"><Search size={16} className="text-signal" />Find location from structure name</span><span className="mt-1 block text-xs leading-5 text-muted">Recommended for uploads. KAVACH matches public map records and uses a verified match’s coordinates.</span></button><button type="button" onClick={() => setValues((current) => ({ ...current, locationMode: "LIVE_DEVICE", assetContextMode: "VISUAL_ONLY", confirmedAssetCandidateId: null }))} disabled={disabled} className={`rounded-lg border p-3 text-left transition ${values.locationMode === "LIVE_DEVICE" ? "border-safe bg-safe/10" : "border-line hover:border-safe/50"}`}><span className="flex items-center gap-2 text-sm font-semibold"><LocateFixed size={16} className="text-safe" />Use this device’s live location</span><span className="mt-1 block text-xs leading-5 text-muted">Recommended for photos taken on-site. Requires explicit browser permission.</span></button></div>
          {values.locationMode === "LIVE_DEVICE" && <div className="mt-3 rounded-lg border border-safe/30 bg-safe/10 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-safe">{values.location ? `Live location captured at ${new Date(values.location.capturedAt).toLocaleTimeString()}${values.location.accuracyM === null ? "" : ` · accuracy approximately ${Math.round(values.location.accuracyM)} m`}.` : "Live location has not been captured."}</p><button type="button" onClick={() => void acquireLocation()} disabled={disabled} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-safe/50 px-3 py-1.5 text-xs font-semibold text-safe disabled:cursor-not-allowed disabled:opacity-50"><LocateFixed size={14} />{locationPending ? "Locating…" : values.location ? "Refresh location" : "Capture live location"}</button></div></div>}
        </section>

        {values.locationMode === "STRUCTURE_LOOKUP" && <section className="rounded-xl border border-signal/30 bg-signal/5 p-4" aria-label="Public structure evidence">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-signal/15 text-signal"><Search size={19} aria-hidden="true" /></span><div><h3 className="text-sm font-semibold">Public structure evidence</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Review a public map candidate before its coordinates or public construction record are used. You can always continue with image-only triage.</p></div></div><button type="button" onClick={() => void resolvePublicAsset()} disabled={disabled || assetContextPending} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-signal/50 px-3 py-1.5 text-xs font-semibold text-signal disabled:cursor-not-allowed disabled:opacity-50"><Search size={14} />{assetContextPending ? "Resolving record..." : "Find public record"}</button></div>
          {assetContextError && <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning" role="status">{assetContextError}</p>}
          {assetContext && <div className="mt-3 rounded-md border border-line bg-canvas/50 p-3 text-xs">
            {assetContext.candidate ? <>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-ink">{assetContext.resolvedName ?? assetContext.candidate.displayName}</p><p className="mt-1 leading-5 text-muted">{assetContext.matchRationale}</p></div><a className="inline-flex items-center gap-1 text-signal underline underline-offset-2" href={assetContext.candidate.sourceUrl} target="_blank" rel="noreferrer">Open map record <ExternalLink size={12} /></a></div>
              <p className="mt-2 leading-5 text-muted">Match confidence: {Math.round(assetContext.matchConfidence * 100)}%. {assetContext.construction.buildYear === null ? "No verified public construction year was found." : `Public construction year: ${assetContext.construction.buildYear}.`}</p>
              <button type="button" onClick={confirmPublicAsset} disabled={disabled} className={`mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${values.assetContextMode === "CONFIRMED" ? "border-safe/50 bg-safe/10 text-safe" : "border-signal/50 text-signal"}`}><BadgeCheck size={14} />{values.assetContextMode === "CONFIRMED" ? "Public record confirmed" : "Confirm this public record"}</button>
            </> : <p className="leading-5 text-muted">No candidate was selected. Continue with visual-only triage; no map location or public age will be inferred.</p>}
          </div>}
        </section>}

        <section className="rounded-xl border border-line bg-canvas/30 p-4" aria-label="Measurement basis">
          <div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-warning/15 text-warning"><Ruler size={19} aria-hidden="true" /></span><div><h3 className="text-sm font-semibold">Measurement basis</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">A single image cannot prove physical crack dimensions without a known scale. Uncalibrated audits report pixel-space visual evidence only.</p></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><button type="button" onClick={() => setValues((current) => ({ ...current, measurementMode: "UNCALIBRATED", referenceMarkerMm: null }))} disabled={disabled} className={`rounded-lg border p-3 text-left transition ${values.measurementMode === "UNCALIBRATED" ? "border-warning bg-warning/10" : "border-line hover:border-warning/50"}`}><span className="block text-sm font-semibold">Uncalibrated visual triage</span><span className="mt-1 block text-xs leading-5 text-muted">Recommended unless a reference marker is visible. Millimeter values are withheld.</span></button><button type="button" onClick={() => setField("measurementMode", "REFERENCE_MARKER")} disabled={disabled} className={`rounded-lg border p-3 text-left transition ${values.measurementMode === "REFERENCE_MARKER" ? "border-safe bg-safe/10" : "border-line hover:border-safe/50"}`}><span className="block text-sm font-semibold">Visible reference marker</span><span className="mt-1 block text-xs leading-5 text-muted">Use only when a marker of known length is in the same image plane as the defect.</span></button></div>
          {values.measurementMode === "REFERENCE_MARKER" && <div className="mt-3 max-w-xs"><Field label="Reference marker length (mm)" required><input type="number" min="1" max="10000" step="0.1" value={values.referenceMarkerMm ?? ""} onChange={(event) => setField("referenceMarkerMm", event.target.value === "" ? null : Number(event.target.value))} disabled={disabled} placeholder="e.g. 100" /></Field></div>}
        </section>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas/30 p-4 text-sm text-muted"><input checked={values.offlineConsent} onChange={(event) => setField("offlineConsent", event.target.checked)} disabled={disabled} className="mt-1 h-4 w-4 accent-cyan-300" type="checkbox" /><span>When offline, I permit this device to keep this image and the selected inspection-location strategy in a browser-storage queue until I reconnect or remove it.</span></label>
        <AnimatePresence initial={false}>{localError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg border border-critical/50 bg-critical/10 px-3 py-2 text-sm text-critical" role="alert">{localError}</motion.p>}</AnimatePresence>
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs leading-5 text-muted"><Camera size={15} aria-hidden="true" />Visual screening supports inspection decisions; it does not replace a qualified engineer’s assessment.</p><button type="submit" disabled={disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-bold text-canvas transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{isBusy ? <><FileImage size={17} aria-hidden="true" />Processing audit…</> : <><Send size={17} aria-hidden="true" />Run structural audit</>}</button></div>
      </form>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-ink"><span>{label}{required ? <span className="ml-1 text-critical">*</span> : null}</span><span className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-line [&>input]:bg-canvas/80 [&>input]:px-3 [&>input]:py-2.5 [&>input]:text-sm [&>input]:text-ink [&>input]:placeholder:text-muted/65 [&>input]:disabled:cursor-not-allowed [&>input]:disabled:opacity-50">{children}</span></label>;
}
