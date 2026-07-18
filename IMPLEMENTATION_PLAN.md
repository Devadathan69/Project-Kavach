# Project KAVACH — Implementation Plan

## Purpose and governing inputs

This document is the build contract for Project KAVACH, the Autonomous Visual Structural Health & Forensic Audit Network. It was prepared after reading `Project_KAVACH.md` (the repository's KAVACH specification; no file named `KAVACH_SPECIFICATION.md` is present) and `guidelines.md`.

No application code may be started before this blueprint is approved and present in the repository. Each checklist item below is an independently verifiable sprint. A sprint is complete only after its stated checks pass, `CHANGELOG.md` is appended with an ISO-8601 timestamp, changed files, and a concise rationale, and the work is staged and committed with an atomic Conventional Commit message.

## Global delivery guardrails

- [ ] Work on an isolated `codex/` feature branch before implementation. Preserve the two supplied source documents as immutable project inputs.
- [ ] Create the persistent `CHANGELOG.md` before the first application-file change. Record every edit, including migrations, test fixtures, configuration, and documentation.
- [ ] Before every commit: run the relevant unit/component tests, TypeScript checking, ESLint, and a production build as appropriate; remove non-critical debug logging; inspect the staged diff; then commit one coherent concern.
- [ ] Prefer React Server Components. Add `"use client"` only to components needing browser APIs, Context/hooks, upload controls, or Framer Motion.
- [ ] Treat all browser-supplied values and all model responses as untrusted. Validate API input, validate each model response with Zod, use explicit status codes, and never expose `OPENAI_API_KEY` to the browser.
- [ ] Provide a deterministic demo-mode analysis fixture that uses the same validated response contract as live analysis. It must be selectable through a server-only environment variable and never silently mask an unexpected production failure.
- [ ] Make audit persistence non-fatal: a report that cannot be stored still returns its validated analysis to the client, with an explicit persistence warning that is safe to display.
- [ ] Make repeated audit requests safe. Assign/accept an idempotency key, enforce a database uniqueness constraint for it, and return the original completed result instead of duplicating records.

## PHASE 1 — Repository Initialization & Schema Design

### Sprint 1.1 — Baseline and Next.js 15 foundation

- [ ] Inspect the current working tree, Node/npm versions, and existing project metadata before adding files. Record the baseline in `CHANGELOG.md`.
- [ ] Initialize the application with Next.js 15, React 19, TypeScript, ESLint, App Router, and the `src/` directory convention (or document a deliberate root-level App Router convention). Pin compatible package versions in the lockfile.
- [ ] Configure Tailwind CSS with PostCSS, a global CSS entry point, tokenized high-contrast color variables, responsive breakpoints, and a reduced-motion policy. Avoid undocumented one-off color values in components.
- [ ] Install and configure the core runtime dependencies: `@prisma/client`, Prisma CLI, Zod, OpenAI SDK, Framer Motion, Lucide React, and the browser-test tooling. Use native Web APIs for uploads where they suffice.
- [ ] Establish `.env.example` containing only variable names and safe examples: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `KAVACH_DEMO_MODE`, `KAVACH_MAX_UPLOAD_BYTES`, and the PWA public configuration. Do not commit credentials.
- [ ] Add server-only environment validation at process startup/build time so malformed URLs, missing production credentials, invalid model identifiers, and invalid boolean/size configuration fail with actionable errors.
- [ ] Add a stable root layout, metadata, error boundary, loading UI, and a minimal health endpoint/page for smoke testing. Do not build the dashboard in this sprint.

**Exit checks**

- [ ] Fresh dependency installation, `npm run lint`, type checking, and `npm run build` pass.
- [ ] The development server renders the root route and error fallback without browser-console errors.
- [ ] Commit: `chore: initialize Next.js KAVACH foundation`.

### Sprint 1.2 — PostgreSQL and Prisma data contract

- [ ] Provision a PostgreSQL development database and add Prisma with a generated client singleton suitable for Next.js hot reload.
- [ ] Define the following exact relational ownership: a `Report` owns many `Anomaly` rows and one optional `EnvironmentalContext`; both child models reference `Report.id` with cascade delete. Use UUID/CUID primary keys consistently and UTC timestamps.
- [ ] Implement the `Report` model with these fields:
  - [ ] Identity/lifecycle: `id`, `createdAt`, `updatedAt`, `status` (`QUEUED | ANALYZING | COMPLETE | FAILED`), `idempotencyKey` (unique), `demoMode`, `analysisVersion`, `modelName`.
  - [ ] Asset and capture: `sourceImagePath`, `sourceImageSha256`, `sourceImageMimeType`, `sourceImageWidthPx`, `sourceImageHeightPx`, `originalFilename`, `capturedAt`, `latitude`, `longitude`, `altitudeM`, `headingDeg`, `assetName`, `assetType`, and `structuralAgeYears`.
  - [ ] Result: `structuralHealthIndex` (integer constrained in application validation to 0–100), `riskLevel` (`LOW | MODERATE | HIGH | CRITICAL`), `remedialUrgency` (`MONITOR | SCHEDULED | PRIORITY | IMMEDIATE`), `summary`, `reportEnglish`, `reportMalayalam`, `rawAnalysisJson` (`Json`), `persistenceWarning`, and `completedAt`.
  - [ ] Query performance: indexes for `createdAt`, `[latitude, longitude]`, `riskLevel`, `status`, `sourceImageSha256`, and `assetName`.
- [ ] Implement the `Anomaly` model with these fields:
  - [ ] Identity/classification: `id`, `reportId`, `ordinal`, `type` (`CRACK | SPALLING | EXPOSED_REBAR | EFFLORESCENCE | CORROSION | OTHER`), `severity` (`MINOR | MODERATE | SEVERE | CRITICAL`), `confidence`, `description`, and `recommendation`.
  - [ ] Image-space coordinate geometry: `tileX`, `tileY`, `tileWidthPx`, `tileHeightPx`, `centroidXPx`, `centroidYPx`, `boundingBoxXMinPx`, `boundingBoxYMinPx`, `boundingBoxXMaxPx`, `boundingBoxYMaxPx`, and `maskOrOverlayPath`.
  - [ ] Crack geometry metrics: `crackLengthMm`, `crackWidthMinMm`, `crackWidthMaxMm`, `crackWidthAverageMm`, `crackDepthEstimateMm`, `branchCount`, `propagationRateMmPerYear`, and `surfaceAreaMm2` (nullable for non-area defects).
  - [ ] Spatial vector orientation: `orientationDegrees` normalized to 0–180, `vectorDx`, `vectorDy`, `isDiagonalShearCandidate`, `nearestStructuralElement`, `distanceToStructuralElementMm`, and `isNearLoadBearingJunction`.
  - [ ] Site mapping: optional `latitude`, `longitude`, `elevationM`, and `worldCoordinateAccuracyM` for drone-derived locations.
  - [ ] Index `[reportId, ordinal]` uniquely and indexes for `type`, `severity`, and `isDiagonalShearCandidate`.
- [ ] Implement the `EnvironmentalContext` model with `id`, unique `reportId`, `createdAt`, `latitude`, `longitude`, `coastDistanceKm`, `salinityExposure` (`LOW | MODERATE | HIGH | EXTREME`), `monsoonRainfallMmAnnual`, `humidityPercent`, `temperatureC`, `weatherObservedAt`, `structuralAgeYears`, `drainageCondition` (`GOOD | FAIR | POOR | UNKNOWN`), `environmentalRiskScore`, `riskNarrative`, `dataSource`, and `rawContextJson`.
- [ ] Use database-native decimal precision for physical measurements/coordinates rather than floating point where practical; keep nullable fields only where evidence can genuinely be unavailable. Enforce all numeric ranges in the application Zod contract and repeat critical constraints in the migration where supported.
- [ ] Create and apply an explicitly named Prisma migration, generate the client, and add a seed containing one complete synthetic coastal audit with linked anomalies and environmental context. Never seed a real individual's location or image.

**Exit checks**

- [ ] `prisma validate`, migration deployment against an empty database, seed execution, and a read-back relation query all pass.
- [ ] Unit tests confirm cascade behavior, idempotency-key uniqueness, coordinate/measurement serialization, and report–child relation integrity.
- [ ] Commit: `feat: add KAVACH audit persistence schema`.

## PHASE 2 — Core Server-Side Processing Architecture

### Sprint 2.1 — API boundary and image-processing contract

- [ ] Create `app/api/audit/route.ts` as a Node.js runtime route (not Edge runtime) because Prisma requires it; use `export const runtime = "nodejs"`. If edge delivery is later required, separate the upload gateway from the database-backed orchestration worker rather than incorrectly marking this route Edge.
- [ ] Define and Zod-validate the `POST /api/audit` request contract: multipart image file or validated Base64 data URL; `assetName`, `assetType`, `capturedAt`, latitude/longitude/altitude/heading, `structuralAgeYears`, optional existing report/idempotency key, and an explicit user-consented location flag.
- [ ] Enforce accepted formats (JPEG, PNG, WebP), non-empty payloads, a configured byte limit, decoded-byte-size validation, image dimension limits, coordinate ranges (latitude −90..90, longitude −180..180), and ISO date validity before invoking any model. Return 400/413/415 with machine-readable error codes for invalid requests.
- [ ] Persist uploaded originals outside the public static directory using a generated path derived from report ID and content hash. Store only the stable file path and metadata in `Report`; never trust a supplied filename for a path. Define an object-storage adapter boundary so local development and production storage have identical callers.
- [ ] Produce a tile manifest for large source images: normalize EXIF orientation, preserve original dimensions, split into overlapping tiles no larger than 2048×2048 pixels, record tile origin/dimensions, and retain a source-to-tile coordinate transform. Deduplicate overlap anomalies during aggregation.
- [ ] Build OpenAI image parts only from validated tile data and always set `detail: "high"`. Include tile ordinal and pixel bounds in the instruction so returned centroids/bounds can be converted to source-image coordinates. Set configured timeouts, request identifiers, abort handling, and retry only safe transient failures with bounded exponential backoff.
- [ ] Return consistent responses: 201 for a newly persisted audit, 200 for an idempotent replay, 202 only if a deliberately implemented asynchronous job status flow is used, 400/413/415 for client input issues, 424 for an unavailable upstream model, and 500 for unexpected failures. Return no raw provider error body or secret.

### Sprint 2.2 — Structured model response definitions

- [ ] Place prompts, Zod schemas, model invocation, aggregation, demo fixture, and persistence in focused server-only modules so `route.ts` only parses, orchestrates, and serializes an HTTP response.
- [ ] Define one strict shared Zod vocabulary: defect type/severity/risk/urgency enums; finite numeric values; `.int()` only where integers are required; a 0–1 confidence range; 0–100 scores; exact tile/image dimensions; normalized 0–180 orientation; vector `dx`/`dy` in −1..1; valid `bbox` and centroid objects; no unknown keys (`.strict()`).
- [ ] Define `MorphologicalProfileSchema` as `{ scanId, imageWidthPx, imageHeightPx, tiles: [{ tileId, xPx, yPx, widthPx, heightPx, anomalies: [{ anomalyId, type, severity, confidence, description, centroidPx: { x, y }, boundingBoxPx: { xMin, yMin, xMax, yMax }, crackGeometry: { lengthMm, widthMinMm, widthMaxMm, widthAverageMm, depthEstimateMm, branchCount, surfaceAreaMm2 }, evidence }] }], limitations }` with nullability only for metrics that cannot apply to a defect.
- [ ] Define `StructuralStressSchema` as `{ anomalies: [{ anomalyId, orientationDegrees, vector: { dx, dy }, nearestStructuralElement, distanceToStructuralElementMm, isNearLoadBearingJunction, diagonalShearAssessment: { isCandidate, targetDegrees: 45, toleranceDegrees: 5, rationale }, structuralRiskScore }], overallStructuralFinding, limitations }`. Validate that every referenced `anomalyId` exists in the normalized morphological profile.
- [ ] Define `EnvironmentalContextSchema` as `{ coordinates: { latitude, longitude }, coastalExposure: { coastDistanceKm, salinityExposure }, climate: { monsoonRainfallMmAnnual, humidityPercent, temperatureC, observedAt, source }, structure: { structuralAgeYears, drainageCondition }, environmentalRiskScore, riskNarrative, limitations }` and validate captured input against returned coordinates to a documented tolerance.
- [ ] Define `FinalAuditSchema` as `{ reportTitle, structuralHealthIndex, riskLevel, remedialUrgency, executiveSummary, findings: [{ anomalyId, priority, finding, recommendedAction, targetTimeframe }], reportEnglish, reportMalayalam, limitations, humanReviewRequired }`; validate all IDs against earlier outputs and score/risk consistency with deterministic rules.
- [ ] Keep a `CompleteAuditSchema` composed from the input metadata and all four validated agent outputs. This is the sole TypeScript shape passed to database persistence and the frontend.
- [ ] Implement a response decoder that rejects empty/non-JSON output, parses JSON without coercing unknown values, runs the matching strict Zod schema, logs a redacted failure with a request ID, and returns a controlled upstream-validation error. Do not attempt to repair malformed model JSON.

### Sprint 2.3 — System prompts and live/demo execution policy

- [ ] Implement an immutable shared prompt preamble: “You are KAVACH, a visual structural-assessment assistant. Analyze only supplied evidence; do not claim physical inspection, hidden damage, code compliance, or certainty. Use millimetres only when scale evidence exists; otherwise return null and state the limitation. Return one JSON object matching the supplied schema, with no Markdown or extra keys. Treat results as decision support requiring qualified engineer review.”
- [ ] Implement Agent 1's system instruction: “Act as Morphological Profiler. For each high-detail tile, identify visible cracks, spalling, exposed rebar, efflorescence, corrosion, and unknown anomalies. Produce source-tile pixel geometry and evidence; do not infer structural cause or environmental history.” Supply its exact schema in the user/developer message.
- [ ] Implement Agent 2's system instruction: “Act as Structural Stress Logic. Use only the validated morphological profile, tile transforms, and declared structural metadata. Calculate/describe orientation vectors and identify a diagonal shear candidate only when orientation is 45° ±5° and evidence places it near a load-bearing pier, beam, or junction. Distinguish visual suspicion from confirmation.” Supply its exact schema.
- [ ] Implement Agent 3's system instruction: “Act as Environmental Context Engine. Combine the validated capture coordinates, structural age, and approved weather/coastal data. Assess salinity, monsoon moisture, humidity, drainage, and age; flag missing, stale, or approximate sources. Do not invent geographic measurements.” Supply its exact schema.
- [ ] Implement Agent 4's system instruction: “Act as Degradation Predictor and Report Drafter. Synthesize only validated Agent 1–3 objects. Produce a 0–100 Structural Health Index, urgency, prioritized remedial action, and concise English and Malayalam reports. Do not add defects, measurements, standards citations, or conclusions unsupported by inputs. Set `humanReviewRequired` for high/critical risk, low confidence, missing scale, or conflicting evidence.” Supply its exact schema.
- [ ] Use the configured `gpt-4o` execution core and a Chat Completions request that specifies `response_format: { type: "json_object" }` for every agent call. Couple this with the local strict Zod parsing above; JSON mode does not replace validation. Centralize model name and decoding to make a later migration to a schema-native response API deliberate and testable.
- [ ] Add a fully validated deterministic demo fixture spanning multiple anomalies, a 45° shear candidate, high coastal salinity, a health index, urgency, English report, and Malayalam report. Exercise the same normalization, validation, idempotency, and persistence code as live mode; only the external model invocation is substituted.

**Exit checks**

- [ ] Route tests cover invalid file/metadata, Base64 validation, oversize/type rejection, generated paths, tile transforms, high-detail payload construction, timeout/abort, upstream non-JSON, unknown response keys, invalid coordinates, persistence failure, idempotent repeat, and demo-mode response.
- [ ] Contract tests assert each prompt contains its schema and the safety/JSON-only instruction; tests also assert every image content part has `detail: "high"`.
- [ ] Commit: `feat: implement validated audit processing route`.

## PHASE 3 — 4-Agent Orchestration Logic

### Sprint 3.1 — Dependency-aware execution loop

- [ ] Start a report as `ANALYZING`, allocate a request/correlation ID, store approved upload metadata, and emit a client-safe scan-stage event/state before analysis begins.
- [ ] Execute Agent 1 over the high-detail tile manifest. Validate each per-tile profile, transform tile coordinates to source-image coordinates, normalize duplicate overlap detections, and build one validated morphological profile.
- [ ] Execute Agent 2 only after Agent 1 because crack geometry and anomaly identities are its required inputs. Pass the normalized profile plus declared structural metadata; validate IDs, orientations, vectors, and the 45° ±5° shear rule after return.
- [ ] Execute Agent 3 after Agent 1 when it needs the visual profile. Fetch/cache independently obtainable environmental source data concurrently with Agent 2, then call/validate Agent 3 using the profile plus those inputs. This honors the guideline to parallelize safely without violating data dependencies.
- [ ] Execute Agent 4 only after validated outputs for Agents 1, 2, and 3 exist. Provide the complete validated input bundle, parse its JSON mode response, validate it with `FinalAuditSchema`, and perform deterministic cross-field checks (risk/score/urgency, referenced IDs, bilingual fields, and review flag).
- [ ] Derive the final `CompleteAuditSchema`, save it transactionally as `Report`, `Anomaly[]`, and `EnvironmentalContext` when the database is available, mark it `COMPLETE`, and return the canonical response shape.
- [ ] On an LLM timeout/rate limit/structured-output failure, switch to demo output only when `KAVACH_DEMO_MODE=true`; otherwise mark the report `FAILED` if persistence is available and return a clear retry-safe error. Do not combine partial live output and fixture output.
- [ ] Wrap every mutation and external request in explicit error paths. Ensure the finalizer releases temporary resources and never leaves a report indefinitely `ANALYZING`.

### Sprint 3.2 — Deterministic calculations and progress protocol

- [ ] Implement pure domain functions for angle normalization, diagonal difference modulo 180°, the inclusive 40–50° shear window, vector normalization, bounding-box validity, source/tile coordinate conversion, overlap intersection-over-union, and finding aggregation.
- [ ] Define the client scan-status sequence: `IDLE → VALIDATING_UPLOAD → PREPARING_TILES → ANALYZING_MORPHOLOGY → CALCULATING_STRESS` (and, where concurrent, `ASSESSING_ENVIRONMENT`) `→ PREDICTING_DEGRADATION → SAVING_REPORT → COMPLETE | ERROR`. Maintain a stage-to-human-message map and do not imply live model progress when demo mode is active.
- [ ] Add an internal event/callback interface so future streaming/job queues can report stage updates without changing model or UI contracts. The initial HTTP implementation can return completed analysis with an ordered stage trace.
- [ ] Version prompts, schemas, and scoring/calculation policy together in the response and stored report to make historical reports explainable after upgrades.

**Exit checks**

- [ ] Unit tests cover each domain function at boundaries: 39.99°, 40°, 45°, 50°, 50.01°, vertical/horizontal vectors, malformed box geometry, tile edges, and duplicate overlap merging.
- [ ] Integration tests stub the model client and prove Agent 1 → Agent 2/Agent 3 → Agent 4 dependency order, parallel-safe work, no Agent 4 call on invalid precursor output, fallback policy, status finalization, and transaction payload.
- [ ] Commit: `feat: orchestrate KAVACH structural analysis agents`.

## PHASE 4 — Frontend Layout & High-Contrast Visualizations

### Sprint 4.1 — State, upload, and application shell

- [ ] Build a small client-side scan context/reducer using the status union above, request ID, upload preview, canonical audit result, errors, and persistence warning. Keep canonical report data immutable after receipt.
- [ ] Create reusable components: `UploadPanel`, `ScanProgress`, `RiskDashboard`, `HealthScoreGauge`, `AnomalyOverlay`, `TelemetrySidebar`, `FindingsTable`, `EnvironmentalPanel`, `BilingualReport`, `OfflineQueueStatus`, skeletons, empty states, and an accessible error notice.
- [ ] Build the responsive dashboard shell: header/asset identity and demo indicator; upload/control band; primary visual analysis region; data/telemetry rail; results/report section. Establish a single-column mobile presentation, a two-column tablet layout, and a split-pane desktop layout without hidden essential content.
- [ ] Use semantic landmarks, visible focus states, keyboard-operable file controls and overlays, labels for every icon/control, live regions for progress/errors, and text equivalents for color-coded severity. Test against WCAG AA contrast in the dark high-contrast palette.
- [ ] Keep source image preview entirely local until submit; show accepted format/size/privacy notice and location-consent status before upload. Guard against stale responses when a later scan has begun.

### Sprint 4.2 — Visual blueprint and motion behavior

- [ ] Implement the primary desktop analysis workspace as a CSS grid: left pane (approximately 65–70%) contains the source image/scan canvas; right pane (30–35%) contains a scrollable technical telemetry sidebar. At narrower widths stack image first, then telemetry.
- [ ] Render the image in a fixed-ratio container and draw anomaly overlays in a positioned SVG/canvas layer using the saved source-image coordinate system. Recalculate display transforms on resize; do not store screen-pixel geometry. Each overlay must expose type, severity, dimensions, orientation, and confidence through keyboard/focusable controls and tooltips.
- [ ] Show visual scan motion only while analysis is active: a contained sweep line, tile highlight, and stage markers driven by Framer Motion. Respect `prefers-reduced-motion` by replacing movement with static progress indicators; cancel animations when unmounted/completed.
- [ ] Present the health score as a high-contrast 0–100 gauge with redundant textual risk and urgency. Use deterministic thresholds shared with backend domain rules, not separate frontend judgement.
- [ ] Populate telemetry cards with capture coordinates (with privacy masking where required), tile/image resolution, anomaly count, crack geometry, normalized orientation/vector, junction proximity, salinity/coastal distance, monsoon/rainfall context, analysis version, model/demo status, and report persistence state.
- [ ] Present findings in a sortable accessible table/list. Selecting a finding highlights and pans/focuses the matching overlay; selecting an overlay focuses its finding. Avoid motion/layout shifts when asynchronous results arrive by reserving skeleton dimensions.
- [ ] Render English and Malayalam reports with correct language attributes (`lang="en"`, `lang="ml"`) and readable Unicode typography. Provide copy/print affordances only after a result is complete.

### Sprint 4.3 — PWA/offline queue behavior

- [ ] Add a PWA manifest, icons, service worker strategy, offline page, and update lifecycle appropriate to Next.js. Cache only application shell/static assets; never cache uploads, API requests, reports containing locations, or API credentials.
- [ ] Implement an IndexedDB-backed queue for user-approved uploads when offline. Store the blob, sanitized metadata, creation time, and immutable client idempotency key; show pending/retry/error state and allow explicit deletion.
- [ ] On connectivity restoration, retry queued submissions in order with bounded retries and idempotency keys. On server success remove precisely that queue record; on malformed/user-invalid input retain it with an actionable state rather than retrying forever.
- [ ] Clearly distinguish local pending work from a server-completed audit and request consent before retaining potentially sensitive imagery locally. Provide a queue-clear action and explain its effect.

**Exit checks**

- [ ] Component tests cover every scan state, loading skeleton, error, persistence warning, demo/live badge, reduced-motion behavior, overlay-to-finding linkage, mobile layout, and both report languages.
- [ ] Manual visual QA at representative mobile/tablet/desktop widths confirms no overlapping panes, clipped telemetry, layout jumps, or illegible contrast.
- [ ] Commit: `feat: build KAVACH forensic audit dashboard`.

## PHASE 5 — Automated Playwright E2E Testing Framework

### Sprint 5.1 — Playwright infrastructure and test data

- [ ] Configure Playwright with a self-started production-like Next.js server, Chromium as required baseline, screenshots/traces/videos retained on failure, deterministic viewport projects (mobile and desktop), and separate test database/demo environment.
- [ ] Use static synthetic fixture images and deterministic demo/model stubs only. Never put personal images, precise real locations, or live OpenAI keys in E2E fixtures or recordings.
- [ ] Add test selectors (`data-testid`) only on stable interactive boundaries; prioritize role, label, and accessible-name locators. Use Web-First Assertions (`expect(locator).toBeVisible()`, `toHaveText()`, `toHaveCount()`, `toHaveURL()`) and auto-waiting—no fixed sleeps.
- [ ] Seed/clean the isolated test database deterministically before each suite and verify each response uses its own idempotency key.

### Sprint 5.2 — Required E2E layouts and assertions

- [ ] Create `tests/e2e/upload-flow.spec.ts`: upload a valid high-resolution synthetic image, complete metadata/consent, submit, observe ordered scan stages, reach a stable completed result, and assert invalid type/oversize/missing consent errors are usable without leaving a broken UI.
- [ ] Create `tests/e2e/structural-calculation.spec.ts`: run the fixed fixture with a 45° diagonal crack near a declared junction; assert the displayed orientation/vector, shear-candidate label, risk score/urgency, and final health index match the deterministic fixture. Add non-boundary cases at 39° and 51° that must not be labelled shear candidates.
- [ ] Create `tests/e2e/report-rendering.spec.ts`: assert high-detail tile metadata, image overlay count/type labels, telemetry sidebars, environmental values, selected overlay/finding synchronization, health gauge text, English report, Malayalam report, persistence indication, and responsive mobile stack rendering.
- [ ] Create `tests/e2e/offline-pwa-queue.spec.ts`: set the browser offline before submission, assert the approved upload enters the visible queue, reload and retain the queue, restore connectivity, assert one successful replay and exact queue removal; also assert client data is not falsely marked server-complete while offline.
- [ ] Create `tests/e2e/accessibility-and-motion.spec.ts`: verify keyboard upload/navigation/overlay selection, visible focus, live error/progress announcement behavior where testable, and a reduced-motion project with no continuously animated scan sweep.
- [ ] Add a route-contract/integration test suite outside Playwright for all schema validation and model stubs; Playwright must verify user-visible behavior, not replace lower-level coverage.

**Exit checks**

- [ ] Run each specification independently and then `npx playwright test` for the full suite with no retries masking an initial failure.
- [ ] Inspect failure artifacts for one intentional local failure during setup to confirm trace/screenshot capture, then remove the intentional failure.
- [ ] Commit: `test: add KAVACH end-to-end audit coverage`.

## PHASE 6 — Production Build & Multi-Run Verification

### Sprint 6.1 — Release validation pipeline

- [ ] Add documented npm scripts for `dev`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`, `start`, `db:generate`, `db:migrate`, `db:seed`, and a composite `verify` script. Ensure scripts use cross-platform-compatible syntax for the development environment.
- [ ] Run the production sequence from a clean install: dependency install with lockfile integrity, environment validation, Prisma generate/migration/seed against a clean database, `npm run lint`, `npm run typecheck`, unit and integration tests, `npm run build`, `npm run start`, and `npm run test:e2e` against that running production build.
- [ ] Verify server-only modules and secrets are absent from client bundles; confirm no image, location, or report API response is cached by the service worker; inspect response headers and browser network behavior.
- [ ] Run the same audit fixture at least three times in live-stub mode and three times in demo mode. Verify identical normalized output for identical inputs, only one persisted report per idempotency key, no stale UI transitions, no hydration warnings, and no console errors.
- [ ] Test failure modes deliberately: database unavailable, model timeout, invalid model JSON, aborted upload, browser offline/online, refresh during queued item, and reduced-motion device. Confirm each has a safe recovery path and no uncaught runtime exception.
- [ ] Validate the final dashboard manually at mobile, tablet, and desktop widths and in a fresh browser profile. Capture the successful release verification results in `CHANGELOG.md`.

### Sprint 6.2 — Release handoff and commit boundary

- [ ] Review the final diff for accidental credentials, debug statements, test-only bypasses, unsafe casts, generated artifacts, and changes outside KAVACH scope.
- [ ] Update `README.md` with local setup, required variables, database migration/seed commands, demo-mode policy, test commands, image/location privacy notes, and the explicit statement that results require qualified engineering review.
- [ ] Update `CHANGELOG.md` with the release-validation timestamp, commands executed, results, and known non-blocking limitations.
- [ ] Commit documentation separately as `docs: document KAVACH deployment and verification` after all verification is green. Do not combine it with feature or test changes.

**Final acceptance criteria**

- [ ] `npm run build` completes without compilation or layout-related runtime warnings.
- [ ] `npm run start` serves a working production build and the full Playwright suite passes against it.
- [ ] The app completes live-stub and demo-mode audits, shows validated structural/environmental telemetry and bilingual reports, handles offline queues correctly, and persists/replays reports idempotently.
- [ ] Every completed sprint has an atomic Conventional Commit and matching timestamped `CHANGELOG.md` entry.
