# Personal dashboard: product spec

A single-user web app that answers one question every time you open it: what should I be doing right now?

Everything else in the app exists to make that answer correct.

## Design principles

1. **Items and blocks are different things, and each gets its own place.** An item is a thing that exists ("Calc problem set 7.3, due Thursday"). It lives in the todo list. A block is a chunk of time where you work on it. It lives on the schedule. The todo list answers "what do I owe." The schedule answers "when am I doing it." Claude proposes blocks. You own them.
2. **Never stomp on a human edit.** If you move something, it stays moved. The planner only touches blocks it created and you haven't touched.
3. **The AI explains itself.** Every scheduled block carries a one-line reason. A schedule you can interrogate is a schedule you'll follow.
4. **Read-only first.** Google Calendar events are a read-only mirror. The app never writes back to Google Calendar. School assignment imports are disabled.
5. **Task creation is manual.** The owner adds every task, project, and project step. The assistant schedules existing leaf items only. Schoology and other assignment feeds do not create tasks.
6. **The model gets verbs, not a database.** Claude reaches the app through a handful of narrow MCP tools, and every write is validated before it lands. A hallucinated timestamp should be a rejected proposal, not a corrupted day.
7. **Estimates learn from you.** Every estimate starts as a default and drifts toward how long things actually take, measured from your own completed work.
8. **Boring beats clever.** No block editor, no plugin system, no formula language. A fixed set of pages, laid out the same way every time.

## Data model

```
users        id, email, timezone, working_hours_json, planner_prefs_json

sources      id, kind ('gcal' | 'ics' | 'manual'), label, url_secret,
             last_synced_at, last_error, enabled

items        id, source_id, external_id, parent_id, title, description,
             course, due_at, planned_date, priority ('low'|'normal'|'high'),
             est_minutes, remaining_minutes, actual_minutes,
             is_project, step_order,
             status ('open'|'done'|'archived'), origin ('ai'|'manual'|'feed'),
             created_at, completed_at, last_seen_at
             UNIQUE (source_id, external_id)
             INDEX (parent_id)

blocks       id, item_id (nullable), title, start_at, end_at,
             origin ('ai' | 'manual'), locked, done, reason,
             actual_minutes, created_at
             INDEX (start_at)

events       id, source_id, external_id, title, location,
             start_at, end_at, all_day
             UNIQUE (source_id, external_id)

course_defaults  course, default_minutes, sample_count

habits       id, name, cadence ('daily'|'weekdays'|'custom'),
             days_json, target_per_week, color, scheduled_time, archived

habit_logs   habit_id, date, done
             UNIQUE (habit_id, date)

notes        id, title, body_md, pinned, updated_at

links        id, title, url, tag, favicon_url, position

planner_runs plan_date, ran_at, blocks_written, rejections_json
             UNIQUE (plan_date)
```

The load-bearing decisions in this schema:

* `(source_id, external_id)` keeps Google Calendar event sync idempotent. Item source fields remain for previously imported assignments, but no new feed items are created.
* `parent_id` is how projects work. A plain task has no parent and no children. A project is an item with `is_project = true` whose children are its steps, each an ordinary schedulable item with a `step_order`. Blocks only ever point at leaf items (plain tasks or project steps), never at the project itself. The project's own `due_at` is the real deadline; each step gets its own earlier target so the work spreads out.
* `blocks.item_id` is nullable because "eat lunch" and "bike to school" are real blocks that aren't tasks.
* `remaining_minutes` tracks partial progress. It starts equal to `est_minutes` and drops as you complete blocks against the item. The planner schedules against what's left, not the original total, so a half-done project doesn't get re-planned from scratch.
* `actual_minutes` and `course_defaults` are the learning loop. Completing a block records how long it really took; that rolls into a per-course running average that seeds `est_minutes` on the next item from that course.
* `last_seen_at` is retained for historical feed items. Assignment sync no longer creates, updates, or archives items.
* `planned_date` is an intentional daily commitment, not a deadline. Main retains open leaf items with a past or current planned date across day changes. Unscheduled items without a planned date remain outside Main unless overdue or scheduled today. An explicit future `planned_date` keeps an item out of Main until that date unless it is overdue or scheduled today. Later membership continues to take precedence unless the item has a work block today. Projects never get a `planned_date`; their scheduled steps do the daily work.

