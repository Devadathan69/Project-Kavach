import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { env, requireLiveOpenAiConfig } from "@/lib/env";
import { prompts } from "@/lib/prompts";
import type { ImageTile } from "@/lib/storage";
import type { MorphologicalProfile, StructuralStress, EnvironmentalContext, FinalAudit } from "@/lib/schemas";
import { EnvironmentalContextSchema, FinalAuditSchema, MorphologicalProfileSchema, StructuralStressSchema } from "@/lib/schemas";

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
  images: ImageTile[] = []
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
      temperature: 0.1,
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
      throw new StructuredOutputError("The analysis provider returned an empty response.", response._request_id);
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(content);
    } catch {
      throw new StructuredOutputError("The analysis provider returned non-JSON output.", response._request_id);
    }

    const parsed = schema.safeParse(decoded);
    if (!parsed.success) {
      console.error("KAVACH structured-output validation failed", {
        requestId: response._request_id,
        issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code }))
      });
      throw new StructuredOutputError("The analysis provider returned an invalid structured result.", response._request_id);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof StructuredOutputError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new StructuredOutputError("The analysis provider timed out before completing the audit.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
