import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { resolveAssetContext } from "@/lib/asset-context";
import { ANALYSIS_VERSION, isDiagonalShearAngle, riskForHealthIndex, urgencyForRisk } from "@/lib/domain";
import { demoEnvironment, demoFinal, demoMorphology, demoStress } from "@/lib/demo";
import { env } from "@/lib/env";
import { runLiveEnvironment, runLiveFinal, runLiveMorphology, runLiveStress } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { AuditMetadataSchema, CompleteAuditSchema, EnvironmentalContextSchema, type AuditMetadata, type CompleteAudit, type EnvironmentalContext, type FinalAudit, type MorphologicalProfile, type StructuralStress } from "@/lib/schemas";
import type { StoredImage } from "@/lib/storage";

type RunAuditInput = {
  storedImage: StoredImage;
  metadata: AuditMetadata;
};

type LocatedAnomaly = MorphologicalProfile["tiles"][number]["anomalies"][number] & {
  tile: MorphologicalProfile["tiles"][number];
};

export class AuditExecutionError extends Error {
  constructor(message: string, public readonly code = "ANALYSIS_UNAVAILABLE") {
    super(message);
    this.name = "AuditExecutionError";
  }
}

export async function findExistingAudit(idempotencyKey: string): Promise<CompleteAudit | null> {
  if (!prisma) return null;
  try {
    const existing = await prisma.report.findUnique({
      where: { idempotencyKey },
      select: { rawAnalysisJson: true }
    });
    if (!existing?.rawAnalysisJson) return null;
    const parsed = CompleteAuditSchema.safeParse(existing.rawAnalysisJson);
    if (!parsed.success) return null;
    return { ...parsed.data, persistence: { saved: true, warning: null } };
  } catch (error) {
    console.error("KAVACH could not look up a prior idempotent report", error);
    return null;
  }
}

function assertTileGeometry(profile: MorphologicalProfile, storedImage: StoredImage): MorphologicalProfile {
  const declaredTiles = new Map(storedImage.tiles.map((tile) => [tile.tileId, tile]));
  const seen = new Set<string>();

  const transformedTiles = profile.tiles.map((tile) => {
    const declared = declaredTiles.get(tile.tileId);
    if (!declared || declared.xPx !== tile.xPx || declared.yPx !== tile.yPx || declared.widthPx !== tile.widthPx || declared.heightPx !== tile.heightPx) {
      throw new AuditExecutionError(`Morphology returned an unrecognised tile geometry for ${tile.tileId}.`, "INVALID_MODEL_OUTPUT");
    }
    seen.add(tile.tileId);

    return {
      ...tile,
      anomalies: tile.anomalies.map((anomaly) => {
        const { boundingBoxPx, centroidPx } = anomaly;
        const insideTile = centroidPx.x <= tile.widthPx && centroidPx.y <= tile.heightPx && boundingBoxPx.xMax <= tile.widthPx && boundingBoxPx.yMax <= tile.heightPx;
        if (!insideTile) {
          throw new AuditExecutionError(`Morphology returned out-of-bounds geometry for ${anomaly.anomalyId}.`, "INVALID_MODEL_OUTPUT");
        }
        return {
          ...anomaly,
          centroidPx: { x: centroidPx.x + tile.xPx, y: centroidPx.y + tile.yPx },
          boundingBoxPx: {
            xMin: boundingBoxPx.xMin + tile.xPx,
            yMin: boundingBoxPx.yMin + tile.yPx,
            xMax: boundingBoxPx.xMax + tile.xPx,
            yMax: boundingBoxPx.yMax + tile.yPx
          }
        };
      })
    };
  });

  if (seen.size !== declaredTiles.size || profile.imageWidthPx !== storedImage.widthPx || profile.imageHeightPx !== storedImage.heightPx) {
    throw new AuditExecutionError("Morphology did not return the declared source-image geometry.", "INVALID_MODEL_OUTPUT");
  }

  const retained: Array<{ xMin: number; yMin: number; xMax: number; yMax: number; type: string }> = [];
  const deduplicatedTiles = transformedTiles.map((tile) => ({
    ...tile,
    anomalies: tile.anomalies.filter((anomaly) => {
      const candidate = { ...anomaly.boundingBoxPx, type: anomaly.type };
      const duplicate = retained.some((prior) => candidate.type === prior.type && intersectionOverUnion(candidate, prior) >= 0.65);
      if (!duplicate) retained.push(candidate);
      return !duplicate;
    })
  }));

  return { ...profile, tiles: deduplicatedTiles };
}

