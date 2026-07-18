import { z } from "zod";

const finiteNumber = z.number().finite();
const nullableMeasurement = finiteNumber.nonnegative().nullable();

export const anomalyTypes = ["CRACK", "SPALLING", "EXPOSED_REBAR", "EFFLORESCENCE", "CORROSION", "OTHER"] as const;
export const anomalySeverities = ["MINOR", "MODERATE", "SEVERE", "CRITICAL"] as const;
export const riskLevels = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export const urgencies = ["MONITOR", "SCHEDULED", "PRIORITY", "IMMEDIATE"] as const;
export const salinityExposures = ["LOW", "MODERATE", "HIGH", "EXTREME"] as const;
export const drainageConditions = ["GOOD", "FAIR", "POOR", "UNKNOWN"] as const;

export const BoundingBoxSchema = z.object({
  xMin: finiteNumber.nonnegative(),
  yMin: finiteNumber.nonnegative(),
  xMax: finiteNumber.nonnegative(),
  yMax: finiteNumber.nonnegative()
}).strict().superRefine((box, context) => {
  if (box.xMax <= box.xMin) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "xMax must be greater than xMin.", path: ["xMax"] });
  }
  if (box.yMax <= box.yMin) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "yMax must be greater than yMin.", path: ["yMax"] });
  }
});

export const PointSchema = z.object({
  x: finiteNumber.nonnegative(),
  y: finiteNumber.nonnegative()
}).strict();

export const CrackGeometrySchema = z.object({
  lengthMm: nullableMeasurement,
  widthMinMm: nullableMeasurement,
  widthMaxMm: nullableMeasurement,
  widthAverageMm: nullableMeasurement,
  depthEstimateMm: nullableMeasurement,
  branchCount: z.number().int().nonnegative().nullable(),
  surfaceAreaMm2: nullableMeasurement
}).strict().superRefine((geometry, context) => {
  if (geometry.widthMinMm !== null && geometry.widthMaxMm !== null && geometry.widthMinMm > geometry.widthMaxMm) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "widthMinMm cannot exceed widthMaxMm.", path: ["widthMinMm"] });
  }
});

export const MorphologyAnomalySchema = z.object({
  anomalyId: z.string().min(1).max(96),
  type: z.enum(anomalyTypes),
  severity: z.enum(anomalySeverities),
  confidence: finiteNumber.min(0).max(1),
  description: z.string().min(1).max(1600),
  centroidPx: PointSchema,
  boundingBoxPx: BoundingBoxSchema,
  crackGeometry: CrackGeometrySchema,
  evidence: z.array(z.string().min(1).max(400)).min(1).max(8)
}).strict();

export const TileProfileSchema = z.object({
  tileId: z.string().min(1),
  xPx: z.number().int().nonnegative(),
  yPx: z.number().int().nonnegative(),
  widthPx: z.number().int().positive().max(2048),
  heightPx: z.number().int().positive().max(2048),
  anomalies: z.array(MorphologyAnomalySchema).max(80)
}).strict();

export const MorphologicalProfileSchema = z.object({
  scanId: z.string().min(1),
  imageWidthPx: z.number().int().positive(),
  imageHeightPx: z.number().int().positive(),
  tiles: z.array(TileProfileSchema).min(1),
  limitations: z.array(z.string().min(1).max(500)).max(16)
}).strict();

export const StructuralStressItemSchema = z.object({
  anomalyId: z.string().min(1),
  orientationDegrees: finiteNumber.min(0).lt(180).nullable(),
  vector: z.object({
    dx: finiteNumber.min(-1).max(1),
    dy: finiteNumber.min(-1).max(1)
  }).strict().nullable(),
  nearestStructuralElement: z.string().min(1).max(250).nullable(),
  distanceToStructuralElementMm: nullableMeasurement,
  isNearLoadBearingJunction: z.boolean(),
  diagonalShearAssessment: z.object({
    isCandidate: z.boolean(),
    targetDegrees: z.literal(45),
    toleranceDegrees: z.literal(5),
    rationale: z.string().min(1).max(800)
  }).strict(),
  structuralRiskScore: z.number().int().min(0).max(100)
}).strict();

export const StructuralStressSchema = z.object({
  anomalies: z.array(StructuralStressItemSchema).max(160),
  overallStructuralFinding: z.string().min(1).max(1800),
  limitations: z.array(z.string().min(1).max(500)).max(16)
}).strict();

export const EnvironmentalContextSchema = z.object({
  coordinates: z.object({
    latitude: finiteNumber.min(-90).max(90).nullable(),
    longitude: finiteNumber.min(-180).max(180).nullable()
  }).strict(),
  coastalExposure: z.object({
    coastDistanceKm: nullableMeasurement,
    salinityExposure: z.enum(salinityExposures).nullable()
  }).strict(),
  climate: z.object({
    monsoonRainfallMmAnnual: nullableMeasurement,
    humidityPercent: finiteNumber.min(0).max(100).nullable(),
    temperatureC: finiteNumber.min(-80).max(80).nullable(),
    observedAt: z.string().datetime({ offset: true }).nullable(),
    source: z.string().min(1).max(250)
  }).strict(),
  structure: z.object({
    structuralAgeYears: z.number().int().nonnegative().max(1000).nullable(),
    drainageCondition: z.enum(drainageConditions)
  }).strict(),
  environmentalRiskScore: z.number().int().min(0).max(100),
  riskNarrative: z.string().min(1).max(1800),
  limitations: z.array(z.string().min(1).max(500)).max(16)
}).strict();

