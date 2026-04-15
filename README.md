# WMS As A Service

Containerized WMS production stack with:

- `frontend`: React + Tailwind built as static assets and served by Nginx
- `backend`: Node.js + Express REST API
- `db`: PostgreSQL 16
- `redis`: background queue broker (BullMQ + pub/sub)
- `task-worker`: Node.js worker that generates tasks from order events
- `assignment-worker`: Node.js worker that auto-assigns created tasks
- `labor-metrics-worker`: Node.js worker that aggregates daily labor KPIs at 23:59
- `integration-worker`: Node.js worker that dispatches outbound webhook events
- `caddy`: Reverse proxy + TLS termination
- `docker-compose`: one-command local/prod startup (same file)

## Project Structure

```txt
.
|-- backend/              # Express API + workers
|-- frontend/             # React + Tailwind UI + Nginx config
|-- marketing-site/       # Next.js marketing website
|-- database/init/        # PostgreSQL bootstrap SQL
|-- docker-compose.yml
|-- Caddyfile             # Caddy reverse proxy config
`-- .env.example
```

## Quick Start

1. Create your environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Build and run everything:

```bash
docker compose up --build
```

3. Open the app:

- Frontend: `http://localhost:8080` (or `APP_PORT`)
- Health check: `http://localhost:8080/api/health`

4. Seed the default admin user (first time):

```bash
docker compose exec backend npm run seed:users
# Creates admin / admin123
```

## Available API Endpoints

All endpoints except `/api/health`, `/api/auth/*`, and `/api/webhook/*` require `Authorization: Bearer <token>`.

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

### Core
- `GET /api/health`
- `GET /api/summary`

### Warehouses
- `GET /api/warehouses`
- `GET /api/warehouses/:id`
- `POST /api/warehouses` _(admin)_
- `PUT /api/warehouses/:id` _(admin)_

### Zones
- `GET /api/zones`
- `GET /api/zones/:id`
- `POST /api/zones`
- `PUT /api/zones/:id`

### Locations
- `GET /api/locations`
- `GET /api/locations/:id`
- `POST /api/locations`
- `PUT /api/locations/:id`

### SKUs
- `GET /api/skus`
- `GET /api/skus/:id`
- `POST /api/skus`
- `PUT /api/skus/:id`

### Inventory
- `GET /api/inventory`
- `GET /api/movements?limit=20`
- `POST /api/movements`

### Operators
- `GET /api/operators?page=1&limit=50`
- `GET /api/operators/:operatorId`
- `PATCH /api/operators/:operatorId/status`

### Tasks
- `GET /api/tasks?status=&zone_id=&operator_id=&page=1&limit=50`
- `GET /api/tasks/:taskId`
- `POST /api/tasks/:taskId/start`
- `POST /api/tasks/:taskId/complete`
- `POST /api/tasks/:taskId/pause`
- `POST /api/tasks/:taskId/cancel`
- `POST /api/tasks/:taskId/assign`
- `PATCH /api/tasks/:taskId/status`

### Labor
- `GET /api/labor/overview?date=YYYY-MM-DD`
- `GET /api/labor/operator-performance?date=YYYY-MM-DD&page=1&limit=50`
- `GET /api/labor/zone-workload?warehouse_id=&page=1&limit=50`

### Sales Orders
- `POST /api/sales-orders` — create a sales order directly; resolves pick locations from inventory
- `GET /api/sales-orders?status=&page=1&limit=50`
- `GET /api/sales-orders/alerts?page=1&limit=50`
- `GET /api/sales-orders/:salesOrderId`
- `POST /api/sales-orders/reevaluate` — re-evaluate all `pending_inventory` orders after a stock change
- `DELETE /api/sales-orders/:salesOrderId` — cancel (`pending_inventory` or `ready` only)

### Purchase Orders
- `GET /api/purchase-orders?status=&page=1&limit=50`
- `GET /api/purchase-orders/:purchaseOrderId`
- `DELETE /api/purchase-orders/:purchaseOrderId` — cancel (`received` status only)

> Purchase orders are **created** via `POST /api/order-events` (see Order Events below), which resolves putaway locations and generates putaway tasks atomically.

### Order Events
- `POST /api/order-events` — enqueue a sales order or purchase order event for async task generation