## Pages

### 1. Today (the main page)

The default route is a daily workspace with a dominant Main task list, today's schedule, and a compact Later drawer at the right edge. Main and the schedule remain in the page flow on wide screens. Later stays collapsed behind a small blue handle until it is hovered, focused, or opened, then slides in as a secondary sheet for low-pressure tasks, reminders, and things worth keeping without treating them as current priorities. The user moves items between Main and Later by dragging or with an accessible move control. Both lists keep an always-visible quick-add row. The center schedule shows today's calendar events, work blocks, all-day commitments, and scheduled habits. It contains no planner warnings, metrics, notes, focus widgets, recovery controls, or dashboard statistics.

A task row uses its full height for one vertically centered line: a large completion checkbox, one emoji identifying the student's class or another useful workstream, a large task title, secondary action controls, and a dedicated due-date column aligned beneath a `Due` heading at the far right. AP Lit, AP Calc BC, AP Gov/Econ, AP Physics C, PE, and Ceramics each have a consistent emoji. The standalone abbreviation BC, regardless of capitalization, identifies AP Calc BC and uses its 📐 emoji. Tasks without a recognized category show no emoji but retain the same emoji slot width and title alignment. Feed names, source labels, estimates, and other metadata do not appear on the card surface. The row keeps its context menu for secondary actions. Project records never appear in Today.

Main sits inside one soft blush panel. Later uses a restrained cobalt-tinted drawer and stays visually subordinate. The collapsed drawer exposes a narrow, short handle with a centered `<` symbol and keeps an edge-aligned hover target available. Its final row is always a quick-add text box, including when the list is empty. Later membership is stored in the owner's planner preferences so it can include manual, feed, or AI-origin items without changing source-owned assignment data. Moving an item to Later removes its direct Today commitment and any unlocked AI block for today, while manual and locked schedule edits remain protected. A Later item with a work block today returns to Main for that day, which lets the planner restore it when its deadline or workload makes it timely. Manually entered tasks and previously imported assignments use the same `items` table and appear without a separate Assignments page. New tasks are added manually. The Today schedule is limited to the current day and supports the existing block interactions. Its visible school-day rail starts at dismissal, 4:00pm on Monday, Tuesday, and Thursday, and 3:15pm on Wednesday and Friday. Work blocks use a uniform centered title and a large, vertically centered time range at the right. The compact card surface omits lock controls, reasons, and secondary metadata; full context remains available from the block popover. Planning ahead and missed-work recovery live in Calendar, active work lives in Do Now, full habit management lives in Habits, notes live in Notes, and risk information lives in Weekly Review.

### 2. Calendar

This is the app's scheduling surface. Month, week, and day views render events and blocks together, visually distinguished. Events are read-only. Blocks can be dragged, resized, locked, and deleted.

A collapsible panel on the right holds the unscheduled items, so you can drag next week's assignments straight onto next Tuesday. This is the main way you plan ahead by hand.

A source filter in the corner lets you toggle each feed on and off.

Clicking any empty slot creates a manual block with no item behind it. Clicking an existing block opens a side panel with the full item, the reason Claude gave, and the option to reschedule or unschedule.

### 3. Projects and project view

Projects is a primary navigation item directly below Today. It has a compact index for long-term outcomes, separate from the daily Today list. Opening a project card leads to the detail route for one project.

At the top: the project title, its real deadline, and an overall progress bar (minutes done over estimated, and steps done over total).

Below that, the step list, in order. Each step is an ordinary item and shows its own estimate, its scheduled block if it has one, and a checkbox. Steps are added manually and remain fully editable: rename them, re-estimate, reorder by dragging, delete one, or add another. Editing a step marks it `origin = manual`.

Below the steps, a timeline: a simple horizontal Gantt from today to the deadline, one row per step, each bar sitting on the day its block is scheduled. Unscheduled steps stack in a "not yet placed" tray at the end. This is the view that answers "am I actually going to finish this," which a flat todo list can never show.

The project page provides a manual Add step form. There is no generated breakdown or automatic starter-step action.

If the steps as scheduled run past the deadline, the whole panel gets an at-risk banner, matching the sidebar widget.

