import "server-only";
import { AssetContextSchema, type AssetContext, type AuditMetadata } from "@/lib/schemas";
import { env } from "@/lib/env";
import { runLiveAssetMatch } from "@/lib/openai";

type NominatimCandidate = {
  candidateId: string;
  displayName: string;
  osmType: "node" | "way" | "relation";
  osmId: string;
  latitude: number;
  longitude: number;
  distanceM: number | null;
  wikidataId: string | null;
};

type NominatimResponse = {
  osm_type?: string;
  osm_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  extratags?: { wikidata?: string };
};

type WikidataEntityResponse = {
  entities?: Record<string, {
    claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { time?: string } } } }>>;
  }>;
};

type WikidataSearchResponse = {
  search?: Array<{ id?: string; label?: string }>;
};

const CONTEXT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const contextCache = new Map<string, { expiresAt: number; value: AssetContext }>();
let lastNominatimRequestAt = 0;

function radians(value: number) {
  return value * Math.PI / 180;
}

function normalizedName(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function distanceInMeters(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number) {
  const earthRadiusM = 6_371_000;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(fromLatitude)) * Math.cos(radians(toLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(a));
}

function unavailableContext(requestedName: string, limitation: string): AssetContext {
  return AssetContextSchema.parse({
    requestedName,
    matchStatus: "UNAVAILABLE",
    resolvedName: null,
    matchConfidence: 0,
    matchRationale: "No reliable map-and-name match was available for this audit.",
    candidate: null,
    resolvedCoordinates: null,
    construction: { buildYear: null, structuralAgeYears: null, sourceLabel: "No verified public construction record", sourceUrl: null },
    limitations: [limitation]
  });
}

async function waitForNominatimAllowance() {
  const elapsed = Date.now() - lastNominatimRequestAt;
  const waitMs = Math.max(0, 1_100 - elapsed);
  if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  lastNominatimRequestAt = Date.now();
}

async function structureCandidates(requestedName: string, origin: { latitude: number; longitude: number } | null): Promise<NominatimCandidate[]> {
  await waitForNominatimAllowance();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", requestedName);
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("limit", "5");
  if (origin) {
    const radiusDegrees = 0.055;
    url.searchParams.set("bounded", "1");
    url.searchParams.set("viewbox", `${origin.longitude - radiusDegrees},${origin.latitude + radiusDegrees},${origin.longitude + radiusDegrees},${origin.latitude - radiusDegrees}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "KAVACH/0.1 local structural-audit application"
      },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return [];
    const body = await response.json() as unknown;
    if (!Array.isArray(body)) return [];

    return body.flatMap((item): NominatimCandidate[] => {
      if (!item || typeof item !== "object") return [];
      const raw = item as NominatimResponse;
      if (!raw.display_name || !raw.osm_id || !raw.lat || !raw.lon || !["node", "way", "relation"].includes(raw.osm_type ?? "")) return [];
      const candidateLatitude = Number(raw.lat);
      const candidateLongitude = Number(raw.lon);
      if (!Number.isFinite(candidateLatitude) || !Number.isFinite(candidateLongitude)) return [];
      const osmType = raw.osm_type as NominatimCandidate["osmType"];
      const wikidata = raw.extratags?.wikidata;
      return [{
        candidateId: `${osmType}/${raw.osm_id}`,
        displayName: raw.display_name,
        osmType,
        osmId: String(raw.osm_id),
        latitude: candidateLatitude,
        longitude: candidateLongitude,
        distanceM: origin ? Math.round(distanceInMeters(origin.latitude, origin.longitude, candidateLatitude, candidateLongitude)) : null,
        wikidataId: wikidata && /^Q\d+$/.test(wikidata) ? wikidata : null
      }];
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function buildYearFromWikidata(wikidataId: string | null) {
  if (!wikidataId) return { buildYear: null, sourceLabel: "No linked Wikidata construction record", sourceUrl: null };
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("ids", wikidataId);
  url.searchParams.set("props", "claims|labels");
  url.searchParams.set("languages", "en");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "KAVACH/0.1 local structural-audit application" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) return { buildYear: null, sourceLabel: "Wikidata construction record unavailable", sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}` };
    const body = await response.json() as WikidataEntityResponse;
    const entity = body.entities?.[wikidataId];
    const time = entity?.claims?.P571?.find((claim) => typeof claim.mainsnak?.datavalue?.value?.time === "string")?.mainsnak?.datavalue?.value?.time;
    const match = typeof time === "string" ? /([0-9]{4})/.exec(time) : null;
    const buildYear = match ? Number(match[1]) : null;
    return {
      buildYear: buildYear && buildYear <= new Date().getUTCFullYear() ? buildYear : null,
      sourceLabel: buildYear ? "Wikidata inception (P571)" : "No Wikidata inception (P571) record",
      sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`
    };
  } catch {
    return { buildYear: null, sourceLabel: "Wikidata construction record unavailable", sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}` };
  } finally {
    clearTimeout(timeout);
  }
}

async function findWikidataEntityId(requestedName: string, candidateName: string) {
  const requested = normalizedName(requestedName);
  const candidate = normalizedName(candidateName);
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "5");
  url.searchParams.set("search", requestedName);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "KAVACH/0.1 local structural-audit application" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const body = await response.json() as WikidataSearchResponse;
    const direct = body.search?.find((item) => item.id && item.label && (normalizedName(item.label) === requested || candidate.includes(normalizedName(item.label))));
    return direct?.id && /^Q\d+$/.test(direct.id) ? direct.id : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveAssetContext(metadata: AuditMetadata): Promise<AssetContext> {
  if (metadata.assetContextMode === "VISUAL_ONLY") {
    return unavailableContext(metadata.assetName, "The operator chose visual-only analysis and did not authorise a public structure-context match for this audit.");
  }

  const origin = metadata.latitude === null || metadata.longitude === null ? null : { latitude: metadata.latitude, longitude: metadata.longitude };
  const cacheKey = `${metadata.assetName.trim().toLocaleLowerCase()}|${origin ? `${origin.latitude.toFixed(3)}|${origin.longitude.toFixed(3)}` : "structure-name"}|${metadata.assetContextMode}|${metadata.confirmedAssetCandidateId ?? "none"}`;
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const candidates = await structureCandidates(metadata.assetName, origin);
    if (candidates.length === 0) {
      const unavailable = unavailableContext(metadata.assetName, "No nearby public map candidate matched the supplied structure name.");
      contextCache.set(cacheKey, { value: unavailable, expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS });
      return unavailable;
    }

    const lexicalCandidate = candidates.find((candidate) => candidate.displayName.toLocaleLowerCase().includes(metadata.assetName.trim().toLocaleLowerCase()));
    let aiSelection: { candidateId: string | null; confidence: number; rationale: string };
    let selected: NominatimCandidate | undefined;

    if (metadata.assetContextMode === "CONFIRMED") {
      selected = candidates.find((candidate) => candidate.candidateId === metadata.confirmedAssetCandidateId);
      const directNameMatch = selected ? normalizedName(selected.displayName).includes(normalizedName(metadata.assetName)) : false;
      aiSelection = {
        candidateId: selected?.candidateId ?? null,
        confidence: selected && directNameMatch ? 0.9 : 0.6,
        rationale: selected
          ? "The operator reviewed and confirmed this public map candidate before analysis."
          : "The previously confirmed public map candidate could not be retrieved for this audit."
      };
    } else {
      aiSelection = env.demoMode
        ? { candidateId: lexicalCandidate?.candidateId ?? null, confidence: lexicalCandidate ? 0.75 : 0, rationale: "Demo mode selected only a direct local-name match from public map candidates." }
        : await runLiveAssetMatch({ requestedName: metadata.assetName, originCoordinates: origin, candidates: candidates.map(({ candidateId, displayName, osmType, osmId, distanceM }) => ({ candidateId, displayName, osmType, osmId, distanceM })) });
      selected = aiSelection.candidateId ? candidates.find((candidate) => candidate.candidateId === aiSelection.candidateId) : undefined;
    }

    if (!selected) {
      const unresolved = AssetContextSchema.parse({
        requestedName: metadata.assetName,
        matchStatus: "UNVERIFIED",
        resolvedName: null,
        matchConfidence: aiSelection.confidence,
        matchRationale: aiSelection.rationale,
        candidate: null,
        resolvedCoordinates: null,
        construction: { buildYear: null, structuralAgeYears: null, sourceLabel: "No verified public construction record", sourceUrl: null },
        limitations: ["KAVACH did not find a sufficiently reliable AI-assisted match among nearby public map candidates."]
      });
      contextCache.set(cacheKey, { value: unresolved, expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS });
      return unresolved;
    }

    const directNameMatch = normalizedName(selected.displayName).includes(normalizedName(metadata.assetName));
    const matchConfidence = directNameMatch ? Math.max(aiSelection.confidence, 0.85) : aiSelection.confidence;
    const verified = metadata.assetContextMode === "CONFIRMED" ? directNameMatch : matchConfidence >= 0.75;
    const wikidataId = selected.wikidataId ?? (verified ? await findWikidataEntityId(metadata.assetName, selected.displayName) : null);
    const construction = verified
      ? await buildYearFromWikidata(wikidataId)
      : { buildYear: null, sourceLabel: "Construction evidence withheld for an unverified match", sourceUrl: null };
    const structuralAgeYears = construction.buildYear === null ? null : Math.max(0, new Date().getUTCFullYear() - construction.buildYear);
    const context = AssetContextSchema.parse({
      requestedName: metadata.assetName,
      matchStatus: verified ? "VERIFIED" : "UNVERIFIED",
      resolvedName: selected.displayName,
      matchConfidence,
      matchRationale: aiSelection.rationale,
      candidate: {
        candidateId: selected.candidateId,
        displayName: selected.displayName,
        osmType: selected.osmType,
        osmId: selected.osmId,
        latitude: selected.latitude,
        longitude: selected.longitude,
        distanceM: selected.distanceM,
        wikidataId,
        sourceUrl: `https://www.openstreetmap.org/${selected.osmType}/${selected.osmId}`
      },
      resolvedCoordinates: verified ? { latitude: selected.latitude, longitude: selected.longitude, source: "STRUCTURE_LOOKUP" } : null,
      construction: { ...construction, structuralAgeYears },
      limitations: construction.buildYear === null ? ["No public construction year was available for the selected structure; age was not estimated."] : []
    });
    contextCache.set(cacheKey, { value: context, expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS });
    return context;
  } catch (error) {
    console.error("KAVACH asset context lookup failed", error);
    return unavailableContext(metadata.assetName, "The external structure-context lookup was unavailable; no structure age was inferred.");
  }
}
