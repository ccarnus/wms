const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ORDER_EVENT_TYPES,
  PUTAWAY_STRATEGIES,
  buildPurchaseOrderPutawayTaskSpecs,
  normalizeTaskGenerationEvent
} = require("../src/services/taskGenerationLogic");

const {
  resolvePutawayLocations,
  findConsolidationLocation,
  findRandomLocation,
  findEmptyLocation,
  findAnyAvailableLocation
} = require("../src/services/putawayResolutionService");

// ── Mock database client ────────────────────────────────────────────

/**
 * Creates a mock DB client that returns canned rows based on query content.
 * queryHandler: (sql, params) => rows[]
 */
const createMockClient = (queryHandler) => ({
  query: async (sql, params) => {
    const rows = queryHandler(sql, params);
    return { rows: rows || [], rowCount: (rows || []).length };
  }
});

// ── Purchase order normalization ────────────────────────────────────

test("normalizeTaskGenerationEvent requires strategy for purchase orders", () => {
  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
      purchaseOrderId: "PO-100",
      lines: [{ skuId: 1, quantity: 6 }]
    }),
    (error) => error?.statusCode === 400 && /strategy/.test(error.message)
  );
});

test("normalizeTaskGenerationEvent rejects invalid strategy", () => {
  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
      purchaseOrderId: "PO-100",
      strategy: "FIFO",
      lines: [{ skuId: 1, quantity: 6 }]
    }),
    (error) => error?.statusCode === 400 && /strategy/.test(error.message)
  );
});

test("normalizeTaskGenerationEvent accepts all valid strategies (case-insensitive)", () => {
  for (const strategy of ["RANDOM", "random", "Random", "CONSOLIDATION", "consolidation", "EMPTY", "empty"]) {
    const normalized = normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
      purchaseOrderId: "PO-CS",
      strategy,
      lines: [{ skuId: 1, quantity: 1 }]
    });
    assert.ok(PUTAWAY_STRATEGIES[normalized.strategy], `strategy "${strategy}" should normalize`);
  }
});

test("normalizeTaskGenerationEvent normalizes purchase order with strategy and lines", () => {
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

test("normalizeTaskGenerationEvent rejects purchase order with missing skuId or quantity", () => {
  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
      purchaseOrderId: "PO-BAD",
      strategy: "EMPTY",
      lines: [{ quantity: 5 }]
    }),
    (error) => error?.statusCode === 400 && /skuId/.test(error.message)
  );

  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
      purchaseOrderId: "PO-BAD",
      strategy: "EMPTY",
      lines: [{ skuId: 1 }]
    }),
    (error) => error?.statusCode === 400 && /quantity/.test(error.message)
  );
});

test("normalizeTaskGenerationEvent rejects purchase order with empty lines", () => {
  assert.throws(
    () => normalizeTaskGenerationEvent({
      type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
      purchaseOrderId: "PO-EMPTY",
      strategy: "RANDOM",
      lines: []
    }),
    (error) => error?.statusCode === 400 && /lines/.test(error.message)
  );
});

// ── Putaway task spec building ──────────────────────────────────────

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
    { skuId: 1, quantity: 6, destinationLocationId: 201, zoneId: "zone-a" },
    { skuId: 2, quantity: 4, destinationLocationId: 202, zoneId: "zone-b" }
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
  assert.equal(taskSpecs[0].zoneId, "zone-a");
  assert.equal(taskSpecs[0].lines[0].toLocationId, 201);
  assert.equal(taskSpecs[0].lines[0].skuId, 1);
  assert.equal(taskSpecs[1].zoneId, "zone-b");
  assert.equal(taskSpecs[1].lines[0].toLocationId, 202);
});

