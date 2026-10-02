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
* `update_item`
* `complete_item`
* `archive_item`
* `create_note`
* `update_note`
* `log_habit`

## 4. Create or update the scheduled task

Update an existing planner task to use this prompt before its next run. Do not create a duplicate task.

1. Open **Scheduled** in Claude's left sidebar.
2. Choose **New task**.
3. Choose **Set up manually**.
4. Name the task `Plan sauce`.
5. Set it to run every day at `4:50 AM` in the local timezone.
6. Give the task access to `sauce`. Sauce already includes the connected calendar events needed for scheduling.
7. Use the approval mode that permits the trusted sauce tools to run without asking each morning.
8. Paste this prompt:

```text
Plan my next 7 days using the tasks and project steps already in Sauce. I add all tasks manually.

1. Call get_planning_context for today through 7 days out. Treat its calendar events as unavailable time.
2. Never add tasks, projects, or project steps. Do not search Gmail, Google Drive, chats, memory, Schoology, or calendars for missing work. Do not call add_item or decompose_project. An empty task list is valid and does not authorize inventing work.
3. Leave existing item fields unchanged. Projects without steps need manual steps from me; do not create a starter breakdown. Do not turn suggestions into notes or blocks that stand in for new tasks.
4. Build the schedule across the horizon using every open leaf item returned by the context, including assignments due after the horizon in the lookahead. Treat `due_at` as the submission cutoff, not an instruction to fill Today early. Use each item's `scheduling_guidance` when present. Keep ordinary work off the schedule until the day before it is due. Never place a block two or more calendar days before its deadline unless the item has more than 180 minutes remaining and one 90-minute session on each later pre-deadline day cannot fit the work. For that rare large-task exception, schedule only the minimum early work needed. Items whose list is `later` should stay there until their urgency is `start_now`, `due_today`, or `overdue`, or until a concrete calendar constraint makes an earlier session necessary. Do not schedule a Later item merely to empty the list. A work block on the current day returns that item to Main automatically. Keep essay and SAT work postponed until the user removes that preference. Schedule every other assignment whose `must_start_by` falls within the horizon. Budget its full `remaining_minutes` across available days through `target_completion_date`, using the recommended number of sessions and keeping sessions between 30 and 90 minutes when the remaining time allows. Spread genuinely large work requiring multiple sessions across multiple days. Use the due date only for emergency spillover, a final review, or submission. If the work cannot fit before its target, start it at the earliest allowed time and report the exact unscheduled minutes as a capacity risk. Honor planner preferences, working hours, blocked windows, Sauce calendar events, and every manual or locked block. Never schedule before school dismissal: 4:00pm on Monday, Tuesday, and Thursday, and 3:15pm on Wednesday and Friday. Give each proposed block a one-sentence reason that names the deadline or timing need. Use a concise, specific block title based on the assignment topic. Remove filler verbs such as Complete, Finish, or Work on. Abbreviate Unit 1 as U1 and similar numbered units the same way. Prefer a known chapter or topic name over a generic unit label. A scheduled block makes its leaf task visible on Today for that date, so do not place project records themselves on Today.
5. Call apply_plan with scheduled_pass set to true for the full horizon. Use only existing item ids for task work.
6. Call get_planning_context one final time and confirm every accepted block appears in scheduled_blocks. planned_date controls the Today task list directly, events are calendar commitments, and neither field confirms whether a schedule block was written. Report any accepted block missing from scheduled_blocks as a write verification failure.
7. Report blocks written, rejected writes and their reasons, deadlines, capacity risks, and projects that need manually added steps.

Never invent an item id, note id, habit id, deadline, date, event, or commitment. Never call update_item, complete_item, or archive_item during this unattended run. The confirmed_by_user field may only be true after a direct user request in an interactive conversation, which this scheduled run does not have. If a tool rejects data, report the rejection and do not work around its validation.
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