export const FinalAuditSchema = z.object({
  reportTitle: z.string().min(1).max(250),
  structuralHealthIndex: z.number().int().min(0).max(100),
  riskLevel: z.enum(riskLevels),
  remedialUrgency: z.enum(urgencies),
  executiveSummary: z.string().min(1).max(1800),
  findings: z.array(z.object({
    anomalyId: z.string().min(1),
    priority: z.number().int().min(1).max(99),
    finding: z.string().min(1).max(1200),
    recommendedAction: z.string().min(1).max(1200),
    targetTimeframe: z.string().min(1).max(250)
  }).strict()).max(160),
  reportEnglish: z.string().min(1).max(10000),
  reportMalayalam: z.string().min(1).max(10000),
  limitations: z.array(z.string().min(1).max(500)).max(20),
  humanReviewRequired: z.boolean()
}).strict();

export const AuditMetadataSchema = z.object({
  assetName: z.string().trim().min(1).max(180),
  assetType: z.string().trim().min(1).max(120),
  capturedAt: z.string().datetime({ offset: true }).nullable(),
  latitude: finiteNumber.min(-90).max(90).nullable(),
  longitude: finiteNumber.min(-180).max(180).nullable(),
  altitudeM: finiteNumber.min(-1000).max(12000).nullable(),
  headingDeg: finiteNumber.min(0).lt(360).nullable(),
  structuralAgeYears: z.number().int().nonnegative().max(1000).nullable(),
  locationConsent: z.boolean(),
  idempotencyKey: z.string().min(12).max(150)
}).strict().superRefine((metadata, context) => {
  if ((metadata.latitude === null) !== (metadata.longitude === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Latitude and longitude must be supplied together.", path: ["latitude"] });
  }
  if (!metadata.locationConsent && (metadata.latitude !== null || metadata.longitude !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Location consent is required when coordinates are submitted.", path: ["locationConsent"] });
  }
});

export const CompleteAuditSchema = z.object({
  reportId: z.string().min(1),
  idempotencyKey: z.string().min(12),
  analysisVersion: z.string().min(1),
  demoMode: z.boolean(),
  modelName: z.string().min(1).nullable(),
  sourceImage: z.object({
    path: z.string().min(1),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
    sha256: z.string().length(64)
  }).strict(),
  metadata: AuditMetadataSchema,
  morphologicalProfile: MorphologicalProfileSchema,
  structuralStress: StructuralStressSchema,
  environmentalContext: EnvironmentalContextSchema,
  finalAudit: FinalAuditSchema,
  stageTrace: z.array(z.string().min(1)).min(1),
  persistence: z.object({
    saved: z.boolean(),
    warning: z.string().nullable()
  }).strict()
}).strict();

export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;
export type MorphologicalProfile = z.infer<typeof MorphologicalProfileSchema>;
export type StructuralStress = z.infer<typeof StructuralStressSchema>;
export type EnvironmentalContext = z.infer<typeof EnvironmentalContextSchema>;
export type FinalAudit = z.infer<typeof FinalAuditSchema>;
export type CompleteAudit = z.infer<typeof CompleteAuditSchema>;

export const responseContracts = {
  morphology: "{scanId,imageWidthPx,imageHeightPx,tiles:[{tileId,xPx,yPx,widthPx,heightPx,anomalies:[{anomalyId,type,severity,confidence,description,centroidPx:{x,y},boundingBoxPx:{xMin,yMin,xMax,yMax},crackGeometry:{lengthMm,widthMinMm,widthMaxMm,widthAverageMm,depthEstimateMm,branchCount,surfaceAreaMm2},evidence}]}],limitations}",
  stress: "{anomalies:[{anomalyId,orientationDegrees,vector:{dx,dy},nearestStructuralElement,distanceToStructuralElementMm,isNearLoadBearingJunction,diagonalShearAssessment:{isCandidate,targetDegrees:45,toleranceDegrees:5,rationale},structuralRiskScore}],overallStructuralFinding,limitations}",
  environment: "{coordinates:{latitude,longitude},coastalExposure:{coastDistanceKm,salinityExposure},climate:{monsoonRainfallMmAnnual,humidityPercent,temperatureC,observedAt,source},structure:{structuralAgeYears,drainageCondition},environmentalRiskScore,riskNarrative,limitations}",
  final: "{reportTitle,structuralHealthIndex,riskLevel,remedialUrgency,executiveSummary,findings:[{anomalyId,priority,finding,recommendedAction,targetTimeframe}],reportEnglish,reportMalayalam,limitations,humanReviewRequired}"
} as const;