test("buildPurchaseOrderPutawayTaskSpecs merges lines in the same zone into one task", () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
    purchaseOrderId: "PO-MERGE",
    strategy: "RANDOM",
    lines: [
      { skuId: 1, quantity: 3 },
      { skuId: 2, quantity: 7 },
      { skuId: 3, quantity: 5 }
    ]
  });

  const resolvedLines = [
    { skuId: 1, quantity: 3, destinationLocationId: 101, zoneId: "zone-x" },
    { skuId: 2, quantity: 7, destinationLocationId: 102, zoneId: "zone-x" },
    { skuId: 3, quantity: 5, destinationLocationId: 103, zoneId: "zone-y" }
  ];

  const taskSpecs = buildPurchaseOrderPutawayTaskSpecs(normalized, resolvedLines, {
    baseTimeSeconds: 50,
    timePerUnitSeconds: 3,
    priority: 60
  });

  assert.equal(taskSpecs.length, 2);

  const zoneXTask = taskSpecs.find((t) => t.zoneId === "zone-x");
  assert.equal(zoneXTask.lines.length, 2);
  // total units in zone-x = 3 + 7 = 10, estimated = 50 + 10*3 = 80
  assert.equal(zoneXTask.estimatedTimeSeconds, 80);

  const zoneYTask = taskSpecs.find((t) => t.zoneId === "zone-y");
  assert.equal(zoneYTask.lines.length, 1);
  // total units in zone-y = 5, estimated = 50 + 5*3 = 65
  assert.equal(zoneYTask.estimatedTimeSeconds, 65);
});

test("buildPurchaseOrderPutawayTaskSpecs sets fromLocationId to null", () => {
  const resolvedLines = [
    { skuId: 1, quantity: 10, destinationLocationId: 301, zoneId: "zone-a" }
  ];

  const taskSpecs = buildPurchaseOrderPutawayTaskSpecs(
    { sourceDocumentId: "PO-TEST" },
    resolvedLines,
    { baseTimeSeconds: 75, timePerUnitSeconds: 10, priority: 60 }
  );

  assert.equal(taskSpecs[0].lines[0].fromLocationId, null);
});

// ── Strategy resolution (with mock DB) ──────────────────────────────

test("CONSOLIDATION strategy picks location with same SKU", async () => {
  const client = createMockClient((sql) => {
    // findConsolidationLocation query has "i.sku_id = $1"
    if (sql.includes("i.sku_id")) {
      return [{ location_id: 50, zone_id: "zone-bulk-1", capacity: 1000, current_quantity: 20, remaining_capacity: 980 }];
    }
    return [];
  });

  const result = await findConsolidationLocation(client, 1, 10);
  assert.ok(result);
  assert.equal(result.locationId, 50);
  assert.equal(result.zoneId, "zone-bulk-1");
});

test("CONSOLIDATION strategy returns null when no matching SKU location", async () => {
  const client = createMockClient(() => []);

  const result = await findConsolidationLocation(client, 1, 10);
  assert.equal(result, null);
});

test("RANDOM strategy picks any location with existing inventory", async () => {
  const client = createMockClient((sql) => {
    if (sql.includes("EXISTS")) {
      return [{ location_id: 77, zone_id: "zone-bulk-2", capacity: 500, remaining_capacity: 400 }];
    }
    return [];
  });

  const result = await findRandomLocation(client, 5);
  assert.ok(result);
  assert.equal(result.locationId, 77);
  assert.equal(result.zoneId, "zone-bulk-2");
});

test("RANDOM strategy returns null when no locations have inventory", async () => {
  const client = createMockClient(() => []);

  const result = await findRandomLocation(client, 5);
  assert.equal(result, null);
});

test("EMPTY strategy picks location with no inventory", async () => {
  const client = createMockClient((sql) => {
    if (sql.includes("NOT EXISTS")) {
      return [{ location_id: 99, zone_id: "zone-staging-1", capacity: 2000 }];
    }
    return [];
  });

  const result = await findEmptyLocation(client, 15);
  assert.ok(result);
  assert.equal(result.locationId, 99);
  assert.equal(result.zoneId, "zone-staging-1");
});

test("EMPTY strategy returns null when all locations have inventory", async () => {
  const client = createMockClient(() => []);

  const result = await findEmptyLocation(client, 15);
  assert.equal(result, null);
});

test("findAnyAvailableLocation returns location with capacity regardless of inventory", async () => {
  const client = createMockClient((sql) => {
    if (sql.includes("remaining_capacity")) {
      return [{ location_id: 42, zone_id: "zone-bulk-3", capacity: 800, remaining_capacity: 600 }];
    }
    return [];
  });

  const result = await findAnyAvailableLocation(client, 100);
  assert.ok(result);
  assert.equal(result.locationId, 42);
});

test("findAnyAvailableLocation returns null when no capacity available", async () => {
  const client = createMockClient(() => []);

  const result = await findAnyAvailableLocation(client, 100);
  assert.equal(result, null);
});

// ── resolvePutawayLocations orchestration ───────────────────────────

