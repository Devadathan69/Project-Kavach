# Changelog

## 2026-07-19 03:25:50 +05:30 - Live stress-score compatibility

- Files modified: `src/lib/prompts.ts`, `src/lib/schemas.ts`, `tests/unit/domain-and-metadata.test.ts`, and `CHANGELOG.md`.
- Fixed the live GPT-4o audit failure caused by decimal `structuralRiskScore` values. The bounded visual stress-screen score now accepts decimals, while prompts explicitly retain whole-integer requirements for persisted environmental and final-audit scores and finding priorities.
- Added a regression test for a bounded decimal stress score. The unit suite and production build passed, and the restarted local production server returned HTTP 200 for both health and dashboard routes.

## 2026-07-19 03:15:49 +05:30 - Complete verification and standalone deployment repair

- Files modified: `eslint.config.mjs`, `next.config.ts`, `package.json`, `package-lock.json`, `playwright.config.ts`, `postcss.config.mjs`, `scripts/prepare-standalone.mjs`, `src/components/analysis-canvas.tsx`, `tests/unit/domain-and-metadata.test.ts`, `tests/integration/health.integration.test.ts`, `tests/e2e/intake.spec.ts`, `vitest.config.ts`, `vitest.integration.config.ts`, `README.md`, and `CHANGELOG.md`.
- Repaired the non-interactive lint command and added a flat ESLint configuration. Lint, strict TypeScript checking, a five-case unit suite, and a health-endpoint integration suite now run successfully from the documented commands.
- Added deterministic Playwright coverage for desktop Chromium and a Pixel 5 profile: mobile camera capture, safe visual-only intake defaults, completed demo audits, and consented offline queueing. Browser tests now build and exercise an isolated production server on a dedicated port.
- Repaired standalone production deployment: `npm run start` now launches `.next/standalone/server.js`, while a post-build step copies public and Next static assets into the standalone bundle. Verified the production health route, root page, intake markup, and a rendered JavaScript asset all return HTTP 200.
- Final verification passed with `npm run verify`: lint, typecheck, 5 unit tests, 1 integration test, production build, and 6 Playwright checks all passed.

## 2026-07-19 02:50:45 +05:30 - Evidence-bound audit hardening

- Files modified: `src/app/api/audit/route.ts`, `src/app/api/asset-context/route.ts`, `src/components/kavach-workspace.tsx`, `src/components/risk-dashboard.tsx`, `src/components/scan-progress.tsx`, `src/components/upload-panel.tsx`, `src/lib/asset-context.ts`, `src/lib/offline-queue.ts`, `src/lib/orchestrator.ts`, `src/lib/prompts.ts`, `src/lib/request-rate-limit.ts`, `src/lib/schemas.ts`, `README.md`, and `CHANGELOG.md`.
- Added an explicit measurement basis. Uncalibrated images now have all physical millimetre geometry and distance values removed server-side, require human review, and are labelled as visual triage. A declared reference marker enables visual estimates only.
- Added operator-confirmed public structure context. The intake can preflight a public map record, lets the operator confirm it, and only then uses the candidate's location and linked construction evidence; the audit endpoint rejects an unconfirmed automatic match. Visual-only triage remains available.
- Prevented live environmental claims without an approved configured source. The pipeline now emits unavailable environmental context instead of asking the model to infer weather, salinity, rainfall, humidity, or coast distance.
- Added per-instance request limits for expensive audit and public-record lookup endpoints, plus explicit retry timing. Updated dashboard, prompt wording, and deployment documentation to distinguish visual screening from certified structural-health or load calculations.

## 2026-07-19 — GPT-4o runtime compatibility

- Restored `gpt-4o` as the default live-analysis model and updated the Render example configuration and intake badge accordingly.
- Restrict `reasoning_effort` to GPT-5 and o-series models, preventing GPT-4o's HTTP 400 unsupported-parameter error while preserving high-detail image and JSON-mode analysis.

## 2026-07-19 — Render build compatibility

- Normalized nullable OpenAI response request IDs and replaced an unsafe error-status cast with a type guard, resolving strict TypeScript build failures on Render.

## 2026-07-19 — Stable development hydration and audit failures

- Disabled PWA registration in development and actively remove KAVACH shell caches there. Production now caches only static assets and never a rendered dashboard document, preventing stale HTML from hydrating against fresh JavaScript.
- Contained unexpected audit-orchestration exceptions in a typed, retry-safe pipeline failure instead of returning an uninformative HTTP 500 response.

