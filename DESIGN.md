# Daylight design system

Daylight is a calm academic workspace for one student. It should feel focused, quick, and dependable, not like a collection of separate productivity templates.

## Product principles

1. Make the next useful action obvious.
2. Keep planning information dense enough to scan without feeling crowded.
3. Use color for meaning and state, not decoration.
4. Favor immediate local feedback for personal actions.
5. Keep every route visually related to the same workspace.

## Visual direction

- Typography: Manrope for interface text and headings, Geist Mono for times and compact data.
- Primary color: cobalt. Use it for selected navigation, primary actions, focus rings, and current context.
- Surfaces: quiet ink-and-paper neutrals with thin borders and minimal shadows.
- Semantic colors: red for overdue or destructive states, amber for due soon, green for completion, blue for informational context.
- Shape: medium radii for controls and panels. Avoid excessive pills and nested rounded cards.
- Motion: short and purposeful. Prefer 150 to 260 ms transitions, with full reduced-motion support.

## Layout rules

- The desktop sidebar stays compact and stable across every authenticated route.
- Page headers use a small context label, a direct title, and one short description.
- Primary work areas may use panels, but avoid cards inside cards unless the nesting communicates hierarchy.
- On mobile, keep the page title and core action visible before secondary metrics.
- Touch targets should be at least 44 pixels high whenever space allows.

## Component rules

- Navigation uses one active treatment. Do not assign a different decorative color to every destination.
- Buttons have one clear primary style, one neutral secondary style, and a restrained destructive style.
- Status badges are reserved for real states. Do not use badges as labels for ordinary text.
- Empty states explain what is missing and provide one useful next action.
- Loading and saving states update in place without blocking the rest of the page.

## Route character

- Today: action-first daily briefing and focus plan.
- Assignments: compact work queue with obvious due state and fast capture.
- Calendar: scheduling surface with readable time hierarchy and calm event colors.
- SAT: focused study plan, not a promotional hero page.
- Habits: simple consistency tracking with low-friction daily completion.
- More: a compact utility index, not another dashboard grid.

## Avoid

- Decorative gradients behind major app content.
- Oversized marketing headlines inside the authenticated product.
- Rainbow navigation or unrelated accent colors per route.
- Repeated generic cards with equal visual weight.
- Long animations, looping movement, or motion that competes with schoolwork.
- Copy that sounds motivational without helping the student act.