### 4. Habits

A grid: habits down the left, the last 30 days across the top, filled dots for completions. Under it, per-habit stats: current streak, longest streak, completion rate against target.

Adding a habit takes a name, a cadence (daily, weekdays, or specific days), a weekly target, a color, and an optional schedule time. A scheduled time places the habit on Calendar but does not create a notification or reminder. The current day always has a dedicated completion control before the history grid.

Habits are fed to the planner, so if you have a "ride 30 minutes" habit and an empty 5pm, Claude can propose a block for it.

### 5. Links

A grid of link cards grouped by tag (School, Tools, Reading, whatever you define). Each card shows the favicon, the title, and the domain. Drag to reorder within a tag.

Adding a link takes a URL. The app fetches the page title and favicon so you don't have to type them.

This is the least interesting page and should take the least time to build. It exists so you stop keeping 40 pinned tabs. Build it last.

### 6. Notes

A list of short notes on the left, a markdown editor on the right. Live preview toggle. Pinned notes float to the top. Full text search across all notes in the header.

Deliberately not a wiki. No nesting, no backlinks, no databases. If a note grows past a page it belongs somewhere else.

Every day gets an automatic daily note in Notes.

### 7. Settings

* Working hours. Wake, sleep, and blocked-out windows (school hours, practice, whatever). On Monday, Tuesday, and Thursday, school blocks work through 4:00pm. On Wednesday and Friday, school blocks work through 3:15pm. The planner never schedules across these windows.
* Sources. Add a Google Calendar via OAuth. Each Google row shows last sync time, event count, errors, and manual sync controls. Existing ICS sources are labeled as inactive imports and cannot be enabled or synced. Tasks and steps are added manually.
* Course defaults. The per-course estimate table. Editable, but mostly it fills itself in as you complete work.
* Planner preferences. Free-text field. Things like "front-load hard work before dinner," "leave Friday evening empty," "always put bike rides in the afternoon." This gets dropped straight into the planner prompt.

## How Claude fits

No API key. No metered billing. The planner runs as a connected assistant's scheduled task talking to a custom MCP server that the app hosts itself.

### The MCP server

A single route in the Next.js app: `app/api/[transport]/route.ts`, built with `mcp-handler` over the official `@modelcontextprotocol/sdk`, speaking Streamable HTTP. Deployed with the rest of the site, so the connector URL is just `https://<app>/api/mcp`.

The server exposes a small set of narrow tools and nothing else. This narrowness is the whole security model. There is no `execute_sql`, no delete, no way to reach the schema directly. The model cannot double-book the calendar or move a locked block because no tool exists that does either.

**`get_planning_context(from_date, to_date)`**

One call, everything the planner needs over the horizon (default: today through 7 days out):

* Open items due inside the horizon plus a lookahead, with `remaining_minutes`, `priority`, `course`, and whether each is a project, a project step (with its parent), or a plain task
* Projects flagged `is_project` that have no steps yet, so the owner can add steps manually
* `task_creation: "manual_only"`, which forbids task discovery, imports, and generated steps
* Calendar events across the horizon
* Habits due in the horizon that aren't yet logged
* Every scheduled block in the horizon, plus a separate protected subset where `locked` is true or `origin` is `manual`
* Working hours and blocked-out windows
* The free-text planner preferences from Settings
* Which dates in the horizon already have a `planner_run`

Task creation tools are not exposed. `add_item` and `decompose_project` have been removed. The assistant never adds tasks, projects, or project steps.

**`apply_plan(from_date, to_date, blocks)`**

Takes an array of `{ item_id, title, start_at, end_at, reason }` spanning the horizon. Validates every block. Writes the survivors. Returns what it wrote and what it threw out.

Validation, all in TypeScript with Zod:

```ts
const Block = z.object({
  item_id:  z.string().uuid(),
  title:    z.string().min(1),
  start_at: z.string().datetime(),
  end_at:   z.string().datetime(),
  reason:   z.string().min(10),
})
  .refine(b => new Date(b.end_at) > new Date(b.start_at), 'end before start')
  .refine(b => minutes(b) <= 180, 'block longer than 3 hours');
```

Then per block, against the database:

