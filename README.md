# Decision Tracer UI

A fast, dark-mode entity matching decision explorer for dev/QA teams.

## Setup

```bash
npm install
npm run dev
```

The app expects your API to be running at `http://localhost:5000/api/v1` by default.

## Configuration

Copy `.env.example` to `.env` and set your API base URL:

```
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

## Build

```bash
npm run build
```

## API Compatibility

This UI is a drop-in replacement for the original UI. It uses the exact same
API endpoints and data types — no backend changes required:

| Endpoint | Used for |
|---|---|
| `GET /traces/runs` | Run selector in topbar |
| `GET /traces/summary?run_id=...` | Stats pills in topbar |
| `GET /traces?run_id=...` | Sidebar entity list (supports module, final_status, winner_origin, q filters) |
| `GET /traces/:runId/:module/:uniqueId` | Trace detail panel |

## What changed vs original UI

- **Decision Pipeline** replaces the ReactFlow node graph — shows each stage
  (Input → Enrichment → Search(es) → Evaluation → Outcome) as clickable cards
  with a detail drawer that opens below.
- **Candidate Inspector** is now a ranked table with a visual score bar per row
  and a sticky evidence pane on the right.
- **Design** — JetBrains Mono + Syne, dark navy palette, no external component
  library dependency (dropped `@xyflow/react`).