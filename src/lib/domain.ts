export const ANALYSIS_VERSION = "2026.07.19";

export const SHEAR_TARGET_DEGREES = 45;
export const SHEAR_TOLERANCE_DEGREES = 5;

export function normalizeOrientation(value: number) {
  const normalized = ((value % 180) + 180) % 180;
  return normalized === 180 ? 0 : normalized;
}

export function diagonalDifference(value: number, target = SHEAR_TARGET_DEGREES) {
  const normalized = normalizeOrientation(value);
  const difference = Math.abs(normalized - normalizeOrientation(target));
  return Math.min(difference, 180 - difference);
}

export function isDiagonalShearAngle(value: number) {
  return diagonalDifference(value) <= SHEAR_TOLERANCE_DEGREES;
}

export function normalizeVector(dx: number, dy: number) {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude === 0) return { dx: 0, dy: 0 };
  return { dx: dx / magnitude, dy: dy / magnitude };
}

export function riskForHealthIndex(index: number) {
  if (index <= 25) return "CRITICAL" as const;
  if (index <= 50) return "HIGH" as const;
  if (index <= 75) return "MODERATE" as const;
  return "LOW" as const;
}

export function urgencyForRisk(risk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL") {
  const mapping = {
    LOW: "MONITOR",
    MODERATE: "SCHEDULED",
    HIGH: "PRIORITY",
    CRITICAL: "IMMEDIATE"
  } as const;
  return mapping[risk];
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
