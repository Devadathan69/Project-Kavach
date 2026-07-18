import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const idempotencyKey = "seed-kavach-coastal-audit-20260719";
  await prisma.report.deleteMany({ where: { idempotencyKey } });

  await prisma.report.create({
    data: {
      idempotencyKey,
      demoMode: true,
      analysisVersion: "2026.07.19",
      sourceImagePath: "seed/demo-frame.webp",
      sourceImageSha256: "a".repeat(64),
      sourceImageMimeType: "image/webp",
      sourceImageWidthPx: 2048,
      sourceImageHeightPx: 1536,
      assetName: "Seed coastal pier",
      assetType: "Concrete marine structure",
      structuralAgeYears: 18,
      latitude: "8.5241",
      longitude: "76.9366",
      structuralHealthIndex: 38,
      riskLevel: "HIGH",
      remedialUrgency: "PRIORITY",
      summary: "Synthetic seed audit for local development only.",
      reportEnglish: "Synthetic local-development report.",
      reportMalayalam: "പ്രാദേശിക വികസനത്തിനായുള്ള കൃത്രിമ റിപ്പോർട്ട്.",
      rawAnalysisJson: { seed: true },
      completedAt: new Date(),
      anomalies: {
        create: {
          ordinal: 1,
          type: "CRACK",
          severity: "SEVERE",
          confidence: "0.920",
          description: "Synthetic diagonal crack.",
          recommendation: "Arrange qualified structural review.",
          tileX: 0,
          tileY: 0,
          tileWidthPx: 2048,
          tileHeightPx: 1536,
          centroidXPx: "910.000",
          centroidYPx: "640.000",
          boundingBoxXMinPx: "820.000",
          boundingBoxYMinPx: "560.000",
          boundingBoxXMaxPx: "1000.000",
          boundingBoxYMaxPx: "720.000",
          orientationDegrees: "45.000",
          vectorDx: "0.70711",
          vectorDy: "0.70711",
          isDiagonalShearCandidate: true,
          nearestStructuralElement: "Seed beam-to-pier junction",
          isNearLoadBearingJunction: true
        }
      },
      environmentalContext: {
        create: {
          latitude: "8.5241",
          longitude: "76.9366",
          coastDistanceKm: "2.400",
          salinityExposure: "HIGH",
          monsoonRainfallMmAnnual: "3120.000",
          humidityPercent: "82.000",
          temperatureC: "29.000",
          structuralAgeYears: 18,
          drainageCondition: "FAIR",
          environmentalRiskScore: 74,
          riskNarrative: "Synthetic local-development environmental context.",
          dataSource: "KAVACH seed"
        }
      }
    }
  });
}

main().then(() => prisma.$disconnect()).catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