## 2026-07-19 — Fresh intake shell after deploy

- Updated the PWA service-worker cache strategy so the dashboard and Next.js bundles prefer the current network version, while keeping a cached offline fallback. This prevents an old intake screen from hiding the camera and name-based location options after a local restart or deployment.

## 2026-07-19T01:15:39+05:30

- Files modified: `src/lib/asset-context.ts`, `README.md`, and `CHANGELOG.md`.
- Confirmed after a development-server restart that `gpt-5.6-sol` completes the full live audit flow with HTTP 201 and PostgreSQL persistence. The earlier HTTP 401 came from the stale process retaining the unavailable alias configuration.
- Strengthened direct structure-name matches and added a conservative exact-name Wikidata entity-search fallback before construction-year retrieval, while preserving unavailable results for ambiguous evidence.

## 2026-07-19T01:10:58+05:30

- Files modified: OpenAI model configuration, audit metadata/context resolution, live intake and telemetry components, offline queue metadata, API route, `README.md`, `.env.example`, and `CHANGELOG.md`.
- Switched the configured analysis model to `gpt-5.6-sol` with high reasoning after confirming its Chat Completions JSON-mode capability.
- Added mobile rear-camera capture alongside upload. Replaced mandatory live-location capture with an explicit strategy: verified structure-name lookup is the default for uploads, while live device location remains available for on-site captures.
- A verified public structure match now supplies inspection coordinates and construction-age evidence where available; ambiguous or unavailable matches do not invent a location or age.
- Live model invocation is currently blocked by the configured OpenAI project's HTTP 401 insufficient-permissions response for `gpt-5.6-sol`; credits alone do not resolve that account entitlement.

## 2026-07-19T00:55:47+05:30

- Files modified: `README.md`, `.gitignore`, and `CHANGELOG.md`.
- Documented the exact local PostgreSQL/Docker setup, live-location and public-record audit workflow, unavailable-evidence policy, and local development URL.
- Expanded ignored files to protect all environment variants while retaining `.env.example`, as well as local runtime storage, caches, coverage, and verification artifacts.

## 2026-07-19T00:50:25+05:30

- Files modified: validated OpenAI response handling, audit orchestration/schema/prompt modules, location-aware intake/dashboard/offline metadata, new public asset-context resolver, and `README.md`.
- Fixed the live 424 failure: model output that violates the strict JSON contract now receives one explicit corrective re-execution with validator feedback; output is never silently coerced. A live smoke audit completed with HTTP 201 and PostgreSQL persistence.
- Removed manual latitude, longitude, and structural-age inputs. The browser now acquires a permissioned live location, while a rate-limited OpenStreetMap candidate search, AI evidence match, and linked Wikidata construction-date lookup derive verified structure context and age when publicly available.
- Deferred by user instruction: the complete lint, type-check, unit/integration, Playwright, and production-build verification suite.

## 2026-07-19T00:34:46+05:30

- Files modified: local ignored `.env` and generated `next-env.d.ts`; `CHANGELOG.md` updated to record the environment setup.
- Provisioned the local `kavach-postgres` PostgreSQL 16 container, set the local `DATABASE_URL`, deployed migration `20260719000100_init`, enabled live model mode, and started the development server on port 3000.
- Confirmed the running health endpoint and root workspace route respond successfully. No full lint, type-check, test-suite, or production-build verification was run.
- Removed an accidentally copied API key from `.env.example` before staging it. The key should be rotated by its owner.

## 2026-07-19T00:24:23+05:30

- Files modified: application foundation, Prisma schema/migration/seed, server-side audit route and orchestration modules, dashboard components, PWA assets, dependency/configuration files, and `README.md`.
- Implemented the KAVACH Next.js 15 application: validated high-detail image intake; sequential dependency-aware four-agent OpenAI pipeline with deterministic demo fallback; PostgreSQL/Prisma report persistence; high-contrast structural audit dashboard; consent-based offline queue; and deployment guidance.
- Deferred by user instruction: linting, TypeScript checks, unit/integration tests, Playwright E2E tests, production build/start validation, migration deployment, and seed execution against a live PostgreSQL database.

## 2026-07-18T23:58:56+05:30

- Files modified: `IMPLEMENTATION_PLAN.md`, `CHANGELOG.md`
- Added the KAVACH implementation blueprint before any application code, covering the specification, backend validation/orchestration, Prisma schema, dashboard, testing, production verification, and the required ongoing change-log/atomic-commit workflow.