* The item exists, its status is `open`, and it's a leaf (a plain task or a project step, never a project itself)
* `start_at` falls inside the `[from_date, to_date]` horizon
* The block sits inside working hours and outside every blocked window
* It doesn't overlap a calendar event
* It doesn't overlap an existing `locked` or `manual` block
* It doesn't overlap another block in the same proposal
* The item's blocks in total don't exceed its `remaining_minutes` by more than a small slack (so the planner can't schedule six hours against a two-hour item)

A block that fails any check is rejected, not thrown. The tool returns `{ written: n, rejected: [{ block, why }] }`. Those rejection reasons go back to the model, which reports them to you. That's the debug loop for the prompt, and it's the reason a hallucinated timestamp is a non-event rather than a corrupted day.

Before writing, `apply_plan` deletes blocks in the horizon where `origin = 'ai'` and `locked` is false and `done` is false. Manual blocks, locked blocks, and anything already completed survive untouched. The planner owns its own future proposals and nothing else.

**`update_item(...)`, `complete_item(item_id)`, `archive_item(item_id)`, and `log_habit(habit_id, date)`**

The assistant can update an existing owned item only after the user explicitly requests that exact mutation in the current interactive conversation. Item mutations require a real item id and `confirmed_by_user: true`. Unattended planner runs never call them. Existing source-owned feed items remain read-only through the MCP tools. Archiving is a soft removal that preserves completed steps and manual or locked schedule blocks. None of these tools creates an item.

**`create_note(title, body?, pinned?)` and `update_note(note_id, ...)`**

Claude can save longer research or reference information in Notes when it would not fit cleanly in a task description. Both writes are owner-scoped and validated. Updating requires the real note id returned by Sauce. These tools do not expose note deletion or unrestricted database access.

### Idempotency

A `planner_runs` table with a unique constraint on `plan_date`, one row per day planned. `apply_plan` records a row per date it writes into and skips a date that already has one unless the run is the scheduled morning pass. A double-fire or a hand-run in the afternoon can't silently rewrite days you've already settled.

### The scheduled task

One assistant task runs daily at 4:50am local time. It loads Sauce, schedules only existing tasks and manually added project steps, then verifies the accepted blocks in fresh planning context. It never discovers or imports new tasks from Gmail, Drive, chats, Schoology, or calendar events. Projects without steps wait for the owner to add them. Existing task fields remain unchanged during unattended runs. The full prompt is in `docs/claude-scheduled-task.md`.

AP Physics C quizzes happen in class and do not receive homework blocks. A separate task that explicitly says to study, review, or prepare for a Physics quiz is schedulable work.

### Auth on the MCP server

The correct answer is OAuth 2.0, which the MCP spec expects and which both Claude and ChatGPT handle with a popup.

The v1 answer, for an app with exactly one user, is a long random secret in the URL path (`/api/mcp/<32 random chars>`), checked on every request, scoped to a single hardcoded user id. This is security by unguessable URL over HTTPS. It is fine for a personal project and it is not fine the moment anyone else has an account. Written down here so it doesn't get forgotten.

### What this costs you

Things the API-key version would have given you, deliberately given up:

* No in-app replan button. The site can't call Claude without a key. Re-run the scheduled task from the Claude app, or just drag the blocks yourself. Dragging is faster anyway.
* No natural-language quick-add fallback. The deterministic parser carries it alone. Anything it can't parse becomes a plain untimed item, which is a fine failure.
* No automatic retries. If a run fails, the day keeps yesterday's plan and the Today page shows a stale banner. Never blank the day because a job didn't fire.
* Coupling to a product feature. If scheduled tasks or custom connectors change under you, the planner breaks. `apply_plan` is the escape hatch: swapping to a paid API key and a cron job later means writing one route that calls the same function with the same schema. Nothing else in the app changes.

### What Claude does not do

It does not create tasks, projects, or project steps, hard-delete items or notes, overwrite feed-owned items, or write back to Google Calendar. Archiving preserves the item record and every manual or locked schedule block. It saves a note only when useful source context is too long for an item description. The one thing it surfaces unprompted is a project that will not fit before its deadline, because that is information you cannot get by looking at today and can still act on. Beyond that it does not nag. Turning off the scheduled task stops automatic planning without deleting anything already saved.

### Cross-client note

ChatGPT supports custom remote MCP servers behind Developer Mode on paid plans. Since this server is remote by construction, it will work there too with no extra effort. Not a goal, just a free consequence.

## Stack

* Next.js (App Router), TypeScript strict, React
* TailwindCSS
* Supabase: Postgres with row-level security, Auth via Google OAuth (which also yields the calendar scope), and a `sources` table holding the tokens
* Zod for every boundary: calendar API responses, MCP tool input, server action input
* Server actions for UI mutations, no separate API layer
* `mcp-handler` and `@modelcontextprotocol/sdk` for the MCP route
* Vercel, with Vercel Cron for feed sync only (the planner is an assistant scheduled task, not a Vercel cron)
* `node-ical` for feed parsing

## Sync and deletions

Only Google Calendar events sync, both through cron and on page load when stale. Schoology and all other ICS assignment imports are disabled at the sync boundary and excluded from scheduled and page-load sync. Existing imported tasks are preserved without automatic updates or archiving. There is no feed connection action. Manual task and project-step entry remains available.

## Explicitly out of scope

Listing these so they don't creep in:

* A block editor of any kind
* Sharing, collaboration, or multiplayer anything
* Writing back to Google Calendar
* Mobile native app (the web app should just be responsive)
* Website blockers or invasive activity monitoring
* Anything that gamifies productivity beyond a habit streak counter

## Build order

Each of these should be independently shippable and useful.

1. **Skeleton.** Auth, empty Today page with sensible first-run empty states, items table, manual quick-add. You can add a task and check it off. No AI, no sync, no projects.
2. **Time.** Blocks table, the day rail, drag to schedule, the "do this now" counter writing `actual_minutes` and `remaining_minutes`. Now it's a usable manual planner that already measures how long things take.
3. **Calendar in.** Google Calendar OAuth, events mirror, calendar page, the sync-and-archive loop. Now it knows when you're busy and cleans up after deletions.
4. **The MCP server.** The route, `get_planning_context`, `apply_plan` with full Zod validation, item and note tools, `log_habit`, and `planner_runs`. Test it by connecting Claude and planning a few days by hand, in chat. Get the prompt right here, before automating anything.
5. **The scheduled task.** Turn the working hand-prompt into a 4:50am daily pass over the horizon. Now the schedule fills itself.
6. **Projects.** `parent_id`, project cards, the project view with its timeline, manual step entry, the at-risk widget, course-default estimate learning. This is the ambitious part; everything before it works without it.
7. **Habits.** Small table, grid UI, sidebar row. An afternoon of work.
8. **Links and notes.** The easy pages, built last.
9. **School feeds retired, September 29, 2026.** The owner adds school tasks manually. Keep existing imported history, but do not ingest assignments.
10. **Student command center.** Expand Today into the unified assignment inbox, then add the Do Now focus surface, SAT goals and practice history, spaced mistake review, missed-work recovery, careful alerts, command menu, and weekly review. SAT question content stays in the official College Board question bank or another properly licensed source. The dashboard stores only the student's own practice results and links.

Steps 1 through 3 have real value even if you never build the AI. Step 4 is worth having before step 5, because a dashboard you can talk to from any chat is already useful. Step 6 lets the owner split projects into manual steps and schedule them across days.

## Student command center expansion

The finalized student workflow adds three owner-scoped tables:

* `sat_profiles`: test date, current score, target score, and weekly study minutes
* `sat_sessions`: section, skill, mode, duration, questions, correct answers, and completion time
* `sat_mistakes`: section, skill, mistake reason, takeaway, confidence, optional source link, and next review date

Assignments retain the original item model and add `energy` with `low`, `medium`, and `high` values. Courses continue to use the existing `course` field so feeds, projects, and manually captured work share one category system. There is no separate Assignments route in navigation. Legacy `/assignments` links redirect to Today.

The daily workflow is now:

1. Capture work from the command menu, quick add, or bulk paste.
2. Review the short Today task list and today's commitments, then complete the next obligation.
3. Open Do Now for the next scheduled block and record progress without navigating elsewhere.
4. Recover missed blocks by moving them later, moving them to tomorrow, or unscheduling them.
5. Use Weekly Review to compare completed work, planned and actual focus time, habit consistency, SAT progress, and next week's load.
