# Spec: Fix task card actions menu visibility and overflow

## Goal
Ensure the task card actions menu (three dots / kebab button) opens and displays properly on screen when clicked, without being hidden, clipped, or introducing unwanted scrollbars into the day column.

## Problem analysis & Root Cause
- In `TaskCard.vue`, clicking the three-dot kebab button computes viewport coordinates (`getBoundingClientRect`) and applies `position: fixed` to `.task-menu`.
- Because `.task-menu` was originally rendered inside `.task-card` in `.task-list`, ancestor styles (`will-change: transform` on `.task-card` and `contain: content` on `.day-column`) created a containing block for `position: fixed` elements. Rather than positioning relative to the viewport, the menu was placed relative to the card/column coordinate space.
- This misplaced the menu far down inside the column (relative to viewport-sized offsets like 250px-350px), expanding the scrollable height of `.task-list` and introducing vertical scrollbars into `.day-column`, while leaving the menu visually hidden from view unless the column was scrolled to the bottom.
- Furthermore, unconditionally mounting `<Teleport to="body">` when `menuOpen` is false renders dormant menu DOM nodes in `document.body` for every task card in the view, which causes stale node retention across Vite Hot Module Replacement (HMR) updates.

## Solution & Architecture
1. **On-Demand Teleportation (`v-if="menuOpen"`)**:
   - Wrap `.task-menu` in `<Teleport to="body" v-if="menuOpen">`.
   - The menu DOM tree is created and teleported directly into `document.body` only upon clicking the 3-dots button, and is cleanly destroyed on dismiss. No dormant menu elements linger in `document.body`, and parent column styles (`contain: content`, `overflow-y: auto`) can never constrain or scroll with the menu.
2. **Viewport Clamping**:
   - Compute `top` and `left` from `menuAnchor.getBoundingClientRect()`, clamping against `window.innerWidth` and `window.innerHeight` with a safety margin (8px) so the menu stays visible on desktop, tablet, and mobile screens without overflow.
3. **Comprehensive Dismissal Handlers**:
   - Outside click detection: dismiss when clicking outside `menuAnchor` and `menuRef`.
   - Keyboard: dismiss when pressing `Escape` (stops propagation).
   - Window scroll & resize: listen on `window` for `scroll` (in capture phase) and `resize` while the menu is open, auto-dismissing if the user scrolls the column/page or resizes the viewport.
   - Clean listener cleanup on `closeMenu()` and `onUnmounted`.

## Acceptance criteria
- Clicking the three-dots menu button on any task card immediately displays the menu adjacent to the button, floating over the grid.
- Opening the menu never triggers a scrollbar in the day column or task list.
- Clicking outside the menu, selecting an item, pressing `Escape`, scrolling any container, or resizing the viewport cleanly closes the menu.
- All menu actions (`edit`, `move`, `cancel`, `restore`, `delete`, notes toggle) continue to work as expected.
- Menu displays cleanly and remains accessible on desktop, tablet, and mobile screens.
- Full automated test suite passes (`pnpm test`) and project builds cleanly (`pnpm build`).
