# Personal dashboard

A single-user dashboard that answers one question: what should I be doing right now? Full product spec in [dashboard-spec.md](dashboard-spec.md).

Current state: milestone 1, the skeleton. Sign in with Google, add tasks through quick-add, check them off. No AI, no calendar sync, no projects yet.

## Stack

Next.js (App Router, TypeScript strict), TailwindCSS, Supabase (Postgres, Auth, RLS), Zod, server actions for all mutations. Deployed on Vercel.

## Setup from a clean clone

1. Prerequisites: Node 20 or newer, npm, a Supabase project, a Google Cloud OAuth client.

2. Install:

   ```
   npm install
   ```

3. Environment. Copy `.env.example` to `.env.local` and fill both values from the Supabase dashboard (Project Settings, Data API for the URL; Project Settings, API Keys for the publishable key):

   | Variable | What it is |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`). Safe in the browser, RLS enforces access |

4. Database. Apply the SQL files in `supabase/migrations/` in order (Supabase SQL editor, or `supabase db push` if you use the CLI). Every table has row level security scoping rows to their owner.

5. Google OAuth (one-time, in two dashboards):
   - Google Cloud Console: create an OAuth 2.0 Client ID (web application). Add this authorized redirect URI, with your project ref substituted: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Supabase dashboard, Authentication, Sign In / Providers: enable Google and paste the client ID and secret.
   - Supabase dashboard, Authentication, URL Configuration: set Site URL to `http://localhost:3000` while developing, and add your production URL plus `http://localhost:3000/auth/callback` to the redirect allow list.

6. Run:

   ```
   npm run dev
   ```

   Open http://localhost:3000, sign in with Google, add a task.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on localhost:3000 |
| `npm run build` | Production build |
| `npm test` | Quick-add parser unit tests (vitest) |
| `npx tsc --noEmit` | Typecheck |

## Deploying to Vercel

Import the repo in Vercel, set the two environment variables from `.env.local`, deploy. Then add the deployed URL to the Supabase auth redirect allow list (step 5) and switch Site URL to the production URL.

## Quick-add syntax

One line, tokens at the end, all optional: `chem lab writeup fri 5pm 90m`

- Due date: `today`, `tomorrow`, a weekday (`fri`), or `7/20`, with an optional time (`5pm`, `11:59pm`, `17:00`). A date without a time means 11:59pm.
- Estimate: `90m`, `45min`, `2h`, `1h30`.
- Anything the parser cannot read stays in the title and the item is created untimed. That is the intended failure mode, not an error.