test("resolvePutawayLocations resolves all lines with CONSOLIDATION strategy", async () => {
  let queryCount = 0;
  const client = createMockClient((sql) => {
    // findConsolidationLocation — return a match for each call
    if (sql.includes("i.sku_id")) {
      queryCount++;
      return [{ location_id: 200 + queryCount, zone_id: `zone-${queryCount}`, capacity: 1000, current_quantity: 50, remaining_capacity: 900 }];
    }
    return [];
  });

  const result = await resolvePutawayLocations(client, [
    { skuId: 1, quantity: 10 },
    { skuId: 2, quantity: 20 }
  ], PUTAWAY_STRATEGIES.CONSOLIDATION);

  assert.equal(result.allResolved, true);
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].status, "resolved");
  assert.equal(result.lines[0].destinationLocationId, 201);
  assert.equal(result.lines[1].status, "resolved");
  assert.equal(result.lines[1].destinationLocationId, 202);
});

test("resolvePutawayLocations resolves all lines with EMPTY strategy", async () => {
  let queryCount = 0;
  const client = createMockClient((sql) => {
    if (sql.includes("NOT EXISTS")) {
      queryCount++;
      return [{ location_id: 300 + queryCount, zone_id: `zone-empty-${queryCount}`, capacity: 500 }];
    }
    return [];
  });

  const result = await resolvePutawayLocations(client, [
    { skuId: 5, quantity: 8 }
  ], PUTAWAY_STRATEGIES.EMPTY);

  assert.equal(result.allResolved, true);
  assert.equal(result.lines[0].destinationLocationId, 301);
  assert.equal(result.lines[0].zoneId, "zone-empty-1");
});

test("resolvePutawayLocations resolves all lines with RANDOM strategy", async () => {
  const client = createMockClient((sql) => {
    if (sql.includes("EXISTS")) {
      return [{ location_id: 88, zone_id: "zone-random", capacity: 1000, remaining_capacity: 900 }];
    }
    return [];
  });

  const result = await resolvePutawayLocations(client, [
    { skuId: 3, quantity: 5 }
  ], PUTAWAY_STRATEGIES.RANDOM);

  assert.equal(result.allResolved, true);
  assert.equal(result.lines[0].destinationLocationId, 88);
  assert.equal(result.lines[0].zoneId, "zone-random");
});

test("resolvePutawayLocations falls back to any available location when strategy finds nothing", async () => {
  let callIndex = 0;
  const client = createMockClient((sql) => {
    callIndex++;
    // First call: findConsolidationLocation — returns nothing
    if (callIndex === 1) {
      return [];
    }
    // Second call: findAnyAvailableLocation — returns a fallback
    if (callIndex === 2) {
      return [{ location_id: 999, zone_id: "zone-fallback", capacity: 2000, remaining_capacity: 1500 }];
    }
    return [];
  });

  const result = await resolvePutawayLocations(client, [
    { skuId: 7, quantity: 30 }
  ], PUTAWAY_STRATEGIES.CONSOLIDATION);

  assert.equal(result.allResolved, true);
  assert.equal(result.lines[0].status, "resolved");
  assert.equal(result.lines[0].destinationLocationId, 999);
  assert.equal(result.lines[0].zoneId, "zone-fallback");
});

test("resolvePutawayLocations EMPTY falls back to any available when no empty locations exist", async () => {
  let callIndex = 0;
  const client = createMockClient((sql) => {
    callIndex++;
    // First call: findEmptyLocation — nothing
    if (callIndex === 1) {
      return [];
    }
    // Second call: findAnyAvailableLocation — returns result
    if (callIndex === 2) {
      return [{ location_id: 555, zone_id: "zone-non-empty-fallback", capacity: 800, remaining_capacity: 300 }];
    }
    return [];
  });

  const result = await resolvePutawayLocations(client, [
    { skuId: 2, quantity: 15 }
  ], PUTAWAY_STRATEGIES.EMPTY);

  assert.equal(result.allResolved, true);
  assert.equal(result.lines[0].destinationLocationId, 555);
});

