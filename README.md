# WMS As A Service

Containerized WMS starter stack with:

- `frontend`: React + Tailwind (Vite)
- `backend`: Node.js + Express REST API
- `db`: PostgreSQL 16
- `docker-compose`: one-command local startup

## Project Structure

```txt
.
|-- backend/              # Express API
|-- frontend/             # React + Tailwind UI
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

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- Health endpoint: `http://localhost:3000/api/health`

## Available API Endpoints

- `GET /api/health`
- `GET /api/summary`
- `GET /api/warehouses`
- `GET /api/locations`
- `GET /api/products`
- `GET /api/inventory`
- `GET /api/movements?limit=20`
- `POST /api/movements`

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

## Notes

- Database schema and sample data are loaded from `database/init/001_schema.sql` on first DB boot.
- If you want to reset seeded data, remove the compose volumes and restart:

```bash
docker compose down -v
docker compose up --build
```
