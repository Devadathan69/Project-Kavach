import "server-only";

const TRUE_VALUES = new Set(["1", "true", "yes"]);

function integerFromEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export const env = {
  demoMode: TRUE_VALUES.has((process.env.KAVACH_DEMO_MODE ?? "true").toLowerCase()),
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
  databaseUrl: process.env.DATABASE_URL,
  maxUploadBytes: integerFromEnv("KAVACH_MAX_UPLOAD_BYTES", 10 * 1024 * 1024),
  storageDirectory: process.env.KAVACH_STORAGE_DIR ?? "./storage",
  environmentDataUrl: process.env.KAVACH_ENVIRONMENT_DATA_URL
};

export function requireLiveOpenAiConfig() {
  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required when KAVACH_DEMO_MODE is false.");
  }
  if (!env.openAiModel.trim()) {
    throw new Error("OPENAI_MODEL cannot be empty.");
  }
  return { apiKey: env.openAiApiKey, model: env.openAiModel };
}
