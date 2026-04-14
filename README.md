# Decision Tracer UI

A run inspector for entity matching with three views:

- `Explorer` for the existing deterministic record-by-record flow
- `Chat` for the AI-assisted postmortem workspace
- `Graph` for a preview-first graph view of source records, clusters, and masters

## Setup

```bash
npm install
npm run dev
```

## Configuration

Create a local `.env` file with:

```env
VITE_INSIGHTS_API_BASE_URL=http://localhost:5003/api/v1
```

- `VITE_INSIGHTS_API_BASE_URL` is used by Explorer, Chat, and Graph.

## Routes

- `/explorer` keeps the existing deterministic decision explorer
- `/chat` keeps the existing analysis workspace UI, relabeled as Chat
- `/graph` adds the new preview-first graph workspace
- `/analysis` remains as a redirect to `/chat` for compatibility

## Build

```bash
npm run build
```
