import { describe, expect, it } from "vitest";
import { isDiagonalShearAngle, riskForHealthIndex, urgencyForRisk } from "../../src/lib/domain";
import { AuditMetadataSchema, StructuralStressSchema } from "../../src/lib/schemas";

const baseMetadata = {
  assetName: "East pier 04",
  assetType: "Concrete structure",
  capturedAt: "2026-07-19T00:00:00.000Z",
  latitude: null,
  longitude: null,
  altitudeM: null,
  headingDeg: null,
  structuralAgeYears: null,
  locationSource: "STRUCTURE_LOOKUP" as const,
  locationConsent: false,
  measurementMode: "UNCALIBRATED" as const,
  referenceMarkerMm: null,
  assetContextMode: "VISUAL_ONLY" as const,
  confirmedAssetCandidateId: null,
  idempotencyKey: "audit-test-metadata-0001"
};

describe("KAVACH deterministic screening rules", () => {
  it("keeps the diagonal shear screening band at 45 +/- 5 degrees", () => {
    expect(isDiagonalShearAngle(40)).toBe(true);
    expect(isDiagonalShearAngle(50)).toBe(true);
    expect(isDiagonalShearAngle(39.9)).toBe(false);
    expect(isDiagonalShearAngle(51)).toBe(false);
  });

  it("maps triage score boundaries to consistent risk and urgency", () => {
    expect(riskForHealthIndex(25)).toBe("CRITICAL");
    expect(riskForHealthIndex(26)).toBe("HIGH");
    expect(riskForHealthIndex(51)).toBe("MODERATE");
    expect(riskForHealthIndex(76)).toBe("LOW");
    expect(urgencyForRisk("CRITICAL")).toBe("IMMEDIATE");
    expect(urgencyForRisk("HIGH")).toBe("PRIORITY");
  });
});

describe("audit evidence validation", () => {
  it("accepts visual-only uncalibrated triage", () => {
    expect(AuditMetadataSchema.safeParse(baseMetadata).success).toBe(true);
  });

  it("rejects physical-scale claims without a declared reference length", () => {
    const result = AuditMetadataSchema.safeParse({ ...baseMetadata, measurementMode: "REFERENCE_MARKER" });
    expect(result.success).toBe(false);
  });

  it("requires a candidate when a public record is claimed as confirmed", () => {
    const result = AuditMetadataSchema.safeParse({ ...baseMetadata, assetContextMode: "CONFIRMED" });
    expect(result.success).toBe(false);
  });

  it("accepts bounded decimal visual-risk scores from the stress screen", () => {
    const result = StructuralStressSchema.safeParse({
      anomalies: [{
        anomalyId: "crack-01",
        orientationDegrees: 45,
        vector: { dx: 0.707, dy: 0.707 },
        nearestStructuralElement: "Pier junction",
        distanceToStructuralElementMm: null,
        isNearLoadBearingJunction: true,
        diagonalShearAssessment: { isCandidate: true, targetDegrees: 45, toleranceDegrees: 5, rationale: "Visible diagonal orientation near the declared junction." },
        structuralRiskScore: 82.5
      }],
      overallStructuralFinding: "Visual triage only.",
      limitations: ["Field verification is required."]
    });
    expect(result.success).toBe(true);
  });

  it("normalises an all-null model vector to an unavailable vector", () => {
    const result = StructuralStressSchema.safeParse({
      anomalies: [{
        anomalyId: "crack-02",
        orientationDegrees: null,
        vector: { dx: null, dy: null },
        nearestStructuralElement: null,
        distanceToStructuralElementMm: null,
        isNearLoadBearingJunction: false,
        diagonalShearAssessment: { isCandidate: false, targetDegrees: 45, toleranceDegrees: 5, rationale: "No directional visual evidence is available." },
        structuralRiskScore: 12.4
      }],
      overallStructuralFinding: "Visual triage only.",
      limitations: ["Field verification is required."]
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.anomalies[0].vector).toBeNull();
  });
});
