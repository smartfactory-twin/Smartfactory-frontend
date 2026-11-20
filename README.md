# SmartFactory Twin — Frontend

React/Vite single-page application. It provides role-based dashboards, equipment/sensor management, readings and imports, alerts, maintenance orders, AI prediction views and visual inspection.

## Development

```powershell
npm ci
npm run dev
```

Vite listens on `http://localhost:5173`. Configure `VITE_API_BASE_URL` in `.env.local` if the API is not served at the same origin under `/api` (default). Start the Django API separately; full Compose instructions are in the [project README](../README.md).

## Verification

```powershell
npm test -- --pool=threads --maxWorkers=1
npm run test:coverage -- --pool=threads --maxWorkers=1
npm run build
npm run test:e2e
npm audit
```

Unit tests use Vitest + Testing Library and are restricted to `src/tests`. Browser E2E specs live under `e2e/` and use Playwright against Chromium and Firefox.
