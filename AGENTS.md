<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-rules -->
# Project ground rules

`dashboard-spec.md` at the repo root is the source of truth. If an instruction conflicts with it, follow the spec and flag the conflict. Build only the current milestone from the spec's build order, nothing ahead of it.

Stack, fixed: Next.js App Router, TypeScript strict, React, TailwindCSS, Supabase (Postgres, Google OAuth auth, RLS on every table), Zod at every trust boundary, server actions for mutations, deployed on Vercel. Add task-scoped dependencies when they are necessary, and document them in the handoff.

Task entry:

* The owner enters every task, project, and project step manually. Do not create or import tasks automatically, including from Codex, other agents, Schoology, email, documents, or calendar events.
* Agents may schedule existing work. Do not restore task creation tools, feed ingestion, or generated project steps unless the owner explicitly changes this preference.

Style:

* Plain, readable code over clever code. Name things for what they are.
* No em dashes anywhere: code, comments, UI copy, commit messages. Use commas or periods.
* UI copy is human and direct. "Add a task", not "Let's get started on your journey!"
* Keep components small. Colocate a component with its server action when it makes sense.
* Comment the why, not the what. Skip comments that restate the code.

Security:

* Every table gets RLS policies scoping rows to their owner, written in the same migration that creates the table.
* Validate everything crossing a boundary with Zod. Malformed input is a clean rejection, never a 500 or a bad write.
* No secrets in client components or the repo. Environment variables only, each documented in `.env.example`.

Workflow: small commits, one concern each. Verify with `npx tsc --noEmit` and the test suite before declaring anything done. A smaller correct thing beats a larger guessed one.
<!-- END:project-rules -->
