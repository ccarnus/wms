# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

The entire stack runs via Docker Compose. There is no local dev server — frontend is built statically and served by Nginx.

```bash
cp .env.example .env              # First time only
docker compose up --build         # Build and start all services
docker compose up --build -d      # Same, detached
docker compose down -v            # Stop and wipe volumes (full reset)
```

Rebuild a single service after code changes:
```bash
docker compose build --no-cache frontend && docker compose up -d frontend
docker compose build --no-cache backend && docker compose up -d backend
```

### Backend tests (Node.js built-in test runner + assert/strict)
```bash
cd backend && npm test
# Runs: test/taskGenerationLogic.test.js && test/laborMetricsAggregationService.test.js
```

### Seed the default admin user
```bash
docker compose exec backend npm run seed:users
# Creates admin/admin123 (idempotent)
```

### Run SQL against the database
```bash
docker compose exec -T db psql -U wms_user -d wms < database/init/002_users.sql
```

## Architecture

```
Browser → Nginx (:8080) → /api/*        → Express backend (:3000)
                        → /socket.io/*  → Socket.IO on same backend
                        → /*            → Static React bundle

Backend → PostgreSQL 16 (pg pool, raw SQL, no ORM)
       → Redis 7 (BullMQ queues + pub/sub for realtime events)

Workers (separate Node processes, same Docker image as backend):
  task-worker         → BullMQ consumer: order events → task records
  assignment-worker   → Interval timer: auto-assigns tasks to operators
  labor-metrics-worker → Cron: aggregates daily KPIs at 23:59
```

### Backend structure (`backend/src/`)

- **`app.js`** — Express middleware stack + route registration. Auth routes (`/api/auth`) are public; all other `/api/*` routes go through `requireAuth` middleware.
- **`index.js`** — Creates HTTP server, initializes Socket.IO, connects to PostgreSQL, starts BullMQ queue.
- **`db.js`** — PostgreSQL connection pool. All database access uses `query(sql, params)` with parameterized queries.
- **`routes/`** — Express routers. Each file exports a router mounted in `app.js`.
- **`services/`** — Business logic. Services use `query()` from `db.js` directly (no ORM). Errors use `error.statusCode` pattern caught by `errorHandler` middleware.
- **`middlewares/requireAuth.js`** — Extracts `Authorization: Bearer` token, verifies JWT, sets `req.user = { userId, username, role, operatorId }`.
- **`realtime/`** — Socket.IO server with JWT auth middleware. Events published to Redis pub/sub channel, then broadcast to rooms (`manager`, `operator:<id>`).
- **`workers/`** — Standalone processes. Each connects independently to DB/Redis.

### Frontend structure (`frontend/src/`)

- React 18 + Tailwind CSS. No routing library — view switching via `useState` in `App.jsx`.
- Built with **esbuild** (bundler) + **postcss** (Tailwind). Build script: `frontend/scripts/build.mjs`.
- `App.jsx` gates all views behind login. Passes `jwtToken` and `user` as props to child components.
- Three views: `ManagerLaborDashboard`, `OperatorTaskScreen`, `InventoryDashboard`. Views are filtered by user role.
- API calls use native `fetch` with `Authorization: Bearer` header. No axios.
- Real-time via `socket.io-client`. Events: `TASK_ASSIGNED`, `TASK_UPDATED`, `OPERATOR_STATUS_UPDATED`.
- Tailwind custom theme colors: `canvas` (bg), `ink` (text), `accent` (teal/primary), `signal` (orange/error).

### Database (`database/init/`)

SQL files run alphabetically on first PostgreSQL init. Existing DB requires manual migration.

- `001_schema.sql` — Core tables (warehouses, locations, products, inventory, movements, operators, zones, tasks, task_lines, labor_daily_metrics, audit logs) + seed data + `set_updated_at_timestamp()` trigger function.
- `002_users.sql` — `user_role` enum + `users` table with bcrypt passwords.

### Authentication

- **User roles**: `admin`, `warehouse_manager`, `supervisor`, `operator`, `viewer`
- JWT payload: `{ userId, username, role, operatorId }`, 8h expiry
- HTTP: `requireAuth` middleware on all `/api/*` except `/api/health` and `/api/auth/*`
- Socket.IO: `socketAuthMiddleware` — managers (admin/warehouse_manager/supervisor) join `manager` room; operators join `operator:<operatorId>` room
- Frontend stores token in localStorage (`wms.auth.token`, `wms.auth.user`)

## Key Patterns

- **Error handling**: Throw errors with `error.statusCode` property. The global `errorHandler` middleware returns `{ error: message }` JSON.
- **Optimistic locking**: Tasks have a `version` field. Status transitions require the current version and increment it (prevents concurrent update conflicts).
- **Realtime event flow**: Service → `publishRealtimeEvent()` → Redis channel → Socket.IO server → broadcast to room → frontend React state update.
- **Task lifecycle**: `created → assigned → in_progress → completed/cancelled/failed`, with `paused` as a valid intermediate state from `in_progress`.

## Environment Variables

Key variables (see `.env.example` for full list):
- `APP_PORT` — Frontend Nginx port (default 8080)
- `JWT_SECRET` — Shared secret for JWT signing
- `TASK_ASSIGNMENT_INTERVAL_MS` — How often the assignment worker runs (default 10000ms)
- `APP_API_URL` — Injected at frontend build time as `__API_BASE_URL__` (empty = same-origin)
