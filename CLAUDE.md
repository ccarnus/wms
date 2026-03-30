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
- Views: `DashboardScreen`, `ManagerLaborDashboard`, `OperatorTaskScreen`, `InventoryDashboard`, `UserManagementScreen`, `IntegrationsScreen`. Views are filtered by user role.
- **Operator role** gets a dedicated mobile-first layout (no sidebar). The operator view is exclusive to the `operator` role — other roles do not see it.
- `OperatorTaskScreen` shows a task list (in_progress, paused, assigned) with tap-to-view detail. Tasks are not auto-started; the operator must explicitly click "Start Task". Auto-refresh is websocket-only (no polling or manual refresh button). Debug info (API URL, operator ID) is in a settings panel accessed via the user avatar.
- API calls use native `fetch` with `Authorization: Bearer` header. No axios.
- Real-time via `socket.io-client`. Events: `TASK_ASSIGNED`, `TASK_UPDATED`, `OPERATOR_STATUS_UPDATED`, `SALES_ORDER_UPDATED`, `INVENTORY_ALERT`.
- Tailwind custom theme colors: `canvas` (bg), `ink` (text), `accent` (teal/primary), `signal` (orange/error).

### Database (`database/init/`)

Single `001_schema.sql` file contains the complete schema: all enums, tables (warehouses, zones, locations, skus, inventory, movements, operators, tasks, task_lines, sales_orders, sales_order_lines, inventory_alerts, users, integrations, labor_daily_metrics, audit logs), indexes, trigger function, and triggers.

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
- **Sales order lifecycle**: `pending_inventory → ready → released → completed/cancelled`. External systems send sales orders without pick locations — the WMS resolves pick locations from inventory. Orders with insufficient stock are held as `pending_inventory` with inventory alerts. When inventory is replenished (INBOUND/TRANSFER movements), pending orders are automatically re-evaluated.
- **Pick location resolution**: For each sales order line, the WMS finds the best pick location (active location in a pick zone with sufficient stock, preferring highest quantity to consolidate picks). If no single location can fulfill a line, the order is held and an `INVENTORY_ALERT` realtime event + `SALES_ORDER_SHORT` integration event are published.
- **Putaway location resolution**: Purchase orders include a `strategy` field (`RANDOM`, `CONSOLIDATION`, `EMPTY`) that controls how the WMS assigns destination locations. `CONSOLIDATION` prefers locations already holding the same SKU, `RANDOM` picks any location with existing inventory, `EMPTY` targets locations with no stock. All strategies fall back to any available location with sufficient capacity. Only locations in bulk/staging zones are considered.

## Environment Variables

Key variables (see `.env.example` for full list):
- `APP_PORT` — Frontend Nginx port (default 8080)
- `JWT_SECRET` — Shared secret for JWT signing
- `TASK_ASSIGNMENT_INTERVAL_MS` — How often the assignment worker runs (default 10000ms)
- `APP_API_URL` — Injected at frontend build time as `__API_BASE_URL__` (empty = same-origin)