function intersectionOverUnion(
  left: { xMin: number; yMin: number; xMax: number; yMax: number },
  right: { xMin: number; yMin: number; xMax: number; yMax: number }
) {
  const xOverlap = Math.max(0, Math.min(left.xMax, right.xMax) - Math.max(left.xMin, right.xMin));
  const yOverlap = Math.max(0, Math.min(left.yMax, right.yMax) - Math.max(left.yMin, right.yMin));
  const intersection = xOverlap * yOverlap;
  const leftArea = (left.xMax - left.xMin) * (left.yMax - left.yMin);
  const rightArea = (right.xMax - right.xMin) * (right.yMax - right.yMin);
  return intersection / (leftArea + rightArea - intersection);
}

function collectAnomalies(profile: MorphologicalProfile): Map<string, LocatedAnomaly> {
  const anomalies = new Map<string, LocatedAnomaly>();
  for (const tile of profile.tiles) {
    for (const anomaly of tile.anomalies) {
      if (anomalies.has(anomaly.anomalyId)) {
        throw new AuditExecutionError(`Morphology reused anomaly id ${anomaly.anomalyId}.`, "INVALID_MODEL_OUTPUT");
      }
      anomalies.set(anomaly.anomalyId, { ...anomaly, tile });
    }
  }
  return anomalies;
}

function validateStress(profile: MorphologicalProfile, stress: StructuralStress) {
  const anomalyIds = collectAnomalies(profile);
  const returned = new Set<string>();
  for (const item of stress.anomalies) {
    if (!anomalyIds.has(item.anomalyId) || returned.has(item.anomalyId)) {
      throw new AuditExecutionError("Structural stress output references an invalid or repeated anomaly.", "INVALID_MODEL_OUTPUT");
    }
    returned.add(item.anomalyId);
    const expectedCandidate = item.orientationDegrees !== null && isDiagonalShearAngle(item.orientationDegrees) && item.isNearLoadBearingJunction;
    if (item.diagonalShearAssessment.isCandidate !== expectedCandidate) {
      throw new AuditExecutionError("Structural stress output violates the deterministic shear-screening rule.", "INVALID_MODEL_OUTPUT");
    }
  }
}

function validateFinal(profile: MorphologicalProfile, finalAudit: FinalAudit) {
  const anomalyIds = collectAnomalies(profile);
  const expectedRisk = riskForHealthIndex(finalAudit.structuralHealthIndex);
  const expectedUrgency = urgencyForRisk(expectedRisk);
  if (finalAudit.riskLevel !== expectedRisk || finalAudit.remedialUrgency !== expectedUrgency) {
    throw new AuditExecutionError("Final audit score, risk level, and urgency are inconsistent.", "INVALID_MODEL_OUTPUT");
  }
  for (const finding of finalAudit.findings) {
    if (!anomalyIds.has(finding.anomalyId)) {
      throw new AuditExecutionError("Final audit references an unknown anomaly.", "INVALID_MODEL_OUTPUT");
    }
  }
}

function appendLimitation(limitations: string[], limitation: string, maximum: number) {
  return limitations.includes(limitation) ? limitations : [...limitations, limitation].slice(0, maximum);
}

