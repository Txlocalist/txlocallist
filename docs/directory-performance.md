# Directory performance investigation — September 11, 2026

## Observed on production

A fresh unauthenticated desktop visit to `/results` transferred approximately
7.54 MB. Seven business photos accounted for 7,176,582 bytes; two individual
photos were 2.56 MB and 2.92 MB. The cards requested original uploads, including
off-screen photos, rather than resized thumbnails.

The initial business request took approximately 452 ms. An unrelated event
request took 1,743 ms. `Promise.all` prevented business cards from displaying
until both finished; photo requests therefore started around 2.53 seconds after
navigation. These are individual observations, not percentile measurements.

Filter/sort/pagination actions used `router.push`, rerunning the server page's
filter/account queries before its client effect fetched both result types again.
The events calendar also reran its server queries on local filtering despite
already having all event data.

## Changes

- Shared `DirectoryImage` uses Next Image resizing/caching and lazy loading for
  existing supported sources, including uploads served by `/api/blob-image`.
  Other user-supplied image hosts retain unoptimized support.
- Explore requests only the active result type and aborts superseded requests.
- Same-page filter changes use native history integrated with Next's search
  parameters. Browser history and shareable URLs are retained without rerunning
  the server page on each change.
- Search counts and rows run concurrently. Business queries select the fields
  needed for directory cards instead of retrieving every business column.
- Results filter data and session lookup start concurrently.
- A shared route loading boundary provides feedback during server navigation.

## Verification and limitations

- Production build and targeted ESLint checks passed.
- 12 targeted unit tests passed.
- 12 desktop/mobile browser checks passed using the existing isolated UI harness:
  sorting, filtering, pagination, refresh, Back/Forward, favorites, stale-response
  handling, and requests only for the visible type. The harness emulates Next's
  native history integration; it is not a production database integration test.
- The local production image optimizer successfully returned WebP thumbnails for
  all seven current live business photos. At width 640 and quality 75, their total
  size was 270,218 bytes (96.2% below the originals). Actual browser widths and
  pixel density determine which variants are requested.
- Full local results rendering is blocked by existing database schema drift
  (`P2022`, missing column during category/event queries). No schema changes were
  made as part of this optimization.
- Changes are local and have not been deployed. After deployment, repeat a cold
  mobile load and filtered searches against production; compare transferred image
  bytes and time to visible cards. Do not interpret the thumbnail reduction as a
  measured 96% reduction in total page load time.

Unused files are not established as the primary bottleneck. The measured costs
are large images and redundant/sequential data work. If server latency remains
high after deployment, profile authenticated database queries and deployment/DB
regions before adding caches or indexes. Avoid caching user-specific likes or
saved listings across accounts.
