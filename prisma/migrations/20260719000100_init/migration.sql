-- KAVACH initial audit-persistence schema.
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'ANALYZING', 'COMPLETE', 'FAILED');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');
CREATE TYPE "RemedialUrgency" AS ENUM ('MONITOR', 'SCHEDULED', 'PRIORITY', 'IMMEDIATE');
CREATE TYPE "AnomalyType" AS ENUM ('CRACK', 'SPALLING', 'EXPOSED_REBAR', 'EFFLORESCENCE', 'CORROSION', 'OTHER');
CREATE TYPE "AnomalySeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'CRITICAL');
CREATE TYPE "SalinityExposure" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'EXTREME');
CREATE TYPE "DrainageCondition" AS ENUM ('GOOD', 'FAIR', 'POOR', 'UNKNOWN');

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "analysisVersion" TEXT NOT NULL,
    "modelName" TEXT,
    "sourceImagePath" TEXT NOT NULL,
    "sourceImageSha256" TEXT NOT NULL,
    "sourceImageMimeType" TEXT NOT NULL,
    "sourceImageWidthPx" INTEGER NOT NULL,
    "sourceImageHeightPx" INTEGER NOT NULL,
    "originalFilename" TEXT,
    "capturedAt" TIMESTAMP(3),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "altitudeM" DECIMAL(10,2),
    "headingDeg" DECIMAL(6,2),
    "assetName" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "structuralAgeYears" INTEGER,
    "structuralHealthIndex" INTEGER,
    "riskLevel" "RiskLevel",
    "remedialUrgency" "RemedialUrgency",
    "summary" TEXT,
    "reportEnglish" TEXT,
    "reportMalayalam" TEXT,
    "rawAnalysisJson" JSONB,
    "persistenceWarning" TEXT,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "type" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "tileX" INTEGER NOT NULL,
    "tileY" INTEGER NOT NULL,
    "tileWidthPx" INTEGER NOT NULL,
    "tileHeightPx" INTEGER NOT NULL,
    "centroidXPx" DECIMAL(12,3) NOT NULL,
    "centroidYPx" DECIMAL(12,3) NOT NULL,
    "boundingBoxXMinPx" DECIMAL(12,3) NOT NULL,
    "boundingBoxYMinPx" DECIMAL(12,3) NOT NULL,
    "boundingBoxXMaxPx" DECIMAL(12,3) NOT NULL,
    "boundingBoxYMaxPx" DECIMAL(12,3) NOT NULL,
    "maskOrOverlayPath" TEXT,
    "crackLengthMm" DECIMAL(12,3),
    "crackWidthMinMm" DECIMAL(12,3),
    "crackWidthMaxMm" DECIMAL(12,3),
    "crackWidthAverageMm" DECIMAL(12,3),
    "crackDepthEstimateMm" DECIMAL(12,3),
    "branchCount" INTEGER,
    "propagationRateMmPerYear" DECIMAL(12,3),
    "surfaceAreaMm2" DECIMAL(14,3),
    "orientationDegrees" DECIMAL(6,3),
    "vectorDx" DECIMAL(7,5),
    "vectorDy" DECIMAL(7,5),
    "isDiagonalShearCandidate" BOOLEAN NOT NULL DEFAULT false,
    "nearestStructuralElement" TEXT,
    "distanceToStructuralElementMm" DECIMAL(12,3),
    "isNearLoadBearingJunction" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "elevationM" DECIMAL(10,2),
    "worldCoordinateAccuracyM" DECIMAL(10,2),
    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnvironmentalContext" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "coastDistanceKm" DECIMAL(12,3),
    "salinityExposure" "SalinityExposure",
    "monsoonRainfallMmAnnual" DECIMAL(12,3),
    "humidityPercent" DECIMAL(6,3),
    "temperatureC" DECIMAL(6,3),
    "weatherObservedAt" TIMESTAMP(3),
    "structuralAgeYears" INTEGER,
    "drainageCondition" "DrainageCondition" NOT NULL DEFAULT 'UNKNOWN',
    "environmentalRiskScore" INTEGER,
    "riskNarrative" TEXT,
    "dataSource" TEXT,
    "rawContextJson" JSONB,
    CONSTRAINT "EnvironmentalContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Report_idempotencyKey_key" ON "Report"("idempotencyKey");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE INDEX "Report_latitude_longitude_idx" ON "Report"("latitude", "longitude");
CREATE INDEX "Report_riskLevel_idx" ON "Report"("riskLevel");
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE INDEX "Report_sourceImageSha256_idx" ON "Report"("sourceImageSha256");
CREATE INDEX "Report_assetName_idx" ON "Report"("assetName");
CREATE UNIQUE INDEX "Anomaly_reportId_ordinal_key" ON "Anomaly"("reportId", "ordinal");
CREATE INDEX "Anomaly_type_idx" ON "Anomaly"("type");
CREATE INDEX "Anomaly_severity_idx" ON "Anomaly"("severity");
CREATE INDEX "Anomaly_isDiagonalShearCandidate_idx" ON "Anomaly"("isDiagonalShearCandidate");
CREATE UNIQUE INDEX "EnvironmentalContext_reportId_key" ON "EnvironmentalContext"("reportId");

ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalContext" ADD CONSTRAINT "EnvironmentalContext_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
