# WMS As A Service

Containerized WMS production stack with:

- `frontend`: React + Tailwind built as static assets and served by Nginx
- `backend`: Node.js + Express REST API
- `db`: PostgreSQL 16
- `redis`: background queue broker
- `task-worker`: Node.js worker that generates tasks from order events
- `assignment-worker`: Node.js worker that auto-assigns created tasks
- `docker-compose`: one-command local/prod startup (same file)

## Project Structure

```txt
.
|-- backend/              # Express API
|-- frontend/             # React + Tailwind UI + Nginx config
|-- database/init/        # PostgreSQL bootstrap SQL
|-- docker-compose.yml
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

3. Open the apps:

- Frontend + API entrypoint: `http://localhost:8080` (or `APP_PORT`)
- Health endpoint through Nginx: `http://localhost:8080/api/health`

## Available API Endpoints

- `GET /api/health`
- `GET /api/summary`
- `GET /api/warehouses`
- `GET /api/locations`
- `GET /api/products`
- `GET /api/inventory`
- `GET /api/movements?limit=20`
- `POST /api/movements`
- `GET /api/operators?page=1&limit=50`
- `GET /api/operators/:operatorId`
- `PATCH /api/operators/:operatorId/status`
- `GET /api/tasks?status=&zone=&operator_id=&page=1&limit=50`
- `GET /api/tasks/:taskId`
- `POST /api/tasks/:taskId/start`
- `POST /api/tasks/:taskId/complete`
- `POST /api/tasks/:taskId/pause`
- `POST /api/tasks/:taskId/cancel`
- `PATCH /api/tasks/:taskId/status`
- `GET /api/labor/overview?date=YYYY-MM-DD`
- `GET /api/labor/operator-performance?date=YYYY-MM-DD&page=1&limit=50`
- `GET /api/labor/zone-workload?warehouse_id=&page=1&limit=50`
- `POST /api/order-events`

Example task status update payload:

```json
{
  "status": "in_progress",
  "version": 2,
  "changedByOperatorId": "11111111-1111-4111-8111-111111111111"
}
```

Example movement payload:

```json
{
  "productId": 1,
  "fromLocationId": 1,
  "toLocationId": 2,
  "quantity": 5,
  "reference": "PO-42021"
}
```

Example order event payloads:

```json
{
  "type": "sales_order_ready_for_pick",
  "salesOrderId": "SO-10045",
  "shipDate": "2026-03-01T08:00:00.000Z",
  "lines": [
    { "skuId": 1, "quantity": 3, "pickLocationId": 11 },
    { "skuId": 2, "quantity": 1, "pickLocationId": 12 }
  ]
}
```

```json
{
  "type": "purchase_order_received",
  "purchaseOrderId": "PO-8041",
  "receivedAt": "2026-02-25T09:15:00.000Z",
  "lines": [
    { "skuId": 3, "quantity": 8, "destinationLocationId": 21 },
    { "skuId": 1, "quantity": 4, "destinationLocationId": 22 }
  ]
}
```

## Notes

- Database schema and sample data are loaded from `database/init/001_schema.sql` on first DB boot.
- Order events are enqueued in Redis and processed asynchronously by `task-worker`.
- Task generation resolves zones from `location_zones` mappings; missing mappings reject the job.
- Task auto-assignment runs every `TASK_ASSIGNMENT_INTERVAL_MS` (default `10000`) using:
  - task priority (`highest first`)
  - zone matching (`operator_zones`)
  - available operators only
  - lowest workload first (`labor_daily_metrics.tasks_completed`)
  - one active task max per operator
- This compose is production-oriented: no source bind mounts, no dev servers, frontend served by Nginx.
- If you want to reset seeded data, remove the compose volumes and restart:

```bash
docker compose down -v
docker compose up --build
```
