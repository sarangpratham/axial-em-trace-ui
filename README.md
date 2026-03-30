# Decision Tracer UI

A fast, dark-mode entity matching decision explorer for dev/QA teams.

## Setup

```bash
npm install
npm run dev
```

## Configuration

Create a local `.env` file with:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_TAMBO_API_KEY=replace-with-your-tambo-project-api-key
VITE_TAMBO_URL=http://localhost:8261
```

`VITE_TAMBO_API_KEY` comes from your self-hosted Tambo project. `VITE_TAMBO_URL`
should point at the self-hosted Tambo API service.

## Routes

- `/explorer` keeps the existing deterministic decision explorer
- `/analysis` adds the new Tambo-powered postmortem analysis workspace

## Build

```bash
npm run build
```
