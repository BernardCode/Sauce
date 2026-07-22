# Claude scheduled planner

The dashboard does not send work to a metered model API. A Claude scheduled task calls the deployed MCP connector every morning. Supabase Auth provides the OAuth 2.1 flow Claude requires.

## What is already in the app

The app provides:

* The OAuth-protected MCP endpoint at `https://<your-vercel-domain>/api/mcp`
* OAuth discovery metadata at `https://<your-vercel-domain>/.well-known/oauth-protected-resource`
* A consent screen at `https://<your-vercel-domain>/oauth/consent`
* A Google sign-in flow that returns to the consent screen
* A user restriction through `MCP_USER_ID`
* A legacy secret route for emergency testing only

Claude should use `/api/mcp`. Do not put `MCP_SECRET` in the Claude connector URL.

## 1. Confirm Vercel variables

Set these variables for both Production and Preview:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SOURCE_SECRET_KEY
CRON_SECRET
MCP_USER_ID
MCP_SECRET
```

`MCP_USER_ID` is the UUID of the one Supabase user Claude may access. `MCP_SECRET` is only for the legacy fallback route and must be at least 32 random characters.

Redeploy after changing a Vercel variable. Existing deployments do not receive new values automatically.

## 2. Enable the Supabase OAuth server

In the Supabase dashboard:

1. Open the dashboard project.
2. Go to **Authentication**, then **URL Configuration**.
3. Set **Site URL** to the production Vercel origin, with no path.
4. Add `https://<your-vercel-domain>/auth/callback` to the allowed redirect URLs if it is not already present.
5. Go to **Authentication**, then **OAuth Server**.
6. Enable the OAuth 2.1 server.
7. Set **Authorization Path** to `/oauth/consent`.
8. Enable **Dynamic client registration** so Claude can register itself.
9. Save the settings.

Supabase recommends an asymmetric JWT signing key for OAuth. In **Authentication**, then **Signing Keys**, confirm the active key uses RS256 or ES256. Rotate from HS256 if needed before requesting the `openid` scope.

You do not create a separate Claude client ID when dynamic client registration is enabled.

If the dynamic registration toggle does not remain enabled, use a manual public OAuth app instead:

1. Go to **Authentication**, then **OAuth Apps**.
2. Create an app named `Claude`.
3. Choose a public client with no client secret.
4. Add both callback URLs:
   * `https://claude.ai/api/mcp/auth_callback`
   * `https://claude.com/api/mcp/auth_callback`
5. Copy the generated client ID. Claude will ask for it in the connector's advanced settings.

## 3. Add the Claude connector

For an individual Claude Pro or Max account:

1. Open Claude.
2. Go to **Customize**, then **Connectors**.
3. Choose **Add custom connector**.
4. Name it `sauce`.
5. Enter `https://<your-vercel-domain>/api/mcp` as the remote MCP URL.
6. If you used a manual public OAuth app, open **Advanced settings** and enter its client ID. Leave the client secret empty.
7. Choose **Connect**.
8. Sign in with the Google account that owns the dashboard if asked.
9. On the sauce consent screen, review the access and choose **Allow**.

Confirm that Claude lists these tools:

* `get_planning_context`
* `apply_plan`
* `add_item`
* `log_habit`
* `decompose_project`

## 4. Create the scheduled task

1. Open **Scheduled** in Claude's left sidebar.
2. Choose **New task**.
3. Choose **Set up manually**.
4. Name the task `Plan sauce`.
5. Set it to run every day at `5:00 AM` in the local timezone.
6. Give the task access to only the `sauce` connector.
7. Use the approval mode that permits the trusted sauce tools to run without asking each morning.
8. Paste this prompt:

```text
Plan my week.

1. Call get_planning_context for today through 7 days out.
2. For any project with no steps yet, break it into ordered steps sized to fit real work sessions. Give each step an estimate and a target date on or before the project's deadline, then call decompose_project.
3. Build a schedule across the horizon. Honor due dates, remaining_minutes, planner preferences, working hours, blocked windows, calendar events, and every existing manual or locked block. Spread project steps across days so nothing waits for the night before. Give each proposed block a one-sentence reason.
4. Call apply_plan with scheduled_pass set to true for the full horizon.
5. Report how many blocks and steps were written, every rejected block and its reason, and any project whose remaining work does not fit before its deadline.

Never invent an item id, habit id, date, or time. If a tool rejects data, report the rejection. Do not work around the tool's validation.
```

## 5. Test it once

Run `Plan sauce` manually before waiting for the first scheduled run. Then:

1. Open Today and confirm AI blocks have a one-line reason.
2. Confirm calendar events and manual or locked blocks were not moved.
3. Confirm a second unscheduled test run reports existing planner dates instead of silently rewriting them.
4. Confirm the next scheduled pass can replace only future, unlocked AI blocks.

If a run fails, the existing plan remains in place. Re-run the task in Claude or plan manually by dragging tasks onto the calendar.

## Troubleshooting

If Claude says it cannot register with the sign-in service:

* Confirm the connector URL ends in `/api/mcp`, with no secret after it.
* Confirm the Supabase OAuth server is enabled.
* Confirm dynamic client registration is enabled, or enter the manual public OAuth app's client ID in Claude.
* Confirm the authorization path is exactly `/oauth/consent`.
* Open the deployed protected-resource metadata URL and confirm it returns JSON.
* Redeploy after any Vercel environment change.

If authorization returns to the wrong page, confirm the Supabase Site URL is the production Vercel origin and the production `/auth/callback` URL is allowed. The app also stores the intended consent return path in a short-lived, HTTP-only cookie because some OAuth providers omit nested callback query parameters.

Google can show the Supabase project hostname on its authorization screens. Set the Google OAuth consent branding to `sauce` and complete Google's verification to remove the unverified-app warning. Showing a custom dashboard hostname throughout Google's flow requires a custom Supabase Auth domain.