function enforceMorphologyMeasurementSafety(profile: MorphologicalProfile, metadata: AuditMetadata): MorphologicalProfile {
  const limitation = "No declared scale marker was supplied; physical millimetre measurements have been withheld and only pixel-relative geometry is available.";
  if (metadata.measurementMode === "REFERENCE_MARKER") {
    return {
      ...profile,
      limitations: appendLimitation(profile.limitations, "A visible reference marker was declared by the operator. Any physical dimensions remain visual estimates and require field verification.", 16)
    };
  }

  return {
    ...profile,
    tiles: profile.tiles.map((tile) => ({
      ...tile,
      anomalies: tile.anomalies.map((anomaly) => ({
        ...anomaly,
        crackGeometry: {
          ...anomaly.crackGeometry,
          lengthMm: null,
          widthMinMm: null,
          widthMaxMm: null,
          widthAverageMm: null,
          depthEstimateMm: null,
          surfaceAreaMm2: null
        }
      }))
    })),
    limitations: appendLimitation(profile.limitations, limitation, 16)
  };
}

function enforceStressMeasurementSafety(stress: StructuralStress, metadata: AuditMetadata): StructuralStress {
  if (metadata.measurementMode === "REFERENCE_MARKER") return stress;
  return {
    ...stress,
    anomalies: stress.anomalies.map((anomaly) => ({ ...anomaly, distanceToStructuralElementMm: null })),
    limitations: appendLimitation(stress.limitations, "Distances in millimetres are withheld because the inspection image has no declared scale marker.", 16)
  };
}

function enforceFinalMeasurementSafety(finalAudit: FinalAudit, metadata: AuditMetadata): FinalAudit {
  if (metadata.measurementMode === "REFERENCE_MARKER") return finalAudit;
  return {
    ...finalAudit,
    humanReviewRequired: true,
    limitations: appendLimitation(finalAudit.limitations, "This result is uncalibrated visual triage. It must not be used as a physical crack measurement or a structural design decision.", 20)
  };
}

function enforceFinalRiskClassification(finalAudit: FinalAudit): FinalAudit {
  const riskLevel = riskForHealthIndex(finalAudit.structuralHealthIndex);
  const remedialUrgency = urgencyForRisk(riskLevel);
  if (finalAudit.riskLevel === riskLevel && finalAudit.remedialUrgency === remedialUrgency) return finalAudit;

  return {
    ...finalAudit,
    riskLevel,
    remedialUrgency,
    limitations: appendLimitation(finalAudit.limitations, "Risk level and remedial urgency were derived deterministically from the visual triage index.", 20)
  };
}

function unavailableEnvironmentalContext(metadata: AuditMetadata, source: string): EnvironmentalContext {
  return EnvironmentalContextSchema.parse({
    coordinates: { latitude: metadata.latitude, longitude: metadata.longitude },
    coastalExposure: { coastDistanceKm: null, salinityExposure: null },
    climate: { monsoonRainfallMmAnnual: null, humidityPercent: null, temperatureC: null, observedAt: null, source },
    structure: { structuralAgeYears: metadata.structuralAgeYears, drainageCondition: "UNKNOWN" },
    environmentalRiskScore: 0,
    riskNarrative: "No environmental risk score was issued because no approved environmental source was available for this audit.",
    limitations: ["Environmental values are unavailable. KAVACH does not infer climate, salinity, rainfall, humidity, or coastal distance without an approved data source."]
  });
}

