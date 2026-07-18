import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { env, requireLiveOpenAiConfig } from "@/lib/env";
import { prompts } from "@/lib/prompts";
import type { ImageTile } from "@/lib/storage";
import type { AssetMatch, MorphologicalProfile, StructuralStress, EnvironmentalContext, FinalAudit } from "@/lib/schemas";
import { AssetMatchSchema, EnvironmentalContextSchema, FinalAuditSchema, MorphologicalProfileSchema, StructuralStressSchema } from "@/lib/schemas";

export class StructuredOutputError extends Error {
  constructor(message: string, public readonly requestId?: string) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

function client() {
  const { apiKey } = requireLiveOpenAiConfig();
  return new OpenAI({ apiKey, timeout: 75_000, maxRetries: 1 });
}

async function parseJsonResponse<T>(
  prompt: string,
  payload: unknown,
  schema: z.ZodType<T>,
  images: ImageTile[] = [],
  correctiveAttempt = false
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70_000);
  const imageParts = images.map((tile) => ({
    type: "image_url" as const,
    image_url: { url: tile.dataUrl, detail: "high" as const }
  }));

  try {
    const response = await client().chat.completions.create({
      model: env.openAiModel,
      reasoning_effort: "high",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: JSON.stringify(payload) },
            ...imageParts
          ]
        }
      ]
    }, { signal: controller.signal });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new StructuredOutputError("The analysis provider returned an empty response.", response._request_id ?? undefined);
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(content);
    } catch {
      throw new StructuredOutputError("The analysis provider returned non-JSON output.", response._request_id ?? undefined);
    }

    const parsed = schema.safeParse(decoded);
    if (!parsed.success) {
      const issueSummary = parsed.error.issues.slice(0, 10).map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`).join("; ");
      if (!correctiveAttempt) {
        return parseJsonResponse(
          `${prompt}\n\nCORRECTIVE RETRY: Your previous response did not match the contract. Return a new JSON object only. Enum values must use the exact uppercase tokens in the contract. Every numeric field must be an unquoted JSON number; use null only where the contract permits it. Every list field must be a JSON array even when it contains one item. Do not omit required keys. Correct these validator errors exactly: ${issueSummary}`,
          payload,
          schema,
          images,
          true
        );
      }
      console.error("KAVACH structured-output validation failed", {
        requestId: response._request_id,
        issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code }))
      });
      throw new StructuredOutputError(`The analysis provider returned an invalid structured result: ${issueSummary}`, response._request_id ?? undefined);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof StructuredOutputError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new StructuredOutputError("The analysis provider timed out before completing the audit.");
    }
    if (error instanceof Error) {
      const status = typeof (error as { status?: unknown }).status === "number" ? ` (HTTP ${(error as { status: number }).status})` : "";
      throw new StructuredOutputError(`OpenAI analysis request failed${status}: ${error.message}`);
    }
    throw new StructuredOutputError("OpenAI analysis request failed for an unknown reason.");
  } finally {
    clearTimeout(timeout);
  }
}

export function runLiveAssetMatch(payload: unknown) {
  return parseJsonResponse<AssetMatch>(prompts.assetMatch, payload, AssetMatchSchema);
}

export function runLiveMorphology(payload: unknown, images: ImageTile[]) {
  return parseJsonResponse<MorphologicalProfile>(prompts.morphology, payload, MorphologicalProfileSchema, images);
}

export function runLiveStress(payload: unknown) {
  return parseJsonResponse<StructuralStress>(prompts.stress, payload, StructuralStressSchema);
}

export function runLiveEnvironment(payload: unknown) {
  return parseJsonResponse<EnvironmentalContext>(prompts.environment, payload, EnvironmentalContextSchema);
}

export function runLiveFinal(payload: unknown) {
  return parseJsonResponse<FinalAudit>(prompts.final, payload, FinalAuditSchema);
}
