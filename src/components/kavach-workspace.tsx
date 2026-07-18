"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { AnalysisCanvas } from "@/components/analysis-canvas";
import { FindingsTable } from "@/components/findings-table";
import { OfflineQueueStatus } from "@/components/offline-queue-status";
import { PwaRegistration } from "@/components/pwa-registration";
import { ReportPanel } from "@/components/report-panel";
import { RiskDashboard } from "@/components/risk-dashboard";
import { ScanProgress } from "@/components/scan-progress";
import { ScanProvider, useScan, type AuditResponse } from "@/components/scan-context";
import { TelemetrySidebar } from "@/components/telemetry-sidebar";
import { UploadPanel, type AuditFormValues } from "@/components/upload-panel";
import { clearQueuedAudits, enqueueAudit, listQueuedAudits, markQueuedAuditError, removeQueuedAudit, type QueuedAudit } from "@/lib/offline-queue";

export function KavachWorkspace({ demoMode, modelName }: { demoMode: boolean; modelName: string }) {
  return <ScanProvider><Workspace demoMode={demoMode} modelName={modelName} /></ScanProvider>;
}

function Workspace({ demoMode, modelName }: { demoMode: boolean; modelName: string }) {
  const { state, dispatch } = useScan();
  const [queuedAudits, setQueuedAudits] = useState<QueuedAudit[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const previewUrl = useRef<string | null>(null);
  const submissionEpoch = useRef(0);
  const busy = !["IDLE", "COMPLETE", "ERROR", "QUEUED_OFFLINE"].includes(state.status);

  const refreshQueue = useCallback(async () => {
    const queued = await listQueuedAudits();
    setQueuedAudits(queued.sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
  }, []);

  const postAudit = useCallback(async (file: File, values: QueuedAudit["metadata"], idempotencyKey: string) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("assetName", values.assetName);
    formData.append("assetType", values.assetType);
    if (values.capturedAt) formData.append("capturedAt", new Date(values.capturedAt).toISOString());
    if (values.latitude) formData.append("latitude", values.latitude);
    if (values.longitude) formData.append("longitude", values.longitude);
    if (values.altitudeM) formData.append("altitudeM", values.altitudeM);
    if (values.headingDeg) formData.append("headingDeg", values.headingDeg);
    formData.append("locationSource", values.locationSource);
    formData.append("locationConsent", String(values.locationConsent));
    formData.append("idempotencyKey", idempotencyKey);

    const response = await fetch("/api/audit", { method: "POST", body: formData, headers: { "x-idempotency-key": idempotencyKey } });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error && typeof body.error.message === "string"
        ? body.error.message
        : "KAVACH could not process this audit. You can safely retry.";
      throw new Error(message);
    }
    return body as AuditResponse;
  }, []);

  const replayQueue = useCallback(async () => {
    if (!navigator.onLine || isRetrying) return;
    setIsRetrying(true);
    try {
      const queued = await listQueuedAudits();
      for (const queuedAudit of queued.sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
        try {
          dispatch({ type: "STATUS", status: "ANALYZING_MORPHOLOGY" });
          const result = await postAudit(queuedAudit.file, queuedAudit.metadata, queuedAudit.idempotencyKey);
          await removeQueuedAudit(queuedAudit.id);
          dispatch({ type: "RESULT", result });
        } catch (error) {
          await markQueuedAuditError(queuedAudit, error instanceof Error ? error.message : "Retry failed");
          break;
        }
      }
      await refreshQueue();
    } finally {
      setIsRetrying(false);
    }
  }, [dispatch, isRetrying, postAudit, refreshQueue]);

  useEffect(() => {
    void refreshQueue();
    const online = () => void replayQueue();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [refreshQueue, replayQueue]);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const handlePreview = useCallback((file: File | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    dispatch({ type: "PREVIEW", url: previewUrl.current });
  }, [dispatch]);

  const handleSubmit = useCallback(async (values: AuditFormValues) => {
    if (!values.file) return;
    const liveLocation = values.locationMode === "LIVE_DEVICE" ? values.location : null;
    const metadata = {
      assetName: values.assetName,
      assetType: values.assetType,
      capturedAt: liveLocation?.capturedAt ?? new Date().toISOString(),
      latitude: liveLocation ? String(liveLocation.latitude) : "",
      longitude: liveLocation ? String(liveLocation.longitude) : "",
      altitudeM: liveLocation?.altitudeM === null || !liveLocation ? "" : String(liveLocation.altitudeM),
      headingDeg: liveLocation?.headingDeg === null || !liveLocation ? "" : String(liveLocation.headingDeg),
      locationSource: values.locationMode,
      locationConsent: values.locationMode === "LIVE_DEVICE"
    };
    const idempotencyKey = `audit-${crypto.randomUUID()}`;
    if (!navigator.onLine) {
      if (!values.offlineConsent) {
        dispatch({ type: "ERROR", message: "You are offline. Confirm local queue consent if you want this device to retain the image until you reconnect." });
        return;
      }
      await enqueueAudit({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), file: values.file, metadata, idempotencyKey, retryCount: 0, lastError: null });
      await refreshQueue();
      dispatch({ type: "STATUS", status: "QUEUED_OFFLINE" });
      return;
    }

    const epoch = ++submissionEpoch.current;
    try {
      dispatch({ type: "STATUS", status: "VALIDATING_UPLOAD" });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      dispatch({ type: "STATUS", status: "PREPARING_TILES" });
      const resultPromise = postAudit(values.file, metadata, idempotencyKey);
      dispatch({ type: "STATUS", status: "ANALYZING_MORPHOLOGY" });
      const result = await resultPromise;
      if (epoch !== submissionEpoch.current) return;
      dispatch({ type: "RESULT", result });
    } catch (error) {
      if (epoch === submissionEpoch.current) dispatch({ type: "ERROR", message: error instanceof Error ? error.message : "KAVACH could not process this audit." });
    }
  }, [dispatch, postAudit, refreshQueue]);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <PwaRegistration />
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-signal/45 bg-signal/10 font-mono text-lg font-bold text-signal">K</span><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">KAVACH</p><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Autonomous structural health audit</h1></div></div><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">High-detail visual forensic screening for coastal and high-humidity infrastructure. Every conclusion remains subject to qualified engineering review.</p></div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 font-mono text-xs text-muted"><ShieldCheck size={15} className="text-safe" aria-hidden="true" />SECURE VISUAL INTAKE</div>
        </header>

        <div className="grid gap-5">
          <UploadPanel onSubmit={handleSubmit} onPreview={handlePreview} isBusy={busy} demoMode={state.result?.demoMode ?? demoMode} modelName={modelName} />
          <OfflineQueueStatus audits={queuedAudits} onRetry={() => void replayQueue()} onClear={() => void clearQueuedAudits().then(refreshQueue)} isRetrying={isRetrying} />
          {state.status !== "IDLE" && <ScanProgress status={state.status} demoMode={state.result?.demoMode ?? demoMode} />}
          {state.error && <div className="flex gap-3 rounded-xl border border-critical/50 bg-critical/10 p-4 text-sm text-critical" role="alert"><AlertCircle className="shrink-0" size={19} aria-hidden="true" /><p>{state.error}</p></div>}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <AnalysisCanvas previewUrl={state.previewUrl} result={state.result} status={state.status} selectedAnomalyId={state.selectedAnomalyId} onSelect={(id) => dispatch({ type: "SELECT_ANOMALY", id })} />
            <TelemetrySidebar result={state.result} />
          </div>
          {state.result && <div className="grid gap-5"><RiskDashboard result={state.result} /><FindingsTable result={state.result} selectedAnomalyId={state.selectedAnomalyId} onSelect={(id) => dispatch({ type: "SELECT_ANOMALY", id })} /><ReportPanel result={state.result} />{state.result.persistence.warning && <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm leading-6 text-warning" role="status">{state.result.persistence.warning}</p>}</div>}
        </div>
      </div>
    </main>
  );
}
