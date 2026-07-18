# Changelog

## 2026-07-19 — Render build compatibility

- Normalized nullable OpenAI response request IDs before constructing structured-output errors, resolving the strict TypeScript build failure on Render.

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
