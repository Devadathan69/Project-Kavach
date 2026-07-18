# KAVACH

KAVACH is a high-detail visual structural health and forensic audit workspace for inspection support. It transforms authorised smartphone or drone imagery into a validated anomaly profile, structural stress screen, environmental context, and bilingual engineering-review draft.

KAVACH is decision support only. It does not replace an in-person examination, calibrated measurement, or a qualified structural engineer’s judgement.

## Local setup

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL` for PostgreSQL.
2. Install packages with `npm install`.
3. Generate the Prisma client with `npm run db:generate`.
4. Apply the migration with `npm run db:deploy` (or `npm run db:migrate` during local schema development).
5. Optionally create the synthetic development record with `npm run db:seed`.
6. Use `npm run dev` for local development.

The default `KAVACH_DEMO_MODE=true` executes a deterministic, fully schema-validated demonstration result. Set it to `false`, provide `OPENAI_API_KEY`, and configure `OPENAI_MODEL` (default `gpt-4o`) for live model calls. Images are divided into overlapping tiles no greater than 2048 × 2048 and submitted with `detail: "high"`.

## Data and privacy

- Uploaded originals are stored outside the public static directory under `KAVACH_STORAGE_DIR` (default `./storage`).
- Coordinates are obtained only through the browser's live-location permission flow; the intake does not present manual latitude, longitude, or age fields.
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
