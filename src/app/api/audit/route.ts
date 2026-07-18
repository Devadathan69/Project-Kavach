import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "@/lib/env";
import { AuditExecutionError, findExistingAudit, formatZodError, parseAuditMetadata, runAudit } from "@/lib/orchestrator";
import { ImageValidationError, storeAndTileImage, validateImageBytes, type AcceptedMimeType } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const acceptedMimeTypes = new Set<AcceptedMimeType>(["image/jpeg", "image/png", "image/webp"]);

function nullableString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function nullableNumber(value: FormDataEntryValue | null) {
  const raw = nullableString(value);
  return raw === null ? null : Number(raw);
}

function booleanValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "1" || value === "yes";
}

function parseDataUrl(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) {
    throw new ImageValidationError("INVALID_DATA_URL", "The image data URL is not a supported Base64 image.");
  }
  return { mimeType: match[1].toLowerCase() as AcceptedMimeType, bytes: Buffer.from(match[2], "base64"), filename: "camera-capture" };
}

async function extractImage(formData: FormData) {
  const suppliedFile = formData.get("image");
  if (suppliedFile instanceof File) {
    const mimeType = suppliedFile.type as AcceptedMimeType;
    if (!acceptedMimeTypes.has(mimeType)) {
      throw new ImageValidationError("UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, and WebP images are accepted.");
    }
    if (suppliedFile.size === 0) {
      throw new ImageValidationError("EMPTY_IMAGE", "Choose a non-empty inspection image.");
    }
    if (suppliedFile.size > env.maxUploadBytes) {
      throw new ImageValidationError("PAYLOAD_TOO_LARGE", `The image exceeds the ${(env.maxUploadBytes / 1024 / 1024).toFixed(0)} MB upload limit.`);
    }
    return { mimeType, bytes: Buffer.from(await suppliedFile.arrayBuffer()), filename: suppliedFile.name || "inspection-image" };
  }

  const imageDataUrl = nullableString(formData.get("imageDataUrl"));
  if (imageDataUrl) return parseDataUrl(imageDataUrl);
  throw new ImageValidationError("MISSING_IMAGE", "Choose an inspection image before starting an audit.");
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "INVALID_MULTIPART_BODY", "Submit the audit as multipart form data.");
  }

  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim() || nullableString(formData.get("idempotencyKey")) || `audit-${randomUUID()}`;
  let metadata;
  try {
    metadata = parseAuditMetadata({
      assetName: nullableString(formData.get("assetName")),
      assetType: nullableString(formData.get("assetType")),
      capturedAt: nullableString(formData.get("capturedAt")),
      latitude: nullableNumber(formData.get("latitude")),
      longitude: nullableNumber(formData.get("longitude")),
      altitudeM: nullableNumber(formData.get("altitudeM")),
      headingDeg: nullableNumber(formData.get("headingDeg")),
      structuralAgeYears: nullableNumber(formData.get("structuralAgeYears")),
      locationConsent: booleanValue(formData.get("locationConsent")),
      idempotencyKey
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "INVALID_AUDIT_METADATA", "Review the asset details and location consent.", formatZodError(error));
    }
    return errorResponse(400, "INVALID_AUDIT_METADATA", "Review the audit details.");
  }

  const existing = await findExistingAudit(metadata.idempotencyKey);
  if (existing) {
    return NextResponse.json({ ...existing, idempotent: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const image = await extractImage(formData);
    validateImageBytes(image.bytes, image.mimeType);
    const storedImage = await storeAndTileImage(image.bytes, image.mimeType);
    const audit = await runAudit({ storedImage, metadata });
    return NextResponse.json({ ...audit, idempotent: false }, { status: audit.persistence.saved ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImageValidationError) {
      const status = error.code === "PAYLOAD_TOO_LARGE" ? 413 : error.code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : 400;
      return errorResponse(status, error.code, error.message);
    }
    if (error instanceof AuditExecutionError) {
      return errorResponse(424, error.code, "KAVACH could not complete the analysis. You can safely retry this audit.");
    }
    console.error("KAVACH audit route failed", error);
    return errorResponse(500, "AUDIT_UNEXPECTED_FAILURE", "KAVACH could not process this audit. No result has been recorded.");
  }
}
