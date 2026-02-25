const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ORDER_EVENT_TYPES,
  buildPurchaseOrderPutawayTaskSpecs,
  buildSalesOrderPickTaskSpecs,
  calculateEstimatedTimeSeconds,
  calculatePickPriority,
  normalizeTaskGenerationEvent
} = require("../src/services/taskGenerationLogic");

test("calculateEstimatedTimeSeconds uses base + (units * timePerUnit)", () => {
  const estimatedSeconds = calculateEstimatedTimeSeconds(5, 90, 12);
  assert.equal(estimatedSeconds, 150);
});

test("calculatePickPriority increases as ship date gets closer", () => {
  const now = new Date("2026-03-01T00:00:00.000Z");
  assert.equal(calculatePickPriority("2026-03-06T00:00:00.000Z", now), 50);
  assert.equal(calculatePickPriority("2026-03-03T00:00:00.000Z", now), 70);
  assert.equal(calculatePickPriority("2026-03-02T00:00:00.000Z", now), 90);
  assert.equal(calculatePickPriority("2026-03-01T00:00:00.000Z", now), 100);
});

test("normalizeTaskGenerationEvent validates and normalizes sales order events", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
    salesOrderId: "SO-123",
    shipDate: "2026-03-10T12:00:00.000Z",
    lines: [{ skuId: 1, quantity: 2, pickLocationId: 101 }]
  });

  assert.equal(normalized.type, ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK);
  assert.equal(normalized.sourceDocumentId, "SO:SO-123");
  assert.equal(normalized.lines.length, 1);
  assert.equal(normalized.lines[0].pickLocationId, 101);
  assert.match(normalized.eventKey, /^sales_order_ready_for_pick:SO:SO-123:/);
});

test("buildSalesOrderPickTaskSpecs groups lines by zone and computes estimation", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
    salesOrderId: "SO-777",
    shipDate: "2026-03-02T00:00:00.000Z",
    lines: [
      { skuId: 1, quantity: 2, pickLocationId: 10 },
      { skuId: 2, quantity: 3, pickLocationId: 11 },
      { skuId: 3, quantity: 1, pickLocationId: 12 }
    ]
  });

  const zoneMap = new Map([
    [10, "zone-a"],
    [11, "zone-a"],
    [12, "zone-b"]
  ]);
  const zoneResolver = (locationId) => zoneMap.get(locationId);

  const taskSpecs = buildSalesOrderPickTaskSpecs(normalized, zoneResolver, {
    baseTimeSeconds: 60,
    timePerUnitSeconds: 5,
    now: new Date("2026-03-01T00:00:00.000Z")
  });

  assert.equal(taskSpecs.length, 2);

  const zoneATask = taskSpecs.find((spec) => spec.zoneId === "zone-a");
  assert.ok(zoneATask);
  assert.equal(zoneATask.type, "pick");
  assert.equal(zoneATask.priority, 90);
  assert.equal(zoneATask.estimatedTimeSeconds, 85);
  assert.equal(zoneATask.lines.length, 2);

  const zoneBTask = taskSpecs.find((spec) => spec.zoneId === "zone-b");
  assert.ok(zoneBTask);
  assert.equal(zoneBTask.estimatedTimeSeconds, 65);
  assert.equal(zoneBTask.lines.length, 1);
});

test("buildPurchaseOrderPutawayTaskSpecs groups by destination location zone", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
    purchaseOrderId: "PO-456",
    lines: [
      { skuId: 1, quantity: 6, destinationLocationId: 201 },
      { skuId: 2, quantity: 4, destinationLocationId: 202 }
    ]
  });

  const zoneMap = new Map([
    [201, "zone-putaway-a"],
    [202, "zone-putaway-b"]
  ]);
  const zoneResolver = (locationId) => zoneMap.get(locationId);

  const taskSpecs = buildPurchaseOrderPutawayTaskSpecs(normalized, zoneResolver, {
    baseTimeSeconds: 40,
    timePerUnitSeconds: 2,
    priority: 55
  });

  assert.equal(taskSpecs.length, 2);
  assert.equal(taskSpecs[0].type, "putaway");
  assert.equal(taskSpecs[0].priority, 55);
  assert.equal(taskSpecs[0].sourceDocumentId, "PO:PO-456");
  assert.equal(taskSpecs[0].lines[0].toLocationId > 0, true);
});

test("buildSalesOrderPickTaskSpecs rejects missing location to zone mapping", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
    salesOrderId: "SO-888",
    shipDate: "2026-03-01T00:00:00.000Z",
    lines: [{ skuId: 1, quantity: 1, pickLocationId: 999 }]
  });

  assert.throws(
    () => buildSalesOrderPickTaskSpecs(normalized, () => null),
    (error) => error?.statusCode === 400 && /No zone mapping/.test(error.message)
  );
});