test("resolvePutawayLocations RANDOM falls back to any available when no occupied locations fit", async () => {
  let callIndex = 0;
  const client = createMockClient((sql) => {
    callIndex++;
    if (callIndex === 1) {
      return [];
    }
    if (callIndex === 2) {
      return [{ location_id: 444, zone_id: "zone-fallback-r", capacity: 1000, remaining_capacity: 700 }];
    }
    return [];
  });

  const result = await resolvePutawayLocations(client, [
    { skuId: 9, quantity: 50 }
  ], PUTAWAY_STRATEGIES.RANDOM);

  assert.equal(result.allResolved, true);
  assert.equal(result.lines[0].destinationLocationId, 444);
});

test("resolvePutawayLocations reports no_capacity when strategy and fallback both fail", async () => {
  const client = createMockClient(() => []);

  const result = await resolvePutawayLocations(client, [
    { skuId: 1, quantity: 10 },
    { skuId: 2, quantity: 5 }
  ], PUTAWAY_STRATEGIES.CONSOLIDATION);

  assert.equal(result.allResolved, false);
  assert.equal(result.lines[0].status, "no_capacity");
  assert.equal(result.lines[0].destinationLocationId, null);
  assert.equal(result.lines[0].zoneId, null);
  assert.equal(result.lines[1].status, "no_capacity");
});

test("resolvePutawayLocations partial resolution — some lines resolve, some fail", async () => {
  let callIndex = 0;
  const client = createMockClient((sql) => {
    callIndex++;
    // Line 1: consolidation finds a match
    if (callIndex === 1) {
      return [{ location_id: 100, zone_id: "zone-ok", capacity: 1000, current_quantity: 20, remaining_capacity: 950 }];
    }
    // Line 2: consolidation fails, fallback also fails
    return [];
  });

  const result = await resolvePutawayLocations(client, [
    { skuId: 1, quantity: 5 },
    { skuId: 2, quantity: 9999 }
  ], PUTAWAY_STRATEGIES.CONSOLIDATION);

  assert.equal(result.allResolved, false);
  assert.equal(result.lines[0].status, "resolved");
  assert.equal(result.lines[0].destinationLocationId, 100);
  assert.equal(result.lines[1].status, "no_capacity");
  assert.equal(result.lines[1].destinationLocationId, null);
});

// ── End-to-end: normalization → resolution → task specs ─────────────

test("end-to-end: purchase order normalizes, resolves, and builds correct task specs", async () => {
  const normalized = normalizeTaskGenerationEvent({
    type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
    purchaseOrderId: "PO-E2E",
    strategy: "EMPTY",
    lines: [
      { skuId: 10, quantity: 20 },
      { skuId: 11, quantity: 15 },
      { skuId: 12, quantity: 5 }
    ]
  });

  assert.equal(normalized.strategy, "EMPTY");
  assert.equal(normalized.lines.length, 3);

  // Simulate resolution: two lines go to zone-a, one to zone-b
  const resolvedLines = [
    { skuId: 10, quantity: 20, destinationLocationId: 401, zoneId: "zone-a" },
    { skuId: 11, quantity: 15, destinationLocationId: 402, zoneId: "zone-a" },
    { skuId: 12, quantity: 5, destinationLocationId: 403, zoneId: "zone-b" }
  ];

  const taskSpecs = buildPurchaseOrderPutawayTaskSpecs(normalized, resolvedLines, {
    baseTimeSeconds: 75,
    timePerUnitSeconds: 10,
    priority: 60
  });

  assert.equal(taskSpecs.length, 2);

  const zoneATask = taskSpecs.find((t) => t.zoneId === "zone-a");
  assert.ok(zoneATask);
  assert.equal(zoneATask.type, "putaway");
  assert.equal(zoneATask.priority, 60);
  assert.equal(zoneATask.lines.length, 2);
  // total units zone-a = 20 + 15 = 35, estimated = 75 + 35*10 = 425
  assert.equal(zoneATask.estimatedTimeSeconds, 425);
  assert.equal(zoneATask.lines[0].toLocationId, 401);
  assert.equal(zoneATask.lines[0].fromLocationId, null);
  assert.equal(zoneATask.lines[1].toLocationId, 402);

  const zoneBTask = taskSpecs.find((t) => t.zoneId === "zone-b");
  assert.ok(zoneBTask);
  assert.equal(zoneBTask.lines.length, 1);
  // total units zone-b = 5, estimated = 75 + 5*10 = 125
  assert.equal(zoneBTask.estimatedTimeSeconds, 125);
  assert.equal(zoneBTask.lines[0].toLocationId, 403);
  assert.equal(zoneBTask.sourceDocumentId, "PO-PO-E2E");
});
