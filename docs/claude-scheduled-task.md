# Claude scheduled planner

The dashboard never sends work to a metered model API. A Claude scheduled task calls the deployed MCP connector every morning.

## Connector

Set `MCP_SECRET` to at least 32 random characters and `MCP_USER_ID` to the UUID of the single dashboard user in Vercel. Add this remote connector in Claude:

```text
https://<your-vercel-domain>/api/mcp/<MCP_SECRET>
```

Confirm that Claude can list these tools before scheduling the task:

* `get_planning_context`
* `apply_plan`
* `add_item`
* `log_habit`
* `decompose_project`, after the projects migration is deployed

The URL is a credential. Do not paste it into screenshots, logs, issues, or committed files. Rotate `MCP_SECRET` if the URL is exposed.

## Schedule

Create one task in Claude that runs every day at 5:00am local time. Give it access only to the personal dashboard connector and use this prompt:

```text
Plan my week.

1. Call get_planning_context for today through 7 days out.
2. For any project with no steps yet, break it into ordered steps sized to fit real work sessions. Give each step an estimate and a target date on or before the project's deadline, then call decompose_project.
3. Build a schedule across the horizon. Honor due dates, remaining_minutes, planner preferences, working hours, blocked windows, calendar events, and every existing manual or locked block. Spread project steps across days so nothing waits for the night before. Give each proposed block a one-sentence reason.
4. Call apply_plan with scheduled_pass set to true for the full horizon.
5. Report how many blocks and steps were written, every rejected block and its reason, and any project whose remaining work does not fit before its deadline.

Never invent an item id, habit id, date, or time. If a tool rejects data, report the rejection. Do not work around the tool's validation.
```

## Verification

After the first run:

1. Open Today and confirm AI blocks have a one-line reason.
2. Confirm calendar events and manual or locked blocks were not moved.
3. Confirm a second unscheduled test run reports existing planner dates instead of silently rewriting them.
4. Confirm the next scheduled pass can replace only future, unlocked AI blocks.

If a run fails, the existing plan remains in place. Re-run the task in Claude or plan manually by dragging tasks onto the calendar.
