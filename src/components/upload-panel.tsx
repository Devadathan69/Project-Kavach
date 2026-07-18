"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, FileImage, LocateFixed, MapPinCheck, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

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
  location: LiveLocation | null;
  offlineConsent: boolean;
};

type UploadPanelProps = {
  onSubmit: (values: AuditFormValues) => Promise<void>;
  onPreview: (file: File | null) => void;
  isBusy: boolean;
  demoMode: boolean;
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
          [error.PERMISSION_DENIED]: "Live location permission was declined. KAVACH needs it to resolve the structure and local environmental context.",
          [error.POSITION_UNAVAILABLE]: "Live location is currently unavailable. Move to an area with location coverage and try again.",
          [error.TIMEOUT]: "Live location took too long to resolve. Try again with location services enabled."
        };
        reject(new Error(messages[error.code] ?? "KAVACH could not obtain a live location."));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );
  });
}

export function UploadPanel({ onSubmit, onPreview, isBusy, demoMode }: UploadPanelProps) {
  const [values, setValues] = useState<AuditFormValues>({ file: null, assetName: "", assetType: "Concrete structure", location: null, offlineConsent: false });
  const [localError, setLocalError] = useState<string | null>(null);
  const [locationPending, setLocationPending] = useState(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.file) {
      setLocalError("Choose an inspection image before starting an audit.");
      return;
    }
    if (!values.location) {
      setLocalError("Use live location before starting an audit. KAVACH does not accept manually entered coordinates.");
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
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Upload a high-resolution inspection frame, name the structure, and authorise one live-location capture. KAVACH resolves the nearby structure and public construction evidence automatically.</p>
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
          <input id="inspection-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} disabled={isBusy || locationPending} />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Structure name" required><input value={values.assetName} onChange={(event) => setField("assetName", event.target.value)} required disabled={isBusy || locationPending} placeholder="e.g. East pier 04" /></Field>
          <Field label="Structure type" required><input value={values.assetType} onChange={(event) => setField("assetType", event.target.value)} required disabled={isBusy || locationPending} /></Field>
        </div>

        <section className="rounded-xl border border-line bg-canvas/30 p-4" aria-label="Live location">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-9 w-9 place-items-center rounded-lg ${values.location ? "bg-safe/15 text-safe" : "bg-signal/15 text-signal"}`}>{values.location ? <MapPinCheck size={19} aria-hidden="true" /> : <LocateFixed size={19} aria-hidden="true" />}</span><div><h3 className="text-sm font-semibold">Live location required</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Coordinates are acquired directly from this device after your permission. They are not manually entered or displayed at full precision in the workspace.</p></div></div><button type="button" onClick={() => void acquireLocation()} disabled={isBusy || locationPending} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-signal/55 px-4 py-2 text-sm font-semibold text-signal transition hover:bg-signal/10 disabled:cursor-not-allowed disabled:opacity-50"><LocateFixed size={16} aria-hidden="true" />{locationPending ? "Locating…" : values.location ? "Refresh live location" : "Use live location"}</button></div>
          {values.location && <p className="mt-3 rounded-lg border border-safe/30 bg-safe/10 px-3 py-2 text-xs text-safe">Live location captured at {new Date(values.location.capturedAt).toLocaleTimeString()}{values.location.accuracyM === null ? "" : ` · accuracy approximately ${Math.round(values.location.accuracyM)} m`}. KAVACH will use it only to match nearby public structure records and local context.</p>}
        </section>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas/30 p-4 text-sm text-muted">
          <input checked={values.offlineConsent} onChange={(event) => setField("offlineConsent", event.target.checked)} disabled={isBusy || locationPending} className="mt-1 h-4 w-4 accent-cyan-300" type="checkbox" />
          <span>When offline, I permit this device to keep this image and the live location captured for this audit in a browser-storage queue until I reconnect or remove it.</span>
        </label>

        <AnimatePresence initial={false}>
          {localError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg border border-critical/50 bg-critical/10 px-3 py-2 text-sm text-critical" role="alert">{localError}</motion.p>}
        </AnimatePresence>

        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-5 text-muted"><Camera size={15} aria-hidden="true" />Visual screening supports inspection decisions; it does not replace a qualified engineer’s assessment.</p>
          <button type="submit" disabled={isBusy || locationPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-bold text-canvas transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
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
