"use client";
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { CompleteAudit } from "@/lib/schemas";

export const scanStatuses = [
  "IDLE",
  "VALIDATING_UPLOAD",
  "PREPARING_TILES",
  "ANALYZING_MORPHOLOGY",
  "RESOLVING_ASSET_CONTEXT",
  "CALCULATING_STRESS",
  "ASSESSING_ENVIRONMENT",
  "PREDICTING_DEGRADATION",
  "SAVING_REPORT",
  "QUEUED_OFFLINE",
  "COMPLETE",
  "ERROR"
] as const;

export type ScanStatus = typeof scanStatuses[number];
export type AuditResponse = CompleteAudit & { idempotent: boolean };

type ScanState = {
  status: ScanStatus;
  result: AuditResponse | null;
  error: string | null;
  selectedAnomalyId: string | null;
  previewUrl: string | null;
};

type ScanAction =
  | { type: "STATUS"; status: ScanStatus }
  | { type: "RESULT"; result: AuditResponse }
  | { type: "ERROR"; message: string }
  | { type: "SELECT_ANOMALY"; id: string | null }
  | { type: "PREVIEW"; url: string | null }
  | { type: "RESET" };

const initialState: ScanState = {
  status: "IDLE",
  result: null,
  error: null,
  selectedAnomalyId: null,
  previewUrl: null
};

function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case "STATUS":
      return { ...state, status: action.status, error: action.status === "ERROR" ? state.error : null };
    case "RESULT":
      return { ...state, result: action.result, status: "COMPLETE", error: null, selectedAnomalyId: action.result.finalAudit.findings[0]?.anomalyId ?? null };
    case "ERROR":
      return { ...state, status: "ERROR", error: action.message };
    case "SELECT_ANOMALY":
      return { ...state, selectedAnomalyId: action.id };
    case "PREVIEW":
      return { ...state, previewUrl: action.url };
    case "RESET":
      return { ...initialState, previewUrl: state.previewUrl };
  }
}

const ScanContext = createContext<{ state: ScanState; dispatch: Dispatch<ScanAction> } | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(scanReducer, initialState);
  return <ScanContext.Provider value={{ state, dispatch }}>{children}</ScanContext.Provider>;
}

export function useScan() {
  const context = useContext(ScanContext);
  if (!context) throw new Error("useScan must be used inside ScanProvider.");
  return context;
}
