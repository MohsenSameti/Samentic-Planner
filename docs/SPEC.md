# Weekly Planner Web App - Specification

## Concept & Vision

A focused, productivity-oriented weekly planner that treats planning as a ritual. The app embodies the feeling of a well-worn leather planner—substantial, reliable, and satisfying to use. Tasks flow naturally through days, projects provide context, and custom metrics track progress toward goals. The interface prioritizes quick entry and fluid organization over complex features.

## Tech Stack

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Data Storage**: SQLite (via `better-sqlite3` + Drizzle ORM); location configured via `DATABASE_URL` in `.env`
- **Server**: `tsx` for development, compiled for production

### Frontend
- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Scoped CSS with CSS variables

### Monorepo Structure
```
planner/
├── backend/           # Express API server
│   ├── src/
│   │   ├── index.ts   # Server entry point
│   │   ├── routes.ts  # API endpoints
│   │   ├── db/        # Drizzle schema, client, store, migrations
│   │   └── ...
│   ├── data/          # SQLite database file (gitignored)
│   ├── drizzle.config.ts
│   └── .env.example
├── frontend/          # Vue.js SPA
│   ├── src/
│   │   ├── App.vue    # Main component
│   │   ├── api.ts     # API client
│   │   └── types/     # TypeScript types
│   └── index.html
└── package.json       # Root scripts
```

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Properties
- `GET /api/properties` - List all properties
- `POST /api/properties` - Create property
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

### Property Values
- `GET /api/property-values` - List all values
- `POST /api/property-values` - Set value (upsert)

### Notes
- `GET /api/day-notes` - List day notes
- `POST /api/day-notes` - Set day note
- `GET /api/week-notes` - List week notes
- `POST /api/week-notes` - Set week note

### State
- `GET /api/state` - Full state for initial load

## Data Model

### Project
```typescript
{
  id: string
  name: string
  color: string
  createdAt: number
  updatedAt: number
}
```

### Task
```typescript
{
  id: string
  projectId: string
  title: string
  date: string (YYYY-MM-DD)
  status: 'active' | 'completed' | 'cancelled'
  notes: string
  createdAt: number
  updatedAt: number
}
```

### Property
```typescript
{
  id: string
  name: string
  unit: string
  createdAt: number
  updatedAt: number
}
```

## Features

### Tasks (Daily)
- Add tasks to any day
- Complete tasks with checkbox
- Cancel tasks (soft delete)
- Restore cancelled tasks
- Delete tasks permanently
- Edit task title and project
- Move tasks to another day (drag & drop or menu)
- Add notes to individual tasks
- Tasks must belong to a project

### Projects
- Create projects with custom colors
- Filter the weekly view by project
- See task counts per project
- Edit/delete projects

### Custom Properties (Metrics)
- Define custom properties (e.g., "Hours", "Pages", "km")
- Fill in numeric values for each day
- Automatic weekly totals in sidebar
- Summary stats at the bottom of the week

### Notes
- Day notes for each day
- Week notes for the whole week
- All notes auto-save on blur

### Navigation
- Weekly view with prev/next navigation
- "Today" button to return to current week
- Today is highlighted with accent border

### Responsive Design
- Desktop: Full sidebar + 7-column grid
- Tablet/Mobile: Collapsible sidebar
- Mobile breakpoint: `max-width: 768px` (declared as `--bp-md` in `style.css`). At this width, container padding shrinks by one step on each axis (e.g. desktop `24 px` → mobile `16 px`) and primary button padding drops from `10/20` to `8/16` so it stays consistent with the rest of the shrunk layout. The sidebar switches to a fixed slide-in at `max-width: 1024px`.

## Design Language

### Colors
- **Background**: `#FAF9F7` (warm off-white)
- **Surface**: `#FFFFFF` (pure white)
- **Border**: `#E8E5E1` (warm gray)
- **Text Primary**: `#2D2A26` (warm black)
- **Text Secondary**: `#6B6560` (warm gray)
- **Accent**: `#D35400` (burnt orange)
- **Success**: `#27AE60` (completed green)
- **Muted**: `#9B9B9B` (disabled/cancelled)

### Typography
- **Headings**: DM Serif Display
- **Body**: IBM Plex Sans
- **Monospace**: IBM Plex Mono

### Spacing
A 4 px base scale, declared as CSS custom properties in `:root` (see `frontend/src/style.css`):

| Token | Value | Common use |
|---|---|---|
| `--space-0` | 0 | reset |
| `--space-1` | 4 px | tight padding (chips, button icons) |
| `--space-2` | 8 px | most gaps, small padding |
| `--space-3` | 12 px | larger gaps, section padding |
| `--space-4` | 16 px | page gutters, form fields, modal padding |
| `--space-5` | 20 px | modal section padding, page outer padding |
| `--space-6` | 24 px | page-level padding, large section padding |
| `--space-8` | 32 px | login card padding, top-level hero spacing |
| `--space-10` | 40 px | reserved for future use |
| `--space-12` | 48 px | reserved for future use |

Component styles **must** reference these tokens via `var(--space-N)` for every `padding`, `margin`, and `gap` declaration. Raw `Npx` literals in spacing declarations are a CI lint failure (see `style.spec.ts`). Off-grid values from the pre-token codebase (2, 6, 10, 14, 28 px) were rounded into the nearest token during the migration; the scale itself is locked at the values above.

The mobile breakpoint is `--bp-md: 768px` (see **Responsive Design**). The same `--space-*` tokens apply at all widths — there is no separate mobile token set.

## Running the App

```bash
# Install dependencies
pnpm install

# Start both servers (backend on 3000, frontend on 5173)
pnpm dev

# Or start individually:
pnpm dev:backend  # http://localhost:3000
pnpm dev:frontend # http://localhost:5173

# Production build
pnpm build
pnpm start  # Backend only
```

## Backend Configuration

The backend reads `DATABASE_URL` from `backend/.env` (copy
`backend/.env.example` to get started). Accepted values:

- `:memory:`                  — in-memory (tests).
- `./data/planner.db`         — relative path (default).
- `/abs/path/to/planner.db`   — absolute path.
- `file:./data/planner.db`    — Drizzle's `file:` convention.

After editing `backend/src/db/schema.ts`, regenerate the
migration with `pnpm --filter planner-backend db:generate`.

### Termux notes

`better-sqlite3` builds from source on Termux because no
Android prebuilt binary is shipped. node-gyp on Android fails
to evaluate `<(android_ndk_path)` in Node's bundled
`common.gypi`; the fix is to define an empty override in
`~/.gyp/include.gypi`:

```json
{
  "variables": {
    "android_ndk_path%": ""
  }
}
```

`pnpm` is also configured (via `pnpm.onlyBuiltDependencies` in
`backend/package.json`) to auto-run the build script for
`better-sqlite3`, so `pnpm install` will rebuild the native
binding on every fresh checkout.
