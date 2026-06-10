const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildExternalOrderId,
  buildReceiptEventKey,
  buildTrackingPayload,
  extractReceiptIdFromExternalId,
  getApiBaseUrl,
  getPollIntervalMs,
  mapReceiptToSalesOrderEvent,
  parseEtsyTimestamp,
  validateEtsyConfig
} = require("../src/integrations/connectors/etsy/etsyLogic");

const VALID_CONFIG = {
  shopId: "12345678",
  keystring: "1aa2bb33c44d55eeeeee6fff",
  refreshToken: "12345678.AbCdEf"
};

const makeReceipt = (overrides = {}) => ({
  receipt_id: 3210001234,
  is_paid: true,
  is_shipped: false,
  expected_ship_date: 1750000000,
  transactions: [
    { transaction_id: 1, sku: "TSHIRT-RED-M", quantity: 2 },
    { transaction_id: 2, sku: "MUG-CLASSIC", quantity: 1 }
  ],
  ...overrides
});

const SKU_IDS = new Map([
  ["TSHIRT-RED-M", 11],
  ["MUG-CLASSIC", 22]
]);
const resolveSku = (code) => SKU_IDS.get(code);

// --- validateEtsyConfig ---

test("validateEtsyConfig accepts a complete config", () => {
  assert.deepEqual(validateEtsyConfig(VALID_CONFIG, "bidirectional"), []);
});

test("validateEtsyConfig requires shopId, keystring, and refreshToken", () => {
  const errors = validateEtsyConfig({}, "inbound");
  assert.equal(errors.length, 3);
  assert.match(errors.join(" "), /shopId/);
  assert.match(errors.join(" "), /keystring/);
  assert.match(errors.join(" "), /refreshToken/);
});

test("validateEtsyConfig rejects a non-numeric shopId", () => {
  const errors = validateEtsyConfig({ ...VALID_CONFIG, shopId: "my-shop" }, "inbound");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /numeric/);
});

test("validateEtsyConfig rejects a poll interval below 1 minute", () => {
  const errors = validateEtsyConfig({ ...VALID_CONFIG, pollIntervalMinutes: 0 }, "inbound");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /pollIntervalMinutes/);
});

test("validateEtsyConfig rejects an invalid apiBaseUrl", () => {
  const errors = validateEtsyConfig({ ...VALID_CONFIG, apiBaseUrl: "not a url" }, "outbound");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /apiBaseUrl/);
});

// --- external ID round-trip ---

test("buildExternalOrderId and extractReceiptIdFromExternalId round-trip", () => {
  const externalId = buildExternalOrderId(3210001234);
  assert.equal(externalId, "ETSY-3210001234");
  assert.equal(extractReceiptIdFromExternalId(externalId), 3210001234);
});

test("extractReceiptIdFromExternalId returns null for non-Etsy orders", () => {
  assert.equal(extractReceiptIdFromExternalId("SO-10045"), null);
  assert.equal(extractReceiptIdFromExternalId(""), null);
  assert.equal(extractReceiptIdFromExternalId(null), null);
  assert.equal(extractReceiptIdFromExternalId("ETSY-abc"), null);
});

// --- receipt mapping ---

test("mapReceiptToSalesOrderEvent maps a receipt to a sales order event", () => {
  const { event, missingSkus } = mapReceiptToSalesOrderEvent(makeReceipt(), resolveSku);
  assert.deepEqual(missingSkus, []);
  assert.equal(event.type, "sales_order_ready_for_pick");
  assert.equal(event.salesOrderId, "ETSY-3210001234");
  assert.equal(event.eventKey, buildReceiptEventKey(3210001234));
  assert.equal(event.shipDate, new Date(1750000000 * 1000).toISOString());
  assert.deepEqual(event.lines, [
    { skuId: 11, quantity: 2 },
    { skuId: 22, quantity: 1 }
  ]);
});

test("mapReceiptToSalesOrderEvent merges duplicate SKUs across transactions", () => {
  const receipt = makeReceipt({
    transactions: [
      { transaction_id: 1, sku: "TSHIRT-RED-M", quantity: 2 },
      { transaction_id: 2, sku: "TSHIRT-RED-M", quantity: 3 }
    ]
  });
  const { event } = mapReceiptToSalesOrderEvent(receipt, resolveSku);
  assert.deepEqual(event.lines, [{ skuId: 11, quantity: 5 }]);
});

