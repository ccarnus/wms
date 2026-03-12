/**
 * OMS Order Simulator
 *
 * Long-running process that simulates an OMS releasing orders:
 *   - Sales orders ready for pick
 *   - Purchase orders received
 *
 * Does NOT simulate operator activity — testing is done manually via the UI.
 *
 * Requires SEED_TEST_DATA=true to run.
 * Connects to the backend API via SIM_API_BASE_URL.
 */

const SIM_API_BASE_URL = process.env.SIM_API_BASE_URL || "http://backend:3000";
const SIM_ORDER_INTERVAL_MS = Number(process.env.SIM_ORDER_INTERVAL_MS) || 20000;

// ── Dynamic data pools (populated at startup from API) ────────

let productIds = [];
let pickLocationIds = [];
let putawayLocationIds = [];

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

  const products = await apiFetch("/api/products");
  productIds = products.map((p) => p.id);
  console.log(`[sim]   ${productIds.length} products loaded`);

  const locations = await apiFetch("/api/locations");
  pickLocationIds = locations
    .filter((l) => l.code.includes("RACK"))
    .map((l) => l.id);
  putawayLocationIds = locations
    .filter((l) => l.code.includes("RACK") || l.code.includes("BULK"))
    .map((l) => l.id);
  console.log(`[sim]   ${locations.length} locations loaded (${pickLocationIds.length} pick, ${putawayLocationIds.length} putaway)`);

  if (productIds.length === 0 || pickLocationIds.length === 0) {
    throw new Error("Reference data is incomplete. Make sure seed data has been loaded.");
  }
}

// ── OMS Order Release ─────────────────────────────────────────

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
    console.log(`[sim:orders] Releasing ${event.type} -> ${docId} (${event.lines.length} lines)`);

    await apiFetch("/api/order-events", {
      method: "POST",
      body: JSON.stringify(event)
    });
    console.log(`[sim:orders] ${docId} accepted`);
  } catch (err) {
    console.error(`[sim:orders] Error: ${err.message}`);
  }

  if (running) {
    setTimeout(cycleOrderRelease, jitter(SIM_ORDER_INTERVAL_MS));
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  if (process.env.SEED_TEST_DATA !== "true") {
    console.log("[sim] SEED_TEST_DATA is not 'true', exiting.");
    process.exit(0);
  }

  console.log("[sim] OMS Order Simulator starting...");
  console.log(`[sim] API: ${SIM_API_BASE_URL}`);
  console.log(`[sim] Order interval: ${SIM_ORDER_INTERVAL_MS}ms`);

  // Wait for backend to be fully ready
  console.log("[sim] Waiting 10s for backend to stabilize and seed data...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  await authenticate();
  await loadReferenceData();

  // Start order release cycle
  setTimeout(cycleOrderRelease, jitter(3000));

  console.log("[sim] Order release cycle started. Running indefinitely...");
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
