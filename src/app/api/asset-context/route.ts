import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAssetContext } from "@/lib/asset-context";
import { applyRateLimit, clientRequestKey } from "@/lib/request-rate-limit";
import { AuditMetadataSchema } from "@/lib/schemas";

export const runtime = "nodejs";

const AssetPreflightSchema = z.object({
  assetName: z.string().trim().min(1).max(180),
  assetType: z.string().trim().min(1).max(120)
}).strict();

export async function POST(request: Request) {
  try {
    const input = AssetPreflightSchema.parse(await request.json());
    const rateLimit = applyRateLimit("asset-context", clientRequestKey(request), { limit: 20, windowMs: 10 * 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: { code: "ASSET_CONTEXT_RATE_LIMITED", message: `Too many public-record lookups were requested. Try again in about ${rateLimit.retryAfterSeconds} seconds.` } }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    }
    const metadata = AuditMetadataSchema.parse({
      ...input,
      capturedAt: null,
      latitude: null,
      longitude: null,
      altitudeM: null,
      headingDeg: null,
      structuralAgeYears: null,
      locationSource: "STRUCTURE_LOOKUP",
      locationConsent: false,
      measurementMode: "UNCALIBRATED",
      referenceMarkerMm: null,
      assetContextMode: "AUTO",
      confirmedAssetCandidateId: null,
      idempotencyKey: `asset-preflight-${randomUUID()}`
    });
    return NextResponse.json(await resolveAssetContext(metadata), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Enter a structure name before resolving its public evidence record."
      : "KAVACH could not resolve public structure evidence right now. You can continue with visual-only analysis.";
    return NextResponse.json({ error: { code: "ASSET_CONTEXT_UNAVAILABLE", message } }, { status: error instanceof z.ZodError ? 400 : 424 });
  }
}
