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
# Runs: test/pickTaskGeneration.test.js && test/putawayTaskGeneration.test.js && test/laborMetricsAggregationService.test.js && test/configValidation.test.js
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
Browser → Caddy (:80/:443) → Nginx (:8080) → /api/*        → Express backend (:3000)
                                            → /socket.io/*  → Socket.IO on same backend
                                            → /*            → Static React bundle

Backend → PostgreSQL 16 (pg pool, raw SQL, no ORM)
       → Redis 7 (BullMQ queues + pub/sub for realtime events)

Workers (separate Node processes, same Docker image as backend):
  task-worker         → BullMQ consumer: order events → task records
  assignment-worker   → Interval timer: auto-assigns tasks to operators
  labor-metrics-worker → Cron: aggregates daily KPIs at 23:59
  integration-worker  → BullMQ consumer: dispatches outbound webhook events
```

### Backend structure (`backend/src/`)

- **`app.js`** — Express middleware stack + route registration. Auth routes (`/api/auth`) and webhook routes (`/api/webhook`) are public; all other `/api/*` routes go through `requireAuth` middleware.
- **`index.js`** — Creates HTTP server, initializes Socket.IO, connects to PostgreSQL, starts BullMQ queue.
- **`db.js`** — PostgreSQL connection pool. All database access uses `query(sql, params)` with parameterized queries.
- **`routes/`** — Express routers. Each file exports a router mounted in `app.js`. Includes: auth, tasks, operators, labor, users, sales-orders, order-events, integrations, warehouses, zones, locations, skus, wms (inventory/movements/summary), health.
- **`services/`** — Business logic. Services use `query()` from `db.js` directly (no ORM). Errors use `error.statusCode` pattern caught by `errorHandler` middleware. `configValidationService.js` holds the pure (DB-free) validation/normalization logic for the configuration routes, including bulk location code generation and SKU import row validation.
- **`middlewares/requireAuth.js`** — Extracts `Authorization: Bearer` token, verifies JWT, sets `req.user = { userId, username, role, operatorId }`.
- **`middlewares/requireRole.js`** — Role-based access control middleware.
- **`realtime/`** — Socket.IO server with JWT auth middleware. Events published to Redis pub/sub channel, then broadcast to rooms (`manager`, `operator:<id>`).
- **`workers/`** — Standalone processes. Each connects independently to DB/Redis.
- **`integrations/`** — Connector registry and connector implementations (generic-webhook with full auth support).
- **`queue/`** — BullMQ queue configuration and job definitions.
- **`models/`** — Data models (taskModel.js).
- **`scripts/`** — Seed utilities (seed:users, seed:testdata).

### Frontend structure (`frontend/src/`)

- React 18 + Tailwind CSS. No routing library — view switching via `useState` in `App.jsx`.
- Built with **esbuild** (bundler) + **postcss** (Tailwind). Build script: `frontend/scripts/build.mjs`.
- **`lib/api.js`** — shared `fetchJson` / `buildApiUrl` / `getSocketBaseUrl` / `toQueryString` helpers. All screens use these instead of duplicating fetch logic.
- **`components/ui.jsx`** — shared UI kit used by every screen: `DataTable` (click-to-sort headers with asc/desc/clear cycle, optional built-in pagination, loading skeletons, empty states), `SearchInput`, `FilterSelect`, `ClearFiltersButton`, `Badge` (tone-based), `StatCard`, `Section`, `PageHeader`, `Modal` (Escape/backdrop close), `ErrorBanner`/`SuccessBanner`, and button class constants. New tables should be built with `DataTable`, not hand-rolled `<table>` markup.
- `App.jsx` gates all views behind login. Passes `jwtToken` and `user` as props to child components.
- Tables across all screens support client-side search, field filters, and column sorting; lists are paginated via `DataTable`'s `pageSize`.
- Views: `DashboardScreen`, `ManagerLaborDashboard`, `OperatorTaskScreen`, `InventoryDashboard`, `ConfigurationScreen`, `UserManagementScreen`, `IntegrationsScreen`, `ChangePasswordScreen`. Views are filtered by user role.
- **Operator role** gets a dedicated mobile-first layout (no sidebar). The operator view is exclusive to the `operator` role — other roles do not see it.
- `DashboardScreen` — live operations overview for managers/viewers: KPI cards (units on hand, SKUs, open tasks, completed today, open orders, alerts), inventory alert cards, and sortable/filterable Open Tasks + Sales Orders tables. Refreshes via websocket events.
- `OperatorTaskScreen` shows a task list (in_progress, paused, assigned) with tap-to-view detail, task-type filter chips, and priority-ordered groups. Tasks are not auto-started; the operator must explicitly click "Start Task". Auto-refresh is websocket-only (no polling or manual refresh button). Debug info (API URL, operator ID) is in a settings panel accessed via the user avatar.
- `ConfigurationScreen` — manages all master data: warehouses (site details, active flag), zones (typed, with description), locations (search/filters, capacity utilization bars, lock/unlock, bulk generation from a code pattern), and the SKU catalog (category, unit of measure, min/max stock thresholds with low-stock badges, active flag, client-side CSV import/export). Write actions are hidden unless the user role is `admin` or `warehouse_manager`.
- API calls use native `fetch` with `Authorization: Bearer` header. No axios.
- Real-time via `socket.io-client`. Events: `TASK_ASSIGNED`, `TASK_UPDATED`, `OPERATOR_STATUS_UPDATED`, `SALES_ORDER_UPDATED`, `INVENTORY_ALERT`, `INVENTORY_UPDATED`, `USER_PRESENCE_UPDATED`, `USER_LIST_UPDATED`.
- Tailwind custom theme colors: `canvas` (bg), `ink` (text), `accent` (teal/primary), `signal` (orange/error).

### Database (`database/init/`)

Single `001_schema.sql` file contains the complete schema: all enums, tables (warehouses, zones, locations, skus, inventory, movements, operators, tasks, task_lines, task_status_audit_logs, task_generation_events, sales_orders, sales_order_lines, inventory_alerts, users, integrations, integration_field_mappings, integration_event_log, labor_daily_metrics), indexes, trigger function, and triggers.

Key tables not obvious from names:
- **`task_generation_events`** — Deduplication cache keyed by `event_key` (UNIQUE). Prevents reprocessing the same order event.
- **`task_status_audit_logs`** — Full history of every task status transition with `task_version`.
- **`integration_event_log`** — Audit trail for all inbound/outbound integration events with response status.
- **`integration_field_mappings`** — Per-integration field translation rules.

### Authentication

- **User roles**: `admin`, `warehouse_manager`, `supervisor`, `operator`, `viewer`
- JWT payload: `{ userId, username, role, operatorId }`, 8h expiry
- HTTP: `requireAuth` middleware on all `/api/*` except `/api/health`, `/api/auth/*`, `/api/webhook/*`
- Socket.IO: `socketAuthMiddleware` — managers (admin/warehouse_manager/supervisor) join `manager` room; operators join `operator:<operatorId>` room
- Frontend stores token in localStorage (`wms.auth.token`, `wms.auth.user`)

### Integrations

- Single connector type: `generic-webhook` (one per system; enforced by UNIQUE constraint on `connector_type`)
- Direction: `inbound`, `outbound`, or `bidirectional`
- **Outbound auth types**: `none`, `header`, `basic`, `jwt` (HS256), `oauth2` (client credentials)
- **Outbound events published by services**: `task.created`, `task.assigned`, `task.completed`, `task.cancelled`, `inventory.updated`, `order.fulfilled`, `operator.status_changed`
- **Inbound events** (via `POST /api/webhook/:connectorType`): `inbound.order.created`, `inbound.order.cancelled`, `inbound.product.synced`
- `integration-worker` processes outbound events from BullMQ with retry logic and logs every attempt in `integration_event_log`
- Inbound API key is validated by the webhook endpoint before processing

## Key Patterns

- **Error handling**: Throw errors with `error.statusCode` property. The global `errorHandler` middleware returns `{ error: message }` JSON.
- **Configuration master data**: Warehouses carry site details (`address`, `city`, `country`) and an `is_active` flag; zones have a `description`; SKUs carry `unit_of_measure`, `category`, `min_stock_level`/`max_stock_level` (low-stock flag computed in queries as `totalQuantity < minStockLevel`), and `is_active`. Config write endpoints require `admin` or `warehouse_manager`. `POST /api/locations/bulk` generates location ranges (`ON CONFLICT DO NOTHING`, reports created/skipped); `POST /api/skus/import` bulk-upserts by SKU code (full-row replace).
- **Optimistic locking**: Tasks have a `version` field. Status transitions require the current version and increment it (prevents concurrent update conflicts).
- **Realtime event flow**: Service → `publishRealtimeEvent()` → Redis channel → Socket.IO server → broadcast to room → frontend React state update.
- **Task lifecycle**: `created → assigned → in_progress → completed/cancelled/failed`, with `paused` as a valid intermediate state from `in_progress`.
- **Sales order lifecycle**: `pending_inventory → ready → released → completed/cancelled`. External systems send sales orders without pick locations — the WMS resolves pick locations from inventory. Orders with insufficient stock are held as `pending_inventory` with inventory alerts. When inventory is replenished (INBOUND/TRANSFER movements), pending orders are automatically re-evaluated.
- **Pick location resolution**: For each sales order line, the WMS finds the best pick location (active location in a pick zone with sufficient stock, preferring highest quantity to consolidate picks). If no single location can fulfill a line, the order is held and an `INVENTORY_ALERT` realtime event + `SALES_ORDER_SHORT` integration event are published.
- **Putaway location resolution**: Purchase orders include a `strategy` field (`RANDOM`, `CONSOLIDATION`, `EMPTY`) that controls how the WMS assigns destination locations. `CONSOLIDATION` prefers locations already holding the same SKU, `RANDOM` picks any location with existing inventory, `EMPTY` targets locations with no stock. All strategies fall back to any available location with sufficient capacity. Only locations in bulk/staging zones are considered.
- **Event deduplication**: Order events carry an `event_key`. The `task_generation_events` table enforces UNIQUE on `event_key` — duplicate events are silently discarded by the worker.
- **Integration dispatch**: Services publish integration events to BullMQ. `integration-worker` picks them up, calls the matching connector, and records the result in `integration_event_log`. Failed jobs are retried by BullMQ.

## Environment Variables

Key variables (see `.env.example` for full list):
- `APP_PORT` — Frontend Nginx port (default 8080)
- `JWT_SECRET` — Shared secret for JWT signing
- `TASK_ASSIGNMENT_INTERVAL_MS` — How often the assignment worker runs (default 10000ms)
- `TASK_ASSIGNMENT_BATCH_SIZE` — Max tasks processed per assignment cycle (default 200)
- `TASK_PICK_BASE_TIME_SECONDS` — Base time estimate for pick tasks (default 90)
- `TASK_PICK_TIME_PER_UNIT_SECONDS` — Per-unit time increment for pick tasks (default 12)
- `TASK_PUTAWAY_BASE_TIME_SECONDS` — Base time estimate for putaway tasks (default 75)
- `TASK_PUTAWAY_TIME_PER_UNIT_SECONDS` — Per-unit time increment for putaway tasks (default 10)
- `TASK_PUTAWAY_PRIORITY` — Default priority for putaway tasks (default 60)
- `LABOR_METRICS_RUN_HOUR` — Hour to run daily aggregation (default 23)
- `LABOR_METRICS_RUN_MINUTE` — Minute to run daily aggregation (default 59)
- `SEED_TEST_DATA` — Auto-seed demo data on backend startup (default false)
- `CADDY_DOMAIN` — Domain for Caddy TLS (default localhost)
- `APP_API_URL` — Injected at frontend build time as `__API_BASE_URL__` (empty = same-origin)
