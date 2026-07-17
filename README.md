# Personal dashboard

A single-user dashboard that answers one question: what should I be doing right now? The complete product contract is in [dashboard-spec.md](dashboard-spec.md).

The app includes:

* Today with quick-add, project cards, a draggable day rail, work timer, next block, habits, project risk, and an autosaving daily note
* Month, week, and day calendar views with read-only Google events and editable work blocks
* Claude planning through a narrow authenticated MCP server
* Project decomposition, editable ordered steps, progress, timeline, and learned course estimates
* A 30-day habit grid with streak and completion statistics
* Saved links with fetched titles and favicons
* Searchable markdown notes with pinning and live preview
* Encrypted Canvas, Schoology, or other ICS assignment feeds

## Stack

Next.js App Router, React, TypeScript strict, Tailwind CSS, Supabase Postgres and Google OAuth, Zod, `mcp-handler`, the official MCP SDK, and `node-ical`. All application mutations use server actions. Every table has owner-scoped row level security.

## Local setup

1. Install Node.js 20 or newer and npm.

2. Install dependencies:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill every value:

   | Variable | Purpose |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for cron, sync, and validated planner writes |
   | `GOOGLE_CLIENT_ID` | Google OAuth web client id |
   | `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret |
   | `SOURCE_SECRET_KEY` | Base64-encoded 32-byte AES key for source credentials |
   | `CRON_SECRET` | At least 32 random characters for `/api/sync` |
   | `MCP_SECRET` | At least 32 random characters placed in the private connector path |
   | `MCP_USER_ID` | Supabase auth UUID for the one dashboard user |

   Generate safe secrets locally:

   ```sh
   openssl rand -base64 32
   openssl rand -hex 32
   ```

   Keep `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, `SOURCE_SECRET_KEY`, `CRON_SECRET`, and `MCP_SECRET` server-only.

4. Apply every SQL file in `supabase/migrations/` in numeric order. Use the Supabase SQL editor or `supabase db push` if you have the CLI configured.

5. Configure Google OAuth:

   * Create a Google OAuth web client.
   * Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
   * Enable Google in Supabase Authentication and paste the client credentials.
   * In Supabase URL Configuration, set the local site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback`.
   * Add the production site and callback URLs before deployment.

6. Run the app:

   ```sh
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), sign in with Google, then configure working hours in Settings.

## Planner and MCP

The deployed connector URL is:

```text
https://<your-domain>/api/mcp/<MCP_SECRET>
```

It exposes only these tools:

* `get_planning_context`
* `decompose_project`
* `apply_plan`
* `add_item`
* `log_habit`

There is no SQL tool and no general data API. The path secret is checked on every request and all tool calls are scoped to `MCP_USER_ID`.

Use [docs/claude-scheduled-task.md](docs/claude-scheduled-task.md) to connect Claude and create the daily 5:00am planning task. The task itself lives in Claude, not Vercel Cron. Vercel Cron is used only for source sync.

## Calendar and school feeds

Signing in requests read-only Google Calendar access. The dashboard mirrors events and never writes back to Google.

Add a Canvas, Schoology, or other ICS URL from Settings. The URL is encrypted with AES-256-GCM before storage. A successful sync upserts assignments by `(source_id, external_id)`. Only after a clean fetch and parse does the app archive assignments that disappeared upstream. A fetch or parse failure leaves existing assignments untouched.

On Vercel Hobby, source sync runs once each day through `vercel.json`. Today and Calendar also sync on page load when a source is more than 15 minutes stale, so normal dashboard use stays current. Vercel Pro can restore the spec's 30-minute background schedule by changing the cron expression to `*/30 * * * *`.

## Quick-add

Quick-add reads optional date, time, and estimate tokens from the end of a line:

```text
chem lab writeup fri 5pm 90m
```

Supported dates include `today`, `tomorrow`, weekdays, and `7/20`. Estimates include `45m`, `2h`, and `1h30`. Prefix the line with `*` to create a project:

```text
* history documentary fri 3h
```

Unrecognized text remains part of the title. Quick-add never guesses with AI.

## Verification

Run all release checks before deployment:

```sh
npx tsc --noEmit
npm test
npm run lint
npm run build
```

The production build intentionally loads `node-ical` as a native Node package through `serverExternalPackages`. Its recurrence dependency uses top-level `BigInt`, which must not be rewritten by the Next.js server bundler.

## Deploying to Vercel

1. Import the GitHub repository into Vercel.
2. Add every variable from `.env.example` to the production environment.
3. Deploy and add the production callback URL to Supabase Authentication.
4. Confirm Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` to `/api/sync`. Vercel uses `CRON_SECRET` automatically for cron requests when it is configured.
5. Connect Claude to the private MCP URL and run the planner prompt by hand once.
6. Create the 5:00am scheduled task only after the manual planner run succeeds.

Never commit a source URL, OAuth token, service-role key, cron secret, or MCP connector URL.
