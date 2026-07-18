import type { AuditMetadata, EnvironmentalContext, FinalAudit, MorphologicalProfile, StructuralStress } from "@/lib/schemas";
import type { ImageTile } from "@/lib/storage";
import { riskForHealthIndex, urgencyForRisk } from "@/lib/domain";

export function demoMorphology(scanId: string, widthPx: number, heightPx: number, tiles: ImageTile[]): MorphologicalProfile {
  const primaryTile = tiles[0];
  const x = Math.min(Math.max(140, Math.round(primaryTile.widthPx * 0.44)), primaryTile.widthPx - 100);
  const y = Math.min(Math.max(120, Math.round(primaryTile.heightPx * 0.38)), primaryTile.heightPx - 130);

  return {
    scanId,
    imageWidthPx: widthPx,
    imageHeightPx: heightPx,
    tiles: tiles.map((tile, index) => ({
      tileId: tile.tileId,
      xPx: tile.xPx,
      yPx: tile.yPx,
      widthPx: tile.widthPx,
      heightPx: tile.heightPx,
      anomalies: index === 0 ? [
        {
          anomalyId: "demo-diagonal-crack-01",
          type: "CRACK",
          severity: "SEVERE",
          confidence: 0.92,
          description: "Diagonal surface crack with branching visible in the supplied inspection frame.",
          centroidPx: { x, y },
          boundingBoxPx: { xMin: x - 65, yMin: y - 55, xMax: x + 68, yMax: y + 65 },
          crackGeometry: { lengthMm: null, widthMinMm: null, widthMaxMm: null, widthAverageMm: null, depthEstimateMm: null, branchCount: 2, surfaceAreaMm2: null },
          evidence: ["A continuous diagonal discontinuity is visible across the local tile.", "No calibrated scale is supplied, so physical dimensions are unavailable."]
        },
        {
          anomalyId: "demo-efflorescence-02",
          type: "EFFLORESCENCE",
          severity: "MODERATE",
          confidence: 0.81,
          description: "Light surface deposit pattern adjacent to the crack network.",
          centroidPx: { x: Math.max(45, x - 135), y: Math.min(primaryTile.heightPx - 50, y + 120) },
          boundingBoxPx: { xMin: Math.max(10, x - 190), yMin: Math.min(primaryTile.heightPx - 105, y + 70), xMax: Math.max(80, x - 80), yMax: Math.min(primaryTile.heightPx - 25, y + 170) },
          crackGeometry: { lengthMm: null, widthMinMm: null, widthMaxMm: null, widthAverageMm: null, depthEstimateMm: null, branchCount: null, surfaceAreaMm2: null },
          evidence: ["A pale surface deposit is visible near the cracked region."]
        }
      ] : []
    })),
    limitations: ["Demo mode uses a deterministic fixture rather than visual model inference.", "No calibrated scale is available for millimetre measurements."]
  };
}

export function demoStress(): StructuralStress {
  return {
    anomalies: [
      {
        anomalyId: "demo-diagonal-crack-01",
        orientationDegrees: 45,
        vector: { dx: 0.70711, dy: 0.70711 },
        nearestStructuralElement: "Beam-to-pier junction (declared demo context)",
        distanceToStructuralElementMm: null,
        isNearLoadBearingJunction: true,
        diagonalShearAssessment: { isCandidate: true, targetDegrees: 45, toleranceDegrees: 5, rationale: "The demo crack follows the 45° shear screening band and is declared near a load-bearing junction." },
        structuralRiskScore: 82
      },
      {
        anomalyId: "demo-efflorescence-02",
        orientationDegrees: null,
        vector: null,
        nearestStructuralElement: null,
        distanceToStructuralElementMm: null,
        isNearLoadBearingJunction: false,
        diagonalShearAssessment: { isCandidate: false, targetDegrees: 45, toleranceDegrees: 5, rationale: "Surface deposit is not a directional crack." },
        structuralRiskScore: 41
      }
    ],
    overallStructuralFinding: "The diagonal crack warrants a qualified engineer review because its visual orientation and declared junction proximity meet KAVACH's shear-screening criteria.",
    limitations: ["This is a visual screening result, not a physical confirmation of load-path failure."]
  };
}

export function demoEnvironment(metadata: AuditMetadata): EnvironmentalContext {
  return {
    coordinates: { latitude: metadata.latitude, longitude: metadata.longitude },
    coastalExposure: { coastDistanceKm: metadata.latitude === null ? null : 2.4, salinityExposure: metadata.latitude === null ? null : "HIGH" },
    climate: { monsoonRainfallMmAnnual: metadata.latitude === null ? null : 3120, humidityPercent: metadata.latitude === null ? null : 82, temperatureC: metadata.latitude === null ? null : 29, observedAt: new Date().toISOString(), source: "KAVACH deterministic demo fixture" },
    structure: { structuralAgeYears: metadata.structuralAgeYears, drainageCondition: "FAIR" },
    environmentalRiskScore: metadata.latitude === null ? 28 : 74,
    riskNarrative: metadata.latitude === null ? "Location data was not supplied; no coastal exposure is inferred." : "Demo context combines declared coastal proximity, high salinity exposure, humidity, and monsoon rainfall as accelerants of visible deterioration.",
    limitations: ["Environmental values are deterministic demo data and must not be treated as a live geographic lookup."]
  };
}

export function demoFinal(): FinalAudit {
  const structuralHealthIndex = 38;
  const riskLevel = riskForHealthIndex(structuralHealthIndex);
  return {
    reportTitle: "KAVACH structural screening audit",
    structuralHealthIndex,
    riskLevel,
    remedialUrgency: urgencyForRisk(riskLevel),
    executiveSummary: "A severe diagonal crack meets the configured visual shear-screening rule. High salinity and wet-season exposure in the demo context elevate the need for prompt expert assessment.",
    findings: [
      { anomalyId: "demo-diagonal-crack-01", priority: 1, finding: "Diagonal crack at a declared beam-to-pier junction.", recommendedAction: "Arrange an in-person structural assessment; document crack width with a calibrated gauge and assess active movement.", targetTimeframe: "Priority: within 7 days" },
      { anomalyId: "demo-efflorescence-02", priority: 2, finding: "Surface efflorescence near the crack network.", recommendedAction: "Inspect moisture ingress, drainage, and protective coating condition after structural review.", targetTimeframe: "Scheduled: within 30 days" }
    ],
    reportEnglish: "KAVACH visual screening indicates a severe diagonal crack that satisfies the configured 45° ±5° shear-screening criterion near a declared load-bearing junction. A qualified structural engineer should inspect the location promptly. This result is not a physical inspection or certification.",
    reportMalayalam: "KAVACH ദൃശ്യ പരിശോധനയിൽ പ്രഖ്യാപിച്ച ലോഡ്-ബെയറിംഗ് ജംഗ്ഷന് സമീപം 45° ±5° ഷിയർ-സ്ക്രീനിംഗ് മാനദണ്ഡം പാലിക്കുന്ന ഗുരുതരമായ ഒരു തിരശ്ചീന വിള്ളൽ കണ്ടെത്തി. യോഗ്യനായ സ്ട്രക്ചറൽ എഞ്ചിനീയർ ഉടൻ സ്ഥലം പരിശോധിക്കണം. ഇത് ഭൗതിക പരിശോധനയോ സർട്ടിഫിക്കേഷനോ അല്ല.",
    limitations: ["Demo mode is active.", "No calibrated scale was supplied for crack dimensions.", "Qualified engineering review is required before remedial decisions."],
    humanReviewRequired: true
  };
}
