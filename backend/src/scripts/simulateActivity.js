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
 */

const SIM_API_BASE_URL = process.env.SIM_API_BASE_URL || "http://backend:3000";
const SIM_ORDER_INTERVAL_MS = Number(process.env.SIM_ORDER_INTERVAL_MS) || 20000;
const SIM_TASK_INTERVAL_MS = Number(process.env.SIM_TASK_INTERVAL_MS) || 8000;
const SIM_STATUS_INTERVAL_MS = Number(process.env.SIM_STATUS_INTERVAL_MS) || 30000;

// ── Data pools for generating realistic payloads ──────────────

const PICK_LOCATIONS = {
  "Paris Pick Zone":  ["PAR-RACK-A1", "PAR-RACK-A2", "PAR-RACK-A3", "PAR-RACK-B1", "PAR-RACK-B2"],
  "Lille Pick Zone":  ["LIL-RACK-A1", "LIL-RACK-A2", "LIL-RACK-B1"],
  "Lyon Pick Zone":   ["LYN-RACK-A1", "LYN-RACK-B1"]
};

const PUTAWAY_DESTINATIONS = {
  "Paris":  ["PAR-RACK-A1", "PAR-RACK-A2", "PAR-RACK-B1", "PAR-BULK-01", "PAR-BULK-02"],
  "Lille":  ["LIL-RACK-A1", "LIL-RACK-A2", "LIL-BULK-01"],
  "Lyon":   ["LYN-RACK-A1", "LYN-RACK-B1", "LYN-BULK-01"]
};

const PRODUCT_SKUS = [
  "SKU-1001", "SKU-1002", "SKU-1003", "SKU-1004", "SKU-1005",
  "SKU-2001", "SKU-2002", "SKU-2003", "SKU-2004", "SKU-2005",
  "SKU-2006", "SKU-2007", "SKU-3001", "SKU-3002", "SKU-3003",
  "SKU-3004", "SKU-3005", "SKU-4001", "SKU-4002"
];

const OPERATOR_IDS = [
  "a0000000-0000-0000-0000-000000000001",
  "a0000000-0000-0000-0000-000000000002",
  "a0000000-0000-0000-0000-000000000003",
  "a0000000-0000-0000-0000-000000000004",
  "a0000000-0000-0000-0000-000000000005",
  "a0000000-0000-0000-0000-000000000006",
  "a0000000-0000-0000-0000-000000000007",
  "a0000000-0000-0000-0000-000000000008",
  "a0000000-0000-0000-0000-000000000009",
  "a0000000-0000-0000-0000-000000000010"
];

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

// ── Cycle 1: ERP/OMS Order Release ───────────────────────────

function generateOrderId(prefix) {
  orderCounter++;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `${prefix}-${dateStr}-SIM${String(orderCounter).padStart(4, "0")}`;
}

function buildSalesOrderEvent() {
  const orderId = generateOrderId("SO");
  const zones = Object.keys(PICK_LOCATIONS);
  const zone = pick(zones);
  const locationPool = PICK_LOCATIONS[zone];
  const numLines = randInt(1, 4);
  const lines = [];

  for (let i = 0; i < numLines; i++) {
    lines.push({
      skuId: pick(PRODUCT_SKUS),
      quantity: randInt(1, 25),
      pickLocationId: pick(locationPool)
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
  const warehouseKeys = Object.keys(PUTAWAY_DESTINATIONS);
  const warehouse = pick(warehouseKeys);
  const destPool = PUTAWAY_DESTINATIONS[warehouse];
  const numLines = randInt(1, 3);
  const lines = [];

  for (let i = 0; i < numLines; i++) {
    lines.push({
      skuId: pick(PRODUCT_SKUS),
      quantity: randInt(5, 30),
      destinationLocationId: pick(destPool)
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
    // Find actionable tasks
    const actionableStatuses = ["assigned", "in_progress", "paused"];
    const statusParam = actionableStatuses.join(",");

    // Fetch tasks in actionable states
    let tasks = [];
    for (const status of actionableStatuses) {
      const result = await apiFetch(`/api/tasks?status=${status}&page=1&limit=50`);
      if (result && result.data) {
        tasks = tasks.concat(result.data);
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
        // Start the task
        console.log(`[sim:tasks] Starting task ${taskId.substring(0, 8)}... (v${version})`);
        await apiFetch(`/api/tasks/${taskId}/start`, {
          method: "POST",
          body: JSON.stringify({ version, changedByOperatorId: operatorId })
        });
        console.log(`[sim:tasks] ✓ Task started`);

      } else if (task.status === "in_progress") {
        // 80% complete, 20% pause
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
        // Resume the task
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
    const operatorId = pick(OPERATOR_IDS);

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

  // Wait a bit for backend to be fully ready
  console.log("[sim] Waiting 5s for backend to stabilize...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Authenticate
  await authenticate();

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
  // Give in-flight requests a moment to finish
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
