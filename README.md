# KAVACH

KAVACH is a high-detail visual structural health and forensic audit workspace for inspection support. It transforms authorised smartphone or drone imagery into a validated anomaly profile, structural stress screen, environmental context, and bilingual engineering-review draft.

KAVACH is decision support only. It does not replace an in-person examination, calibrated measurement, or a qualified structural engineer’s judgement.

## Local setup

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` and `DATABASE_URL`. Do not commit `.env`.
2. Install packages with `npm install`.
3. Generate the Prisma client with `npm run db:generate`.
4. Apply the migration with `npm run db:deploy` (or `npm run db:migrate` during local schema development).
5. Optionally create the synthetic development record with `npm run db:seed`.
6. Start the workspace with `npm run dev`, then open `http://localhost:3000`.

For a local PostgreSQL instance, Docker is the quickest route:

```powershell
docker run --detach --name kavach-postgres --restart unless-stopped `
  --env POSTGRES_DB=kavach --env POSTGRES_USER=kavach `
  --env POSTGRES_PASSWORD=<local-password> --publish 5432:5432 `
  --volume kavach-postgres-data:/var/lib/postgresql/data postgres:16-alpine
```

Then set `DATABASE_URL` to the matching local connection string, for example `postgresql://kavach:<local-password>@localhost:5432/kavach?schema=public`.

## Audit workflow

1. The operator takes a photo with a supported phone camera or selects an inspection image.
2. The operator names the structure and chooses either an on-site live device location or a name-based public-record lookup for an uploaded image.
3. For public-record lookup, KAVACH presents a public map candidate for operator confirmation before it uses map coordinates or linked construction evidence. The operator can instead continue with visual-only triage.
4. The operator declares whether the frame is uncalibrated or contains a visible marker of known length. Without that scale evidence, physical millimetre measurements are explicitly withheld.
5. The validated morphology, visual orientation screen, evidence-grounded environmental stage, and predictor stage produce the visual dashboard and bilingual report.

The public-record step is best-effort. A missing or uncertain map match, construction date, or age is shown as unavailable rather than inferred. KAVACH rate-limits both audits and public map lookups, uses a conservative exact-name Wikidata fallback when a verified map record has no linked identifier, and displays source links for the selected OpenStreetMap and Wikidata records.

The default `KAVACH_DEMO_MODE=true` executes a deterministic, fully schema-validated demonstration result. Set it to `false`, provide `OPENAI_API_KEY`, and configure `OPENAI_MODEL` (default `gpt-4o`) for live model calls. GPT-4o receives high-detail image tiles and JSON-mode structured outputs; reasoning controls are sent only to models that support them. Images are divided into overlapping tiles no greater than 2048 × 2048 and submitted with `detail: "high"`.

Your OpenAI project must be permitted to call the selected model through Chat Completions. A model may be visible to the API while still returning a permissions error for inference; in that case, grant the project access or use a model that the project is permitted to invoke.

## Data and privacy

- Uploaded originals are stored outside the public static directory under `KAVACH_STORAGE_DIR` (default `./storage`).
- The intake never presents manual latitude, longitude, or age fields. It can use a permissioned live device location or a verified public structure record; the dashboard masks coordinates to coarse precision.
- For a structure-name lookup, KAVACH makes a rate-limited public-candidate search against OpenStreetMap Nominatim. The operator confirms the selected record before its coordinates or linked Wikidata `P571` construction evidence are used. It leaves age unavailable when a reliable public record does not exist.
- By default, an uncalibrated image has all physical millimetre and square-millimetre fields withheld. A declared reference marker only enables visual estimates and never replaces field measurement.
- Live environmental values are used only when `KAVACH_ENVIRONMENT_DATA_URL` is configured and responds. Without an approved source, the environmental context is explicitly unavailable rather than inferred.
- The service worker caches only the application shell and static assets; audit API traffic, reports, images, locations, and credentials are never cached.
- Offline uploads are stored only after the operator explicitly opts in. They can be retried after reconnecting or deleted from the queue.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development workspace. |
| `npm run build` / `npm run start` | Create and run the production build. |
| `npm run lint` / `npm run typecheck` | Static code checks. |
| `npm run test` / `npm run test:integration` | Unit and integration suites. |
| `npm run test:e2e` | Builds the standalone production server, then runs Playwright checks on desktop and mobile profiles. |
| `npm run verify` | Full release verification pipeline. |
| `npm run db:generate` | Generate Prisma Client. |
| `npm run db:deploy` / `npm run db:seed` | Deploy schema and load the synthetic seed audit. |

## Deployment notes

The audit route uses Next.js’s Node.js runtime because it writes validated media metadata and uses Prisma/PostgreSQL. It is intentionally not an Edge route. `npm run start` launches the generated standalone server, and the `postbuild` step copies public and Next static assets into that deployment bundle. The built-in request limiter is an in-memory, per-instance protection: it is useful for a single Render instance but must be replaced with a shared store such as Redis when horizontally scaling.

Before a public, multi-user rollout, complete these infrastructure gates:

- Replace the local `KAVACH_STORAGE_DIR` filesystem with a persistent object-storage adapter (for example, S3, R2, or Supabase Storage). Local `storage/` is suitable only for a single-node development/demo instance.
- Put the application behind real operator authentication and use a shared distributed rate limiter. A shared secret, database, or browser-only control is not an adequate substitute.
- Configure a documented environmental data provider and retain the provider response/version with each report.
- Move long-running audits to a durable background queue/worker so a deployment restart or request timeout cannot interrupt an inspection.
- Build a labelled, consented validation corpus and publish precision/recall, false-negative, and calibration results for each supported defect class before making performance claims.
