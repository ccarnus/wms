/**
 * Warehouse Activity Simulator
 *
 * Long-running process that simulates realistic warehouse activity:
 *   - ERP/OMS releasing new orders (sales + purchase orders)
 *   - Operators executing tasks (start, complete, pause)
 *   - Operator status changes (available/busy/offline)
 *
 * Requires SEED_TEST_DATA=true to run.
 * Connects to the backend API via SIM_API_BASE_URL.
 * Fetches all product/location/operator IDs from the API at startup.
 */

const SIM_API_BASE_URL = process.env.SIM_API_BASE_URL || "http://backend:3000";
const SIM_ORDER_INTERVAL_MS = Number(process.env.SIM_ORDER_INTERVAL_MS) || 20000;
const SIM_TASK_INTERVAL_MS = Number(process.env.SIM_TASK_INTERVAL_MS) || 8000;
const SIM_STATUS_INTERVAL_MS = Number(process.env.SIM_STATUS_INTERVAL_MS) || 30000;

// ── Dynamic data pools (populated at startup from API) ────────

let productIds = [];       // integer IDs from products table
let locationIds = [];      // integer IDs from locations table
let pickLocationIds = [];  // location IDs for pick zones (rack locations)
let putawayLocationIds = [];  // location IDs for putaway destinations
let operatorIds = [];      // UUID strings from operators table

// ── Helpers ───────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const jitter = (base) => Math.round(base * (0.5 + Math.random()));

let jwtToken = null;
let orderCounter = 0;
let running = true;

async function apiFetch(path, options = {}) {
  const url = `${SIM_API_BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (jwtToken) headers["Authorization"] = `Bearer ${jwtToken}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    console.log("[sim] Token expired, re-authenticating...");
    await authenticate();
    headers["Authorization"] = `Bearer ${jwtToken}`;
    const retry = await fetch(url, { ...options, headers });
    if (!retry.ok) {
      const text = await retry.text().catch(() => "");
      throw new Error(`API ${options.method || "GET"} ${path} failed (${retry.status}): ${text}`);
    }
    return retry.json().catch(() => null);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API ${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }

  return response.json().catch(() => null);
}

async function authenticate() {
  console.log("[sim] Authenticating as admin...");
  const url = `${SIM_API_BASE_URL}/api/auth/login`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });

  if (!response.ok) {
    throw new Error(`Authentication failed (${response.status}). Make sure admin user is seeded.`);
  }

  const data = await response.json();
  jwtToken = data.token;
  console.log("[sim] Authenticated successfully.");
}

async function loadReferenceData() {
  console.log("[sim] Loading reference data from API...");

  // Fetch products — we need their integer IDs
  const products = await apiFetch("/api/products");
  productIds = products.map((p) => p.id);
  console.log(`[sim]   ✓ ${productIds.length} products loaded`);

  // Fetch locations — we need their integer IDs
  const locations = await apiFetch("/api/locations");
  locationIds = locations.map((l) => l.id);

  // Rack locations are good for pick sources
  pickLocationIds = locations
    .filter((l) => l.code.includes("RACK"))
    .map((l) => l.id);

  // Rack + Bulk locations are good putaway destinations
  putawayLocationIds = locations
    .filter((l) => l.code.includes("RACK") || l.code.includes("BULK"))
    .map((l) => l.id);

  console.log(`[sim]   ✓ ${locationIds.length} locations loaded (${pickLocationIds.length} pick, ${putawayLocationIds.length} putaway)`);

  // Fetch operators — we need their UUID IDs
  const operatorsResult = await apiFetch("/api/operators?limit=200");
  operatorIds = (operatorsResult.items || []).map((o) => o.id);
  console.log(`[sim]   ✓ ${operatorIds.length} operators loaded`);

  if (productIds.length === 0 || locationIds.length === 0 || operatorIds.length === 0) {
    throw new Error("Reference data is incomplete. Make sure seed data has been loaded.");
  }
}

// ── Cycle 1: ERP/OMS Order Release ───────────────────────────

function generateOrderId(prefix) {
  orderCounter++;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `${prefix}-${dateStr}-SIM${String(orderCounter).padStart(4, "0")}`;
}

function buildSalesOrderEvent() {
  const orderId = generateOrderId("SO");
  const numLines = randInt(1, 4);
  const lines = [];

  for (let i = 0; i < numLines; i++) {
    lines.push({
      skuId: pick(productIds),
      quantity: randInt(1, 25),
      pickLocationId: pick(pickLocationIds)
    });
  }

  const shipDate = new Date();
  shipDate.setDate(shipDate.getDate() + randInt(0, 5));

  return {
    type: "sales_order_ready_for_pick",
    salesOrderId: orderId,
    shipDate: shipDate.toISOString().split("T")[0],
    lines
  };
}

function buildPurchaseOrderEvent() {
  const orderId = generateOrderId("PO");
  const numLines = randInt(1, 3);
  const lines = [];

  for (let i = 0; i < numLines; i++) {
    lines.push({
      skuId: pick(productIds),
      quantity: randInt(5, 30),
      destinationLocationId: pick(putawayLocationIds)
    });
  }

  return {
    type: "purchase_order_received",
    purchaseOrderId: orderId,
    lines
  };
}

