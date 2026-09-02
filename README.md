# syncwindow

A small browser app that finds overlapping work hours for a distributed US and EU remote team.

I built this as a junior portfolio project. Scheduling across New York, San Francisco, London, and Berlin is a problem I actually bump into in interviews and remote standups, so the math here is the whole point, not a wrapper around a huge UI kit.

## What it does

- Starts with four cities: New York, San Francisco, London, and Berlin.
- Each city has its own local start and end time (default 09:00 to 17:00).
- You can add any IANA time zone, for example America/Chicago or Europe/Paris.
- The shared window is shown in UTC and in every city local time.
- A simple UTC timeline draws each work block and highlights the overlap.
- Daylight saving is handled by the JavaScript Intl API, so January and July can produce different overlaps. There is no backend.

A 09:00 to 17:00 day in all four default cities often has no shared hour. That is expected: San Francisco is too far west of Berlin. Stretch hours to 08:00 to 18:00 and a one-hour winter window appears. The tests pin those cases to 2026 dates.

## Run

Needs Node.js 20 or newer. From this folder, install dependencies, then start the Vite dev server. Open the URL it prints, usually localhost port 5173.

Scripts (see package.json):

- dev: Vite development server
- test: Vitest in run mode
- build: TypeScript check plus Vite production build

## Test

Overlap math lives in src/overlap.ts and is covered by Vitest in tests/overlap.test.ts. The test script is `test` in package.json. The build script type-checks and writes a static dist folder.

## How the overlap is computed

1. Parse the chosen calendar date.
2. Convert each member local start and end into UTC instants (zonedLocalToUtc).
3. Intersect those UTC ranges.
4. If the intersection is empty, report no overlap; otherwise format the shared interval in each zone.

Same-day windows only: end must be after start on that local day. Overnight shifts are out of scope on purpose.

## Stack

Vite, TypeScript, React, Vitest. No server, no database, no secrets.

## License

MIT. Copyright Israel Temmie 2026.
