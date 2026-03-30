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

test("normalizeTaskGenerationEvent validates and normalizes sales order events without pickLocationId", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
    salesOrderId: "SO-123",
    shipDate: "2026-03-10T12:00:00.000Z",
    lines: [{ skuId: 1, quantity: 2 }]
  });

  assert.equal(normalized.type, ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK);
  assert.equal(normalized.sourceDocumentId, "SO-SO-123");
  assert.equal(normalized.lines.length, 1);
  assert.equal(normalized.lines[0].skuId, 1);
  assert.equal(normalized.lines[0].quantity, 2);
  assert.equal(normalized.lines[0].pickLocationId, undefined);
  assert.ok(typeof normalized.priority === "number");
  assert.match(normalized.eventKey, /^sales_order_ready_for_pick--SO-SO-123--/);
});

test("normalizeTaskGenerationEvent rejects sales order with missing skuId or quantity", () => {
  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
      salesOrderId: "SO-BAD",
      shipDate: "2026-03-10T12:00:00.000Z",
      lines: [{ quantity: 2 }]
    }),
    (error) => error?.statusCode === 400 && /skuId/.test(error.message)
  );

  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
      salesOrderId: "SO-BAD",
      shipDate: "2026-03-10T12:00:00.000Z",
      lines: [{ skuId: 1 }]
    }),
    (error) => error?.statusCode === 400 && /quantity/.test(error.message)
  );
});

test("normalizeTaskGenerationEvent includes priority based on ship date", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
    salesOrderId: "SO-PRI",
    shipDate: new Date(Date.now() + 86400000).toISOString(),
    lines: [{ skuId: 1, quantity: 1 }]
  });

  assert.ok(normalized.priority >= 50);
  assert.ok(normalized.priority <= 100);
});

test("buildSalesOrderPickTaskSpecs creates one task from resolved lines", () => {
  const event = {
    type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
    sourceDocumentId: "SO-777",
    shipDate: "2026-03-02T00:00:00.000Z",
    priority: 90,
    lines: [
      { skuId: 1, quantity: 2 },
      { skuId: 2, quantity: 3 },
      { skuId: 3, quantity: 1 }
    ]
  };

  const resolvedLines = [
    { skuId: 1, quantity: 2, pickLocationId: 10 },
    { skuId: 2, quantity: 3, pickLocationId: 11 },
    { skuId: 3, quantity: 1, pickLocationId: 12 }
  ];

  const taskSpecs = buildSalesOrderPickTaskSpecs(event, resolvedLines, {
    baseTimeSeconds: 60,
    timePerUnitSeconds: 5,
    now: new Date("2026-03-01T00:00:00.000Z")
  });

  assert.equal(taskSpecs.length, 1);

  const task = taskSpecs[0];
  assert.equal(task.type, "pick");
  assert.equal(task.priority, 90);
  assert.equal(task.zoneId, null);
  assert.equal(task.lines.length, 3);
  // total units = 2 + 3 + 1 = 6, estimated = 60 + 6*5 = 90
  assert.equal(task.estimatedTimeSeconds, 90);
  assert.equal(task.lines[0].fromLocationId, 10);
  assert.equal(task.lines[1].fromLocationId, 11);
  assert.equal(task.lines[2].fromLocationId, 12);
});

test("normalizeTaskGenerationEvent validates strategy for purchase orders", () => {
  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
      purchaseOrderId: "PO-456",
      lines: [{ skuId: 1, quantity: 6 }]
    }),
    (error) => error?.statusCode === 400 && /strategy/.test(error.message)
  );

  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
      purchaseOrderId: "PO-456",
      strategy: "INVALID",
      lines: [{ skuId: 1, quantity: 6 }]
    }),
    (error) => error?.statusCode === 400 && /strategy/.test(error.message)
  );
});

test("normalizeTaskGenerationEvent normalizes purchase order with strategy", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
    purchaseOrderId: "PO-456",
    strategy: "consolidation",
    lines: [
      { skuId: 1, quantity: 6 },
      { skuId: 2, quantity: 4 }
    ]
  });

  assert.equal(normalized.type, ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED);
  assert.equal(normalized.sourceDocumentId, "PO-PO-456");
  assert.equal(normalized.strategy, "CONSOLIDATION");
  assert.equal(normalized.lines.length, 2);
  assert.equal(normalized.lines[0].skuId, 1);
  assert.equal(normalized.lines[0].quantity, 6);
  assert.equal(normalized.lines[0].destinationLocationId, undefined);
});

test("buildPurchaseOrderPutawayTaskSpecs groups resolved lines by zone", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
    purchaseOrderId: "PO-456",
    strategy: "CONSOLIDATION",
    lines: [
      { skuId: 1, quantity: 6 },
      { skuId: 2, quantity: 4 }
    ]
  });

  const resolvedLines = [
    { skuId: 1, quantity: 6, destinationLocationId: 201, zoneId: "zone-putaway-a" },
    { skuId: 2, quantity: 4, destinationLocationId: 202, zoneId: "zone-putaway-b" }
  ];

  const taskSpecs = buildPurchaseOrderPutawayTaskSpecs(normalized, resolvedLines, {
    baseTimeSeconds: 40,
    timePerUnitSeconds: 2,
    priority: 55
  });

  assert.equal(taskSpecs.length, 2);
  assert.equal(taskSpecs[0].type, "putaway");
  assert.equal(taskSpecs[0].priority, 55);
  assert.equal(taskSpecs[0].sourceDocumentId, "PO-PO-456");
  assert.equal(taskSpecs[0].zoneId, "zone-putaway-a");
  assert.equal(taskSpecs[0].lines[0].toLocationId, 201);
  assert.equal(taskSpecs[1].zoneId, "zone-putaway-b");
  assert.equal(taskSpecs[1].lines[0].toLocationId, 202);
});