test("mapReceiptToSalesOrderEvent reports unknown SKUs and produces no event", () => {
  const receipt = makeReceipt({
    transactions: [
      { transaction_id: 1, sku: "TSHIRT-RED-M", quantity: 1 },
      { transaction_id: 2, sku: "UNKNOWN-SKU", quantity: 1 }
    ]
  });
  const { event, missingSkus } = mapReceiptToSalesOrderEvent(receipt, resolveSku);
  assert.equal(event, null);
  assert.deepEqual(missingSkus, ["UNKNOWN-SKU"]);
});

test("mapReceiptToSalesOrderEvent flags transactions without a SKU", () => {
  const receipt = makeReceipt({
    transactions: [{ transaction_id: 99, quantity: 1 }]
  });
  const { event, missingSkus } = mapReceiptToSalesOrderEvent(receipt, resolveSku);
  assert.equal(event, null);
  assert.equal(missingSkus.length, 1);
  assert.match(missingSkus[0], /transaction 99/);
});

test("mapReceiptToSalesOrderEvent skips zero/negative quantity transactions", () => {
  const receipt = makeReceipt({
    transactions: [
      { transaction_id: 1, sku: "TSHIRT-RED-M", quantity: 0 },
      { transaction_id: 2, sku: "MUG-CLASSIC", quantity: 2 }
    ]
  });
  const { event } = mapReceiptToSalesOrderEvent(receipt, resolveSku);
  assert.deepEqual(event.lines, [{ skuId: 22, quantity: 2 }]);
});

test("mapReceiptToSalesOrderEvent returns no event for an empty receipt", () => {
  const { event, missingSkus } = mapReceiptToSalesOrderEvent(makeReceipt({ transactions: [] }), resolveSku);
  assert.equal(event, null);
  assert.deepEqual(missingSkus, []);
});

test("mapReceiptToSalesOrderEvent falls back to now + 3 days without expected_ship_date", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const { event } = mapReceiptToSalesOrderEvent(
    makeReceipt({ expected_ship_date: null }),
    resolveSku,
    { now }
  );
  assert.equal(event.shipDate, "2026-06-13T12:00:00.000Z");
});

test("mapReceiptToSalesOrderEvent throws without a receipt_id", () => {
  assert.throws(() => mapReceiptToSalesOrderEvent({ transactions: [] }, resolveSku), /receipt_id/);
});

// --- tracking payload ---

test("buildTrackingPayload builds the Etsy tracking body", () => {
  assert.deepEqual(buildTrackingPayload({ trackingNumber: "1Z999AA10123456784", carrier: "ups" }), {
    tracking_code: "1Z999AA10123456784",
    carrier_name: "ups",
    send_bcc: false
  });
});

test("buildTrackingPayload defaults the carrier to 'other'", () => {
  assert.equal(buildTrackingPayload({ trackingNumber: "ABC123" }).carrier_name, "other");
});

test("buildTrackingPayload throws without a tracking number", () => {
  assert.throws(() => buildTrackingPayload({ carrier: "ups" }), /trackingNumber/);
});

// --- config helpers ---

test("parseEtsyTimestamp converts epoch seconds and rejects garbage", () => {
  assert.equal(parseEtsyTimestamp(1750000000), new Date(1750000000 * 1000).toISOString());
  assert.equal(parseEtsyTimestamp(null), null);
  assert.equal(parseEtsyTimestamp("nope"), null);
  assert.equal(parseEtsyTimestamp(0), null);
});

test("getApiBaseUrl strips trailing slashes and defaults to production Etsy", () => {
  assert.equal(getApiBaseUrl({}), "https://openapi.etsy.com");
  assert.equal(getApiBaseUrl({ apiBaseUrl: "http://mock:9000/" }), "http://mock:9000");
});

test("getPollIntervalMs defaults to 5 minutes and honors the config", () => {
  assert.equal(getPollIntervalMs({}), 5 * 60 * 1000);
  assert.equal(getPollIntervalMs({ pollIntervalMinutes: 2 }), 2 * 60 * 1000);
  assert.equal(getPollIntervalMs({ pollIntervalMinutes: 0 }), 5 * 60 * 1000);
});
