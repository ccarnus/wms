const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ORDER_EVENT_TYPES,
  buildSalesOrderPickTaskSpecs,
  calculateEstimatedTimeSeconds,
  calculatePickPriority,
  normalizeTaskGenerationEvent
} = require("../src/services/taskGenerationLogic");

// ── Shared utilities ────────────────────────────────────────────────

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

// ── Sales order normalization ───────────────────────────────────────

test("normalizeTaskGenerationEvent validates and normalizes sales order events", () => {
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

// ── Pick task spec building ─────────────────────────────────────────

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
