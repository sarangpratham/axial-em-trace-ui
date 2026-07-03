# Decision Tracer UI

A run inspector for entity matching with three workspaces:

- `Explorer` for the sequential source-resolution flow
- `Issues` for graph-native diagnostics and review links
- `Review` for human review and publish decisions
- `Cost` for run-scoped LLM/web-search spend and audit inspection

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

- `VITE_INSIGHTS_API_BASE_URL` is used by Explorer, Issues, and Review.
- `VITE_REVIEW_API_BASE_URL` can point Review to a separate review-service origin when needed.

## Routes

- `/explorer` is the primary source-resolution workspace
- `/issues` is the diagnostics workspace
- `/review` is the human review workspace
- `/cost` is the run-scoped cost and provider telemetry workspace
- unknown routes render a not-found page

## Build

```bash
npm run build
```

## Auth

- The UI opens at `/login` and redirects authenticated users to `/explorer`.
- Keep the UI and API on the same host label in local development, such as `localhost` with `localhost`, so the session cookie remains same-site.
- There is no self-service signup in the UI. Accounts are provisioned from the backend.
