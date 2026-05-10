# Decision Tracer UI

A run inspector for entity matching with three workspaces:

- `Explorer` for the sequential source-resolution flow
- `Chat` for the AI-assisted postmortem workspace
- `Review` for human review and publish decisions

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

- `VITE_INSIGHTS_API_BASE_URL` is used by Explorer, Chat, and Review.

## Routes

- `/explorer` is the primary source-resolution workspace
- `/chat` is the analysis workspace
- `/review` is the human review workspace
- unknown routes render a not-found page

## Build

```bash
npm run build
```

## Auth

- The UI opens at `/login` and redirects authenticated users to `/explorer`.
- Keep the UI and API on the same host label in local development, such as `localhost` with `localhost`, so the session cookie remains same-site.
- There is no self-service signup in the UI. Accounts are provisioned from the backend.
