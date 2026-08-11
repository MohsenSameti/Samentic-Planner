# Weekly Planner Web App - Specification

## Concept & Vision

A focused, productivity-oriented weekly planner that treats planning as a ritual. The app embodies the feeling of a well-worn leather planner—substantial, reliable, and satisfying to use. Tasks flow naturally through days, projects provide context, and custom metrics track progress toward goals. The interface prioritizes quick entry and fluid organization over complex features.

## Tech Stack

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Data Storage**: JSON file-based persistence
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
│   │   └── store.ts   # JSON file storage
│   └── data.json      # Persistent storage
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