async function cycleOrderRelease() {
  if (!running) return;
  try {
    // 60% sales orders, 40% purchase orders
    const event = Math.random() < 0.6 ? buildSalesOrderEvent() : buildPurchaseOrderEvent();
    const docId = event.salesOrderId || event.purchaseOrderId;
    console.log(`[sim:orders] Releasing ${event.type} → ${docId} (${event.lines.length} lines)`);

    await apiFetch("/api/order-events", {
      method: "POST",
      body: JSON.stringify(event)
    });
    console.log(`[sim:orders] ✓ ${docId} accepted`);
  } catch (err) {
    console.error(`[sim:orders] Error: ${err.message}`);
  }

  if (running) {
    setTimeout(cycleOrderRelease, jitter(SIM_ORDER_INTERVAL_MS));
  }
}

// ── Cycle 2: Operator Task Execution ─────────────────────────

async function cycleTaskExecution() {
  if (!running) return;
  try {
    // Fetch tasks in actionable states
    let tasks = [];
    for (const status of ["assigned", "in_progress", "paused"]) {
      const result = await apiFetch(`/api/tasks?status=${status}&page=1&limit=50`);
      if (result && result.items) {
        tasks = tasks.concat(result.items);
      }
    }

    if (tasks.length === 0) {
      console.log("[sim:tasks] No actionable tasks found, waiting...");
    } else {
      const task = pick(tasks);
      const taskId = task.id;
      const version = task.version;
      const operatorId = task.assignedOperatorId || task.assigned_operator_id;

      if (task.status === "assigned") {
        console.log(`[sim:tasks] Starting task ${taskId.substring(0, 8)}... (v${version})`);
        await apiFetch(`/api/tasks/${taskId}/start`, {
          method: "POST",
          body: JSON.stringify({ version, changedByOperatorId: operatorId })
        });
        console.log(`[sim:tasks] ✓ Task started`);

      } else if (task.status === "in_progress") {
        if (Math.random() < 0.8) {
          console.log(`[sim:tasks] Completing task ${taskId.substring(0, 8)}... (v${version})`);
          await apiFetch(`/api/tasks/${taskId}/complete`, {
            method: "POST",
            body: JSON.stringify({ version, changedByOperatorId: operatorId })
          });
          console.log(`[sim:tasks] ✓ Task completed`);
        } else {
          console.log(`[sim:tasks] Pausing task ${taskId.substring(0, 8)}... (v${version})`);
          await apiFetch(`/api/tasks/${taskId}/pause`, {
            method: "POST",
            body: JSON.stringify({ version, changedByOperatorId: operatorId })
          });
          console.log(`[sim:tasks] ✓ Task paused`);
        }

      } else if (task.status === "paused") {
        console.log(`[sim:tasks] Resuming task ${taskId.substring(0, 8)}... (v${version})`);
        await apiFetch(`/api/tasks/${taskId}/start`, {
          method: "POST",
          body: JSON.stringify({ version, changedByOperatorId: operatorId })
        });
        console.log(`[sim:tasks] ✓ Task resumed`);
      }
    }
  } catch (err) {
    console.error(`[sim:tasks] Error: ${err.message}`);
  }

  if (running) {
    setTimeout(cycleTaskExecution, jitter(SIM_TASK_INTERVAL_MS));
  }
}

// ── Cycle 3: Operator Status Changes ─────────────────────────

async function cycleOperatorStatus() {
  if (!running) return;
  try {
    const operatorId = pick(operatorIds);

    // Weighted status transitions: mostly available↔busy, occasional offline
    const rand = Math.random();
    let newStatus;
    if (rand < 0.45) {
      newStatus = "available";
    } else if (rand < 0.85) {
      newStatus = "busy";
    } else {
      newStatus = "offline";
    }

    console.log(`[sim:status] Setting operator ${operatorId.substring(0, 8)}... → ${newStatus}`);
    await apiFetch(`/api/operators/${operatorId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus })
    });
    console.log(`[sim:status] ✓ Operator status updated`);
  } catch (err) {
    console.error(`[sim:status] Error: ${err.message}`);
  }

  if (running) {
    setTimeout(cycleOperatorStatus, jitter(SIM_STATUS_INTERVAL_MS));
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  if (process.env.SEED_TEST_DATA !== "true") {
    console.log("[sim] SEED_TEST_DATA is not 'true', exiting.");
    process.exit(0);
  }

  console.log("[sim] Warehouse Activity Simulator starting...");
  console.log(`[sim] API: ${SIM_API_BASE_URL}`);
  console.log(`[sim] Intervals — orders: ${SIM_ORDER_INTERVAL_MS}ms, tasks: ${SIM_TASK_INTERVAL_MS}ms, status: ${SIM_STATUS_INTERVAL_MS}ms`);

  // Wait for backend to be fully ready (seed data must be loaded)
  console.log("[sim] Waiting 10s for backend to stabilize and seed data...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Authenticate
  await authenticate();

  // Load reference data (product IDs, location IDs, operator IDs)
  await loadReferenceData();

  // Start all cycles with initial jitter to avoid thundering herd
  setTimeout(cycleOrderRelease, jitter(3000));
  setTimeout(cycleTaskExecution, jitter(5000));
  setTimeout(cycleOperatorStatus, jitter(8000));

  console.log("[sim] All cycles started. Running indefinitely...");
}

// ── Graceful shutdown ─────────────────────────────────────────

function shutdown(signal) {
  console.log(`[sim] Received ${signal}, shutting down gracefully...`);
  running = false;
  setTimeout(() => {
    console.log("[sim] Goodbye.");
    process.exit(0);
  }, 2000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => {
  console.error("[sim] Fatal error:", err);
  process.exit(1);
});