async function approvedEnvironmentalSource() {
  if (!env.environmentDataUrl) {
    return { source: "No approved environmental data source configured", data: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(env.environmentDataUrl, { signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return { source: `Approved environmental source unavailable (${response.status})`, data: null };
    return { source: env.environmentDataUrl, data: await response.json() as unknown };
  } catch {
    return { source: "Approved environmental source unavailable", data: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runAudit(input: RunAuditInput): Promise<CompleteAudit> {
  try {
    return await executeAudit(input);
  } catch (error) {
    if (error instanceof AuditExecutionError) throw error;
    console.error("KAVACH audit orchestration failed", error);
    throw new AuditExecutionError(
      error instanceof Error ? `The audit pipeline could not complete safely: ${error.message}` : "The audit pipeline could not complete safely.",
      "PIPELINE_FAILURE"
    );
  }
}

async function executeAudit({ storedImage, metadata }: RunAuditInput): Promise<CompleteAudit> {
  const stageTrace = ["VALIDATING_UPLOAD", "PREPARING_TILES", "ANALYZING_MORPHOLOGY"];
  const scanId = storedImage.auditId;
  let morphology: MorphologicalProfile;

  try {
    morphology = env.demoMode
      ? demoMorphology(scanId, storedImage.widthPx, storedImage.heightPx, storedImage.tiles)
      : await runLiveMorphology({
        scanId,
        imageWidthPx: storedImage.widthPx,
        imageHeightPx: storedImage.heightPx,
        measurementEvidence: {
          mode: metadata.measurementMode,
          referenceMarkerMm: metadata.referenceMarkerMm,
          instruction: metadata.measurementMode === "REFERENCE_MARKER"
            ? "A visible marker was declared by the operator. Treat any physical dimensions as visual estimates only."
            : "No scale marker is available. Return null for every millimetre or square-millimetre field."
        },
        tiles: storedImage.tiles.map(({ tileId, xPx, yPx, widthPx, heightPx }) => ({ tileId, xPx, yPx, widthPx, heightPx }))
      }, storedImage.tiles);
    morphology = assertTileGeometry(morphology, storedImage);
    morphology = enforceMorphologyMeasurementSafety(morphology, metadata);
  } catch (error) {
    if (env.demoMode) throw error;
    throw new AuditExecutionError(error instanceof Error ? error.message : "Morphological analysis failed.");
  }

  stageTrace.push("RESOLVING_ASSET_CONTEXT");
  const assetContext = await resolveAssetContext(metadata);
  const resolvedCoordinates = assetContext.resolvedCoordinates;
  const enrichedMetadata = AuditMetadataSchema.parse({
    ...metadata,
    latitude: resolvedCoordinates?.latitude ?? metadata.latitude,
    longitude: resolvedCoordinates?.longitude ?? metadata.longitude,
    locationSource: resolvedCoordinates ? "STRUCTURE_LOOKUP" : metadata.locationSource,
    locationConsent: resolvedCoordinates ? false : metadata.locationConsent,
    structuralAgeYears: assetContext.construction.structuralAgeYears ?? metadata.structuralAgeYears
  });

  stageTrace.push("CALCULATING_STRESS", "ASSESSING_ENVIRONMENT");
  const environmentalSourcePromise = approvedEnvironmentalSource();
  const stressPromise = env.demoMode
    ? Promise.resolve(demoStress())
    : runLiveStress({ morphologicalProfile: morphology, assetMetadata: { assetName: enrichedMetadata.assetName, assetType: enrichedMetadata.assetType, structuralAgeYears: enrichedMetadata.structuralAgeYears }, assetContext });
  const environmentPromise = env.demoMode
    ? Promise.resolve(demoEnvironment(enrichedMetadata))
    : environmentalSourcePromise.then((source) => source.data === null
      ? unavailableEnvironmentalContext(enrichedMetadata, source.source)
      : runLiveEnvironment({ morphologicalProfile: morphology, metadata: enrichedMetadata, assetContext, approvedEnvironmentalSource: source }));

  const [rawStress, environmentalContext] = await Promise.all([stressPromise, environmentPromise]);
  const stress = enforceStressMeasurementSafety(rawStress, enrichedMetadata);
  validateStress(morphology, stress);

  stageTrace.push("PREDICTING_DEGRADATION");
  const generatedFinalAudit = env.demoMode
    ? demoFinal()
    : await runLiveFinal({ morphologicalProfile: morphology, assetContext, structuralStress: stress, environmentalContext, metadata: enrichedMetadata });
  const classifiedFinalAudit = enforceFinalRiskClassification(generatedFinalAudit);
  const finalAudit = enforceFinalMeasurementSafety(classifiedFinalAudit, enrichedMetadata);
  validateFinal(morphology, finalAudit);

  stageTrace.push("SAVING_REPORT");
  const incomplete = {
    reportId: storedImage.auditId,
    idempotencyKey: metadata.idempotencyKey,
    analysisVersion: ANALYSIS_VERSION,
    demoMode: env.demoMode,
    modelName: env.demoMode ? null : env.openAiModel,
    sourceImage: {
      path: storedImage.relativePath,
      mimeType: storedImage.mimeType,
      widthPx: storedImage.widthPx,
      heightPx: storedImage.heightPx,
      sha256: storedImage.sha256
    },
    metadata: enrichedMetadata,
    morphologicalProfile: morphology,
    assetContext,
    structuralStress: stress,
    environmentalContext,
    finalAudit,
    stageTrace,
    persistence: { saved: false, warning: null }
  };

  let persistenceWarning: string | null = null;
  if (prisma) {
    try {
      await persistAudit(incomplete);
    } catch (error) {
      console.error("KAVACH could not persist audit; returning validated analysis", error);
      persistenceWarning = "The analysis completed, but its database record could not be saved. Download or copy the report before leaving this page.";
    }
  } else {
    persistenceWarning = "Database persistence is not configured; this validated analysis is available only in this browser session.";
  }

  const complete = CompleteAuditSchema.parse({
    ...incomplete,
    stageTrace: [...stageTrace, "COMPLETE"],
    persistence: { saved: persistenceWarning === null, warning: persistenceWarning }
  });
  return complete;
}

async function persistAudit(audit: Omit<CompleteAudit, "persistence"> & { persistence: { saved: boolean; warning: string | null } }) {
  if (!prisma) return;
  const anomalies = collectAnomalies(audit.morphologicalProfile);
  const stressByAnomaly = new Map(audit.structuralStress.anomalies.map((item) => [item.anomalyId, item]));
  const recommendations = new Map(audit.finalAudit.findings.map((finding) => [finding.anomalyId, finding.recommendedAction]));
  const rawAnalysisJson = { ...audit, persistence: { saved: true, warning: null } } as Prisma.InputJsonValue;

  await prisma.$transaction(async (transaction) => {
    await transaction.report.create({
      data: {
        id: audit.reportId,
        status: "COMPLETE",
        idempotencyKey: audit.idempotencyKey,
        demoMode: audit.demoMode,
        analysisVersion: audit.analysisVersion,
        modelName: audit.modelName,
        sourceImagePath: audit.sourceImage.path,
        sourceImageSha256: audit.sourceImage.sha256,
        sourceImageMimeType: audit.sourceImage.mimeType,
        sourceImageWidthPx: audit.sourceImage.widthPx,
        sourceImageHeightPx: audit.sourceImage.heightPx,
        originalFilename: null,
        capturedAt: audit.metadata.capturedAt ? new Date(audit.metadata.capturedAt) : null,
        latitude: audit.metadata.latitude,
        longitude: audit.metadata.longitude,
        altitudeM: audit.metadata.altitudeM,
        headingDeg: audit.metadata.headingDeg,
        assetName: audit.metadata.assetName,
        assetType: audit.metadata.assetType,
        structuralAgeYears: audit.metadata.structuralAgeYears,
        structuralHealthIndex: audit.finalAudit.structuralHealthIndex,
        riskLevel: audit.finalAudit.riskLevel,
        remedialUrgency: audit.finalAudit.remedialUrgency,
        summary: audit.finalAudit.executiveSummary,
        reportEnglish: audit.finalAudit.reportEnglish,
        reportMalayalam: audit.finalAudit.reportMalayalam,
        rawAnalysisJson,
        completedAt: new Date()
      }
    });

    if (anomalies.size > 0) {
      await transaction.anomaly.createMany({
        data: [...anomalies.values()].map((anomaly, index) => {
          const stress = stressByAnomaly.get(anomaly.anomalyId);
          return {
            reportId: audit.reportId,
            ordinal: index + 1,
            type: anomaly.type,
            severity: anomaly.severity,
            confidence: anomaly.confidence,
            description: anomaly.description,
            recommendation: recommendations.get(anomaly.anomalyId) ?? "Qualified engineering review required.",
            tileX: anomaly.tile.xPx,
            tileY: anomaly.tile.yPx,
            tileWidthPx: anomaly.tile.widthPx,
            tileHeightPx: anomaly.tile.heightPx,
            centroidXPx: anomaly.centroidPx.x,
            centroidYPx: anomaly.centroidPx.y,
            boundingBoxXMinPx: anomaly.boundingBoxPx.xMin,
            boundingBoxYMinPx: anomaly.boundingBoxPx.yMin,
            boundingBoxXMaxPx: anomaly.boundingBoxPx.xMax,
            boundingBoxYMaxPx: anomaly.boundingBoxPx.yMax,
            crackLengthMm: anomaly.crackGeometry.lengthMm,
            crackWidthMinMm: anomaly.crackGeometry.widthMinMm,
            crackWidthMaxMm: anomaly.crackGeometry.widthMaxMm,
            crackWidthAverageMm: anomaly.crackGeometry.widthAverageMm,
            crackDepthEstimateMm: anomaly.crackGeometry.depthEstimateMm,
            branchCount: anomaly.crackGeometry.branchCount,
            surfaceAreaMm2: anomaly.crackGeometry.surfaceAreaMm2,
            orientationDegrees: stress?.orientationDegrees ?? null,
            vectorDx: stress?.vector?.dx ?? null,
            vectorDy: stress?.vector?.dy ?? null,
            isDiagonalShearCandidate: stress?.diagonalShearAssessment.isCandidate ?? false,
            nearestStructuralElement: stress?.nearestStructuralElement ?? null,
            distanceToStructuralElementMm: stress?.distanceToStructuralElementMm ?? null,
            isNearLoadBearingJunction: stress?.isNearLoadBearingJunction ?? false,
            latitude: audit.metadata.latitude,
            longitude: audit.metadata.longitude
          };
        })
      });
    }

    await transaction.environmentalContext.create({
      data: {
        reportId: audit.reportId,
        latitude: audit.environmentalContext.coordinates.latitude,
        longitude: audit.environmentalContext.coordinates.longitude,
        coastDistanceKm: audit.environmentalContext.coastalExposure.coastDistanceKm,
        salinityExposure: audit.environmentalContext.coastalExposure.salinityExposure,
        monsoonRainfallMmAnnual: audit.environmentalContext.climate.monsoonRainfallMmAnnual,
        humidityPercent: audit.environmentalContext.climate.humidityPercent,
        temperatureC: audit.environmentalContext.climate.temperatureC,
        weatherObservedAt: audit.environmentalContext.climate.observedAt ? new Date(audit.environmentalContext.climate.observedAt) : null,
        structuralAgeYears: audit.environmentalContext.structure.structuralAgeYears,
        drainageCondition: audit.environmentalContext.structure.drainageCondition,
        environmentalRiskScore: audit.environmentalContext.environmentalRiskScore,
        riskNarrative: audit.environmentalContext.riskNarrative,
        dataSource: audit.environmentalContext.climate.source,
        rawContextJson: audit.environmentalContext as Prisma.InputJsonValue
      }
    });
  });
}

export function parseAuditMetadata(value: unknown) {
  return AuditMetadataSchema.parse(value);
}

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}
