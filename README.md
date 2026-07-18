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
2. The operator names the structure and chooses either a name-based location lookup (recommended for uploads) or live device location (recommended on-site).
3. KAVACH uses the supplied name to find public map candidates, asks the model to select only an evidence-supported match, and checks linked public construction data when available. A verified match supplies the inspection location for uploaded images.
4. The validated morphology, stress, environmental, and predictor stages produce the visual dashboard and bilingual report.

The public-record step is best-effort. A missing or uncertain map match, construction date, or age is shown as unavailable rather than inferred. KAVACH rate-limits public map lookups, uses a conservative exact-name Wikidata fallback when a verified map record has no linked identifier, and displays source links for the selected OpenStreetMap and Wikidata records.

The default `KAVACH_DEMO_MODE=true` executes a deterministic, fully schema-validated demonstration result. Set it to `false`, provide `OPENAI_API_KEY`, and configure `OPENAI_MODEL` (default `gpt-4o`) for live model calls. GPT-4o receives high-detail image tiles and JSON-mode structured outputs; reasoning controls are sent only to models that support them. Images are divided into overlapping tiles no greater than 2048 × 2048 and submitted with `detail: "high"`.

Your OpenAI project must be permitted to call the selected model through Chat Completions. A model may be visible to the API while still returning a permissions error for inference; in that case, grant the project access or use a model that the project is permitted to invoke.

## Data and privacy

- Uploaded originals are stored outside the public static directory under `KAVACH_STORAGE_DIR` (default `./storage`).
- The intake never presents manual latitude, longitude, or age fields. It can use a permissioned live device location or a verified public structure record; the dashboard masks coordinates to coarse precision.
- After an operator submits a named structure and live location, KAVACH makes one rate-limited nearby-name lookup against OpenStreetMap Nominatim, asks the model to select only an evidence-supported candidate, and queries linked Wikidata `P571` inception data for construction year. It shows source links and leaves age unavailable when a reliable match or public construction record does not exist.
- The service worker caches only the application shell and static assets; audit API traffic, reports, images, locations, and credentials are never cached.
- Offline uploads are stored only after the operator explicitly opts in. They can be retried after reconnecting or deleted from the queue.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development workspace. |
| `npm run build` / `npm run start` | Create and run the production build. |
| `npm run lint` / `npm run typecheck` | Static code checks. |
| `npm run test` / `npm run test:integration` | Unit and integration suites. |
| `npm run test:e2e` | Playwright browser suite. |
| `npm run verify` | Full release verification pipeline. |
| `npm run db:generate` | Generate Prisma Client. |
| `npm run db:deploy` / `npm run db:seed` | Deploy schema and load the synthetic seed audit. |

## Deployment notes

The audit route uses Next.js’s Node.js runtime because it writes validated media metadata and uses Prisma/PostgreSQL. It is intentionally not an Edge route. Configure persistent object storage via the storage adapter boundary before a multi-instance deployment; local `storage/` is for single-node development only.
