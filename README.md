# Job Search

A single Next.js application for JSON job ingestion, approval, title search,
country filtering, and salary/date sorting. Frontend and API share one port.

## Run

Use Node 22.12+ (Node 22 only) and pnpm 10.32.1.

```sh
pnpm install
pnpm run dev
```

Open http://127.0.0.1:3000. Use `--port 3001` for another port.
For production, run `pnpm run build` followed by `pnpm run start`.

## Docker

Build and run the production application without installing Node or pnpm locally:

```sh
docker build -t job-search .
docker run --rm -p 127.0.0.1:3000:3000 job-search
```

Open http://127.0.0.1:3000. The image includes both default fixture feeds and runs
as a non-root user. To use your own feed, mount it read-only and set `JOB_FILES`:

```sh
docker run --rm -p 127.0.0.1:3000:3000 \
  --mount type=bind,source="$(pwd)/fixtures/demo.json",target=/app/feed.json,readonly \
  -e JOB_FILES='["/app/feed.json"]' job-search
```

## Checks

```sh
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm exec playwright install chromium
pnpm run test:browser
TEST_BUILT=1 pnpm run test:browser
```

Browser tests cover desktop/mobile and start their own server on port 3100;
stop the development server first. Screenshots and traces go to `test-results/`.
Use `pnpm run format` to apply the Prettier rules.

## Vercel Deployment

The **Deploy to Vercel** GitHub Actions workflow runs manually and deploys only to
production. The deployment job uses GitHub's `production` environment, including
its approval and branch protection rules. Create or link a Vercel project,
configure it to use Node 22, and add these environment secrets under
**Settings > Environments > production** in the GitHub repository:

- `VERCEL_TOKEN`: a Vercel access token with access to the project.
- `VERCEL_ORG_ID`: the team or account ID from `.vercel/project.json` after linking.
- `VERCEL_PROJECT_ID`: the project ID from `.vercel/project.json` after linking.

In GitHub, open **Actions > Deploy to Vercel > Run workflow**, choose a branch, and
run the workflow. The production deployment URL appears in the run summary.
Configure application environment variables in Vercel's production environment;
local `.env.local` files are not uploaded by this workflow.

To deploy only through this workflow, disable automatic Git deployments in the
Vercel project settings.

## Structure

- `src/app`: pages, layout, and API routes.
- `src/client`: interactive board and HTTP requests.
- `src/components`: reusable controls, header, job rows, and result states.
- `src/contracts`: shared Zod schemas and types.
- `src/server`: normalization, approval, ingestion, and in-memory storage.
- `fixtures`: original assignment data and synthetic demo listings.

## Styling

Tailwind CSS v4 runs through `@tailwindcss/postcss`. The global entry and CSS-first
theme live in [src/app/globals.css](src/app/globals.css); component utilities live
in [src/client/App.tsx](src/client/App.tsx) and `src/components`.

Inter Tight (sans) and JetBrains Mono (mono) are bundled locally with Fontsource.
Icons use inline SVGs. No font or icon CDN is used.
Tailwind v4 targets Safari 16.4+, Chrome 111+, and Firefox 128+.

## Job Board

Title search is debounced by 300 ms; country and sort changes request immediately.
Loading hides stale results and counts. Failed requests offer retry; empty filtered
results offer a reset to all jobs and newest-first sorting. Clearing search alone
preserves country and sort.

Pay displays in its original currency: annual amounts rounded to thousands,
hourly amounts with up to two decimals. Display rounding does not affect sorting.

## Ingestion and Approval

Startup loads `fixtures/assignment.json` and `fixtures/demo.json`. The original
20 records publish seven listings under the approval policy; the demo publishes
eight synthetic listings identified by `Demo:` company names.

Override feeds with a nonempty JSON array of paths, relative to the working directory:

```sh
JOB_FILES='["fixtures/demo.json"]' pnpm run dev
```

Each feed must be a JSON array. Invalid files abort startup; invalid records
reject individually. All rejection reasons are logged as structured JSON to stderr.
Restart to reload feeds. Storage is process-local and disappears on restart.

Approval requires:

- A nonblank title and explicit boolean remote status; remote anywhere or in-person US/CA.
- Explicit full-time employment.
- Positive salary and supported currency. Object salaries default to annual when `unit`
  is omitted; explicit `annual` and `hourly` units are supported. Numeric salaries
  still require currency and period evidence. Converted pay must exceed USD 100,000/year
  or USD 45/hour. No hourly-by-value inference.
- Recognized non-staffing classification: `Direct Employer`, `Consulting Agency`,
  or `Non-Staffing`. Missing/unknown classifications and staffing firms reject.
- A nonempty description and trusted `English`/`en` label, or `French`/`fr` for CA.
  Description language is **not detected or verified**.

USD conversion awaits an injected `FxRateProvider`:
`(currency: string) => Promise<number | undefined>`. Startup uses
`mockedUsdRateProvider`, which resolves fixed illustrative rates: USD 1, CAD 0.74,
GBP 1.27, EUR 1.08. There is no live FX service, HTTP request, or artificial delay;
a future service adapter can replace the mock through ingestion's `rateProvider` option.
Failed lookups reject only the affected job with `FX_SERVICE_UNAVAILABLE` and ingestion
continues, without fallback rates or exposing service errors. Missing or invalid rates
reject with `CURRENCY_UNSUPPORTED`. Conversion runs during startup ingestion, not search;
restart to reload feeds and recalculate conversions.

Original pay is preserved; hourly USD is annualized at 2,080 hours **only for sorting**.
Missing or invalid posting dates remain unknown. Approval rules are independently
testable; an injected salary policy can introduce exceptions without bypassing other rules.

## API

- `GET /api/health`: readiness, `{ "status": "ok" }`.
- `GET /api/jobs?search=Engineer&country=CA&sortBy=salary&sortOrder=desc`.

Search is a case-insensitive title substring, capped at 200 characters. Country is
an exact stated-country match, including remote jobs. Filters combine with AND.
Sorting defaults to newest first; salary uses annualized USD, unknown dates are
always last, and ties use ID.

Responses contain `items`, matching `total`, and unfiltered `availableCountries`.
Invalid or repeated query parameters return `400`; internal failures return a safe `500`.

No database, persistence, uploads, external fetching, deduplication, or pagination.
