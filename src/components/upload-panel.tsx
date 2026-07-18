"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, FileImage, LocateFixed, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

export type AuditFormValues = {
  file: File | null;
  assetName: string;
  assetType: string;
  capturedAt: string;
  latitude: string;
  longitude: string;
  altitudeM: string;
  headingDeg: string;
  structuralAgeYears: string;
  locationConsent: boolean;
  offlineConsent: boolean;
};

type UploadPanelProps = {
  onSubmit: (values: AuditFormValues) => Promise<void>;
  onPreview: (file: File | null) => void;
  isBusy: boolean;
  demoMode: boolean;
};

const initialValues: Omit<AuditFormValues, "file"> = {
  assetName: "",
  assetType: "Concrete structure",
  capturedAt: "",
  latitude: "",
  longitude: "",
  altitudeM: "",
  headingDeg: "",
  structuralAgeYears: "",
  locationConsent: false,
  offlineConsent: false
};

export function UploadPanel({ onSubmit, onPreview, isBusy, demoMode }: UploadPanelProps) {
  const [values, setValues] = useState<AuditFormValues>({ file: null, ...initialValues });
  const [localError, setLocalError] = useState<string | null>(null);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.file) {
      setLocalError("Choose an inspection image before starting an audit.");
      return;
    }
    if ((values.latitude || values.longitude) && !values.locationConsent) {
      setLocalError("Confirm location consent before submitting coordinates.");
      return;
    }
    setLocalError(null);
    await onSubmit(values);
  }

  return (
    <section className="rounded-2xl border border-line bg-panel/90 p-5 shadow-glow" aria-labelledby="upload-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Intake station</p>
          <h2 id="upload-heading" className="mt-1 text-xl font-semibold">Start a structural audit</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Upload a high-resolution inspection frame and the capture context you are authorised to provide.</p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs ${demoMode ? "border-warning/50 bg-warning/10 text-warning" : "border-safe/50 bg-safe/10 text-safe"}`}>
          <ShieldCheck size={14} aria-hidden="true" />
          {demoMode ? "DETERMINISTIC DEMO MODE" : "LIVE ANALYSIS MODE"}
        </span>
      </div>

      <form className="mt-5 grid gap-5" onSubmit={submit} noValidate>
        <label className="group grid cursor-pointer gap-2 rounded-xl border border-dashed border-signal/45 bg-canvas/40 p-5 transition hover:border-signal hover:bg-signal/5 focus-within:border-signal" htmlFor="inspection-image">
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-signal/15 text-signal"><UploadCloud size={22} aria-hidden="true" /></span>
            <span>
              <span className="block font-semibold">{values.file ? "Replace inspection image" : "Select inspection image"}</span>
              <span className="mt-0.5 block text-sm text-muted">{fileDescription}</span>
            </span>
          </span>
          <input id="inspection-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} disabled={isBusy} />
        </label>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Asset name" required><input value={values.assetName} onChange={(event) => setField("assetName", event.target.value)} required disabled={isBusy} placeholder="e.g. East pier 04" /></Field>
          <Field label="Asset type" required><input value={values.assetType} onChange={(event) => setField("assetType", event.target.value)} required disabled={isBusy} /></Field>
          <Field label="Structural age (years)"><input value={values.structuralAgeYears} onChange={(event) => setField("structuralAgeYears", event.target.value)} disabled={isBusy} inputMode="numeric" type="number" min="0" max="1000" placeholder="Optional" /></Field>
          <Field label="Capture time"><input value={values.capturedAt} onChange={(event) => setField("capturedAt", event.target.value)} disabled={isBusy} type="datetime-local" /></Field>
        </div>

        <details className="rounded-xl border border-line bg-canvas/30 px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium"><LocateFixed size={16} className="text-signal" aria-hidden="true" />Optional capture telemetry</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Latitude"><input value={values.latitude} onChange={(event) => setField("latitude", event.target.value)} disabled={isBusy} inputMode="decimal" placeholder="e.g. 8.5241" /></Field>
            <Field label="Longitude"><input value={values.longitude} onChange={(event) => setField("longitude", event.target.value)} disabled={isBusy} inputMode="decimal" placeholder="e.g. 76.9366" /></Field>
            <Field label="Altitude (m)"><input value={values.altitudeM} onChange={(event) => setField("altitudeM", event.target.value)} disabled={isBusy} inputMode="decimal" placeholder="Optional" /></Field>
            <Field label="Heading (degrees)"><input value={values.headingDeg} onChange={(event) => setField("headingDeg", event.target.value)} disabled={isBusy} inputMode="decimal" min="0" max="359.99" placeholder="Optional" /></Field>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-muted">
            <input checked={values.locationConsent} onChange={(event) => setField("locationConsent", event.target.checked)} disabled={isBusy} className="mt-1 h-4 w-4 accent-cyan-300" type="checkbox" />
            <span>I am authorised to submit these coordinates for this asset. KAVACH uses them only for this audit’s environmental context.</span>
          </label>
        </details>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas/30 p-4 text-sm text-muted">
          <input checked={values.offlineConsent} onChange={(event) => setField("offlineConsent", event.target.checked)} disabled={isBusy} className="mt-1 h-4 w-4 accent-cyan-300" type="checkbox" />
          <span>When offline, I permit this device to keep this image and its submitted metadata in a browser-storage queue until I reconnect or remove it.</span>
        </label>

        <AnimatePresence initial={false}>
          {localError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg border border-critical/50 bg-critical/10 px-3 py-2 text-sm text-critical" role="alert">{localError}</motion.p>}
        </AnimatePresence>

        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-5 text-muted"><Camera size={15} aria-hidden="true" />Visual screening supports inspection decisions; it does not replace a qualified engineer’s assessment.</p>
          <button type="submit" disabled={isBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-bold text-canvas transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
            {isBusy ? <><FileImage size={17} aria-hidden="true" />Processing audit…</> : <><Send size={17} aria-hidden="true" />Run structural audit</>}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-ink"><span>{label}{required ? <span className="ml-1 text-critical">*</span> : null}</span><span className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-line [&>input]:bg-canvas/80 [&>input]:px-3 [&>input]:py-2.5 [&>input]:text-sm [&>input]:text-ink [&>input]:placeholder:text-muted/65 [&>input]:disabled:cursor-not-allowed [&>input]:disabled:opacity-50">{children}</span></label>;
}
