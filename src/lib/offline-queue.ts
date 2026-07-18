"use client";
import { deleteDB, openDB } from "idb";

const DATABASE_NAME = "kavach-offline-audits";
const STORE_NAME = "pending-audits";

export type QueuedAudit = {
  id: string;
  createdAt: string;
  file: File;
  metadata: {
    assetName: string;
    assetType: string;
    capturedAt: string;
    latitude: string;
    longitude: string;
    altitudeM: string;
    headingDeg: string;
    locationConsent: boolean;
  };
  idempotencyKey: string;
  retryCount: number;
  lastError: string | null;
};

const database = () => openDB(DATABASE_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
  }
});

export async function listQueuedAudits() {
  return (await database()).getAll(STORE_NAME) as Promise<QueuedAudit[]>;
}

export async function enqueueAudit(audit: QueuedAudit) {
  await (await database()).put(STORE_NAME, audit);
}

export async function removeQueuedAudit(id: string) {
  await (await database()).delete(STORE_NAME, id);
}

export async function markQueuedAuditError(audit: QueuedAudit, error: string) {
  await (await database()).put(STORE_NAME, { ...audit, retryCount: audit.retryCount + 1, lastError: error });
}

export async function clearQueuedAudits() {
  await (await database()).clear(STORE_NAME);
}

export async function deleteQueueDatabase() {
  await deleteDB(DATABASE_NAME);
}
