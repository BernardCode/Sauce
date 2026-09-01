# sauce design system

sauce is a calm academic workspace for one student. It should feel focused, quick, and dependable, not like a collection of separate productivity templates.

## Product principles

1. Make the next useful action obvious.
2. Keep planning information dense enough to scan without feeling crowded.
3. Use white, gray, and black throughout the workspace. Today may use one light blush surface around Main and one restrained cobalt-tinted surface around Later.
4. Favor immediate local feedback for personal actions.
5. Keep every route visually related to the same workspace.

## Visual direction

- Typography: Manrope for interface text and headings, Geist Mono for times and compact data.
- Primary color: near-black. Use it for selected navigation, primary actions, focus rings, and current context.
- Surfaces: Notion-like white and warm neutral grays with thin borders and almost no shadows.
- Semantic states: communicate with copy, weight, and neutral contrast. Today uses blush for Main and a restrained cobalt tint for the subordinate Later rail.
- Shape: small radii for controls and panels. Avoid excessive pills and nested rounded cards.
- Motion: short and purposeful. Prefer 150 to 260 ms transitions, with full reduced-motion support.

## Layout rules

- The desktop sidebar stays compact and stable across every authenticated route.
- Page headers use a direct title. Add supporting copy only when the action would otherwise be unclear.
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

- Today: a dominant Main task and assignment list, a readable center schedule containing only today's commitments, and a smaller blue Later rail on the far right with its own quick-add row. Task cards use one vertically centered row with a larger checkbox, one class or workstream emoji, a readable title, and an aligned due column at the far right. Schedule cards center one concise task title with a large time range at the right. Keep Main visually dominant and omit metrics, warnings, and unrelated widgets.
- Projects: a compact long-term work index with progress and next steps before secondary details.
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