### Users
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users` _(admin/warehouse_manager/supervisor)_
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Integrations
- `GET /api/integrations`
- `GET /api/integrations/connector-types`
- `GET /api/integrations/:id`
- `POST /api/integrations` _(admin)_
- `PUT /api/integrations/:id`
- `PATCH /api/integrations/:id/toggle`
- `POST /api/integrations/:id/test`
- `DELETE /api/integrations/:id` _(admin)_
- `GET /api/integrations/:id/events`

### Webhook (inbound)
- `POST /api/webhook/:connectorType` _(requires inbound API key)_

## WebSocket (Socket.IO)

- Transport: same host/port as backend (`/socket.io`)
- Authentication: JWT required (`auth.token`, `Authorization: Bearer ...`, or `query.token`)
- Rooms:
  - `manager` — admin/warehouse_manager/supervisor
  - `operator:<operatorId>` — specific operator
- Event types:
  - `TASK_ASSIGNED`
  - `TASK_UPDATED`
  - `OPERATOR_STATUS_UPDATED`
  - `SALES_ORDER_UPDATED`
  - `INVENTORY_ALERT`
  - `INVENTORY_UPDATED`
  - `USER_PRESENCE_UPDATED`
  - `USER_LIST_UPDATED`

Example task status update payload:

```json
{
  "status": "in_progress",
  "version": 2,
  "changedByOperatorId": "11111111-1111-4111-8111-111111111111"
}
```

## Order Payloads

### Create a sales order — `POST /api/sales-orders`

The WMS resolves pick locations from inventory — do not pass `pickLocationId`. Priority is derived automatically from `shipDate`.

```json
{
  "salesOrderId": "SO-10045",
  "shipDate": "2026-03-01T08:00:00.000Z",
  "lines": [
    { "skuId": 1, "quantity": 3 },
    { "skuId": 2, "quantity": 1 }
  ]
}
```

If all lines can be fulfilled from stock, the order is immediately released and a pick task is created. If any line is short, the order is held as `pending_inventory` and an `INVENTORY_ALERT` realtime event is published. Call `POST /api/sales-orders/reevaluate` after restocking to retry pending orders.

The same payload can also be sent to `POST /api/order-events` with `"type": "sales_order_ready_for_pick"` to go through the async queue instead.

### Create a purchase order — `POST /api/order-events`

Purchase orders are always created via the event queue (async). The event resolves putaway locations, generates putaway tasks, and persists the order record in one transaction.

```json
{
  "type": "purchase_order_received",
  "purchaseOrderId": "PO-8041",
  "strategy": "CONSOLIDATION",
  "receivedAt": "2026-02-25T09:15:00.000Z",
  "lines": [
    { "skuId": 3, "quantity": 8 },
    { "skuId": 1, "quantity": 4 }
  ]
}
```

Putaway strategies: `RANDOM` (any location with stock), `CONSOLIDATION` (same SKU preferred), `EMPTY` (empty locations preferred). All strategies fall back to any available location with sufficient capacity.

### Purchase order statuses

| Status | Meaning |
|---|---|
| `received` | Event accepted, not yet processed by the worker |
| `in_progress` | Putaway tasks created, operators working |
| `completed` | All putaway tasks completed |
| `cancelled` | Cancelled before processing (only from `received`) |

## Notes

- Database schema is loaded from `database/init/001_schema.sql` on first DB boot.
- Order events are enqueued in Redis and processed asynchronously by `task-worker`. Events are deduplicated by `event_key`.
- Sales orders are persisted in the `sales_orders` / `sales_order_lines` tables and queryable via `GET /api/sales-orders`. Orders with insufficient stock are held as `pending_inventory` with `INVENTORY_ALERT` events. When inventory is replenished, pending orders are automatically re-evaluated.
- Purchase orders are persisted in the `purchase_orders` / `purchase_order_lines` tables when processed by `task-worker` and queryable via `GET /api/purchase-orders`. Lines include the resolved `destinationLocationId` after putaway resolution.
- The left sidebar switches between views (`Dashboard`, `Labor`, `Inventory`, `Configuration`, `Users`, `Integrations`). Operators bypass the sidebar entirely and get a full-screen task interface.
- The operator view is exclusive to the `operator` role (mobile-first, sidebar-less, socket-only refresh).
- Task auto-assignment runs every `TASK_ASSIGNMENT_INTERVAL_MS` (default `10000ms`) using priority, zone matching, and lowest workload first.
- Daily labor metrics aggregate at 23:59 (idempotent upsert): `tasks_completed`, `avg_task_time`, `units_processed`, `utilization_percent` (capped at 100%).
- Outbound integration events (`task.completed`, `order.fulfilled`, `inventory.updated`, etc.) are dispatched by `integration-worker` with retry logic via BullMQ.
- This compose is production-oriented: no source bind mounts, no dev servers.

To reset all data:

```bash
docker compose down -v
docker compose up --build
```
