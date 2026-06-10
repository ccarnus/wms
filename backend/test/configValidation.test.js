const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ZONE_TYPES,
  LOCATION_TYPES,
  MAX_BULK_LOCATIONS,
  MAX_IMPORT_ROWS,
  validateWarehousePayload,
  validateZonePayload,
  validateLocationPayload,
  buildBulkLocationCodes,
  validateBulkLocationPayload,
  validateSkuPayload,
  validateSkuImportRows
} = require("../src/services/configValidationService");

const assertBadRequest = (fn, messagePattern) => {
  assert.throws(fn, (error) => error?.statusCode === 400 && messagePattern.test(error.message));
};

// ── Warehouses ───────────────────────────────────────────────────────

test("validateWarehousePayload requires code and name on create", () => {
  assertBadRequest(() => validateWarehousePayload({ name: "Paris" }), /code/);
  assertBadRequest(() => validateWarehousePayload({ code: "WH-1" }), /name/);
  assertBadRequest(() => validateWarehousePayload({ code: "   ", name: "Paris" }), /code/);
});

test("validateWarehousePayload normalizes optional site fields", () => {
  const result = validateWarehousePayload({
    code: " WH-PARIS-01 ",
    name: " Paris Main ",
    address: "  12 Rue de la Logistique ",
    city: "",
    country: "France",
    isActive: false
  });
  assert.deepEqual(result, {
    code: "WH-PARIS-01",
    name: "Paris Main",
    address: "12 Rue de la Logistique",
    city: null,
    country: "France",
    isActive: false
  });
});

test("validateWarehousePayload defaults: optional fields omitted when not provided", () => {
  const result = validateWarehousePayload({ code: "WH-1", name: "One" });
  assert.deepEqual(Object.keys(result).sort(), ["code", "name"]);
});

test("validateWarehousePayload partial mode only validates provided fields", () => {
  const result = validateWarehousePayload({ isActive: true }, { partial: true });
  assert.deepEqual(result, { isActive: true });
  assertBadRequest(() => validateWarehousePayload({}, { partial: true }), /At least one field/);
  assertBadRequest(() => validateWarehousePayload({ isActive: "yes" }, { partial: true }), /isActive/);
});

// ── Zones ────────────────────────────────────────────────────────────

test("validateZonePayload requires warehouseId, name, and a valid type", () => {
  assertBadRequest(() => validateZonePayload({ name: "Z", type: "pick" }), /warehouseId/);
  assertBadRequest(() => validateZonePayload({ warehouseId: 1, type: "pick" }), /name/);
  assertBadRequest(() => validateZonePayload({ warehouseId: 1, name: "Z", type: "freezer" }), /type/);
});

test("validateZonePayload accepts every zone type including packing", () => {
  assert.ok(ZONE_TYPES.includes("packing"));
  for (const type of ZONE_TYPES) {
    const result = validateZonePayload({ warehouseId: 3, name: "Zone", type, description: " fast movers " });
    assert.equal(result.type, type);
    assert.equal(result.description, "fast movers");
  }
});

test("validateZonePayload partial mode supports clearing the description", () => {
  const result = validateZonePayload({ description: "" }, { partial: true });
  assert.deepEqual(result, { description: null });
});

// ── Locations ────────────────────────────────────────────────────────

test("validateLocationPayload applies defaults on create", () => {
  const result = validateLocationPayload({ zoneId: "z-1", code: "A-01", name: "Rack A 01" });
  assert.deepEqual(result, {
    zoneId: "z-1",
    code: "A-01",
    name: "Rack A 01",
    status: "active",
    type: "rack",
    capacity: 1000
  });
});

test("validateLocationPayload rejects invalid status, type, and capacity", () => {
  const base = { zoneId: "z-1", code: "A-01", name: "Rack" };
  assertBadRequest(() => validateLocationPayload({ ...base, status: "frozen" }), /status/);
  assertBadRequest(() => validateLocationPayload({ ...base, type: "tunnel" }), /type/);
  assertBadRequest(() => validateLocationPayload({ ...base, capacity: 0 }), /capacity/);
  assertBadRequest(() => validateLocationPayload({ ...base, capacity: 2.5 }), /capacity/);
  for (const type of LOCATION_TYPES) {
    assert.equal(validateLocationPayload({ ...base, type }).type, type);
  }
});

test("validateLocationPayload partial mode requires at least one field", () => {
  assertBadRequest(() => validateLocationPayload({}, { partial: true }), /At least one field/);
  const result = validateLocationPayload({ status: "locked" }, { partial: true });
  assert.deepEqual(result, { status: "locked" });
});

// ── Bulk location generation ─────────────────────────────────────────

test("buildBulkLocationCodes expands prefix + range with padding", () => {
  assert.deepEqual(
    buildBulkLocationCodes({ prefix: "PAR-A1-", start: 1, count: 3, padding: 2 }),
    ["PAR-A1-01", "PAR-A1-02", "PAR-A1-03"]
  );
  assert.deepEqual(
    buildBulkLocationCodes({ prefix: "B", start: 9, count: 2, padding: 0 }),
    ["B9", "B10"]
  );
});

test("validateBulkLocationPayload returns generated codes with defaults", () => {
  const result = validateBulkLocationPayload({ zoneId: "z-1", prefix: "A-", count: 2 });
  assert.equal(result.zoneId, "z-1");
  assert.equal(result.status, "active");
  assert.equal(result.type, "rack");
  assert.equal(result.capacity, 1000);
  assert.deepEqual(result.codes, ["A-1", "A-2"]);
});

test("validateBulkLocationPayload enforces bounds", () => {
  assertBadRequest(() => validateBulkLocationPayload({ zoneId: "z", prefix: "A", count: 0 }), /count/);
  assertBadRequest(
    () => validateBulkLocationPayload({ zoneId: "z", prefix: "A", count: MAX_BULK_LOCATIONS + 1 }),
    /count/
  );
  assertBadRequest(() => validateBulkLocationPayload({ zoneId: "z", prefix: "A", count: 5, padding: 9 }), /padding/);
  assertBadRequest(() => validateBulkLocationPayload({ zoneId: "z", prefix: "A", count: 5, start: -1 }), /start/);
  assertBadRequest(() => validateBulkLocationPayload({ zoneId: "z", count: 5 }), /prefix/);
  assertBadRequest(() => validateBulkLocationPayload({ prefix: "A", count: 5 }), /zoneId/);
});

// ── SKUs ─────────────────────────────────────────────────────────────

test("validateSkuPayload requires sku and defaults unitOfMeasure on create", () => {
  assertBadRequest(() => validateSkuPayload({}), /sku/);
  const result = validateSkuPayload({ sku: " SKU-1 " });
  assert.equal(result.sku, "SKU-1");
  assert.equal(result.unitOfMeasure, "each");
});

test("validateSkuPayload validates numeric fields and barcodes", () => {
  assertBadRequest(() => validateSkuPayload({ sku: "S", weightKg: -1 }), /weightKg/);
  assertBadRequest(() => validateSkuPayload({ sku: "S", minStockLevel: -2 }), /minStockLevel/);
  assertBadRequest(() => validateSkuPayload({ sku: "S", minStockLevel: 1.5 }), /minStockLevel/);
  assertBadRequest(() => validateSkuPayload({ sku: "S", barcodes: "0123" }), /barcodes/);
  assertBadRequest(() => validateSkuPayload({ sku: "S", barcodes: ["ok", ""] }), /barcodes\[1\]/);

  const result = validateSkuPayload({
    sku: "S",
    category: " Spare Parts ",
    weightKg: "2.5",
    minStockLevel: "10",
    maxStockLevel: 50,
    barcodes: [" 0123 "],
    isActive: false
  });
  assert.equal(result.category, "Spare Parts");
  assert.equal(result.weightKg, 2.5);
  assert.equal(result.minStockLevel, 10);
  assert.equal(result.maxStockLevel, 50);
  assert.deepEqual(result.barcodes, ["0123"]);
  assert.equal(result.isActive, false);
});

test("validateSkuPayload rejects min stock greater than max stock", () => {
  assertBadRequest(
    () => validateSkuPayload({ sku: "S", minStockLevel: 100, maxStockLevel: 10 }),
    /minStockLevel cannot be greater/
  );
  // Equal thresholds are allowed.
  const result = validateSkuPayload({ sku: "S", minStockLevel: 10, maxStockLevel: 10 });
  assert.equal(result.minStockLevel, 10);
});

test("validateSkuPayload partial mode ignores sku and requires at least one field", () => {
  const result = validateSkuPayload({ sku: "IGNORED", description: "New text" }, { partial: true });
  assert.equal(result.sku, undefined);
  assert.equal(result.description, "New text");
  assertBadRequest(() => validateSkuPayload({}, { partial: true }), /At least one field/);
});

// ── SKU import ───────────────────────────────────────────────────────

test("validateSkuImportRows separates valid rows from per-row errors", () => {
  const { valid, errors } = validateSkuImportRows([
    { sku: "SKU-1", description: "Good" },
    { description: "Missing sku" },
    { sku: "SKU-2", minStockLevel: -5 }
  ]);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].row.sku, "SKU-1");
  assert.equal(errors.length, 2);
  assert.equal(errors[0].index, 1);
  assert.match(errors[0].message, /sku/);
  assert.equal(errors[1].index, 2);
  assert.match(errors[1].message, /minStockLevel/);
});

test("validateSkuImportRows rejects duplicate sku codes within a batch", () => {
  const { valid, errors } = validateSkuImportRows([
    { sku: "SKU-1" },
    { sku: "SKU-1" }
  ]);
  assert.equal(valid.length, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /duplicate/);
});

test("validateSkuImportRows enforces batch shape and size", () => {
  assertBadRequest(() => validateSkuImportRows(undefined), /non-empty array/);
  assertBadRequest(() => validateSkuImportRows([]), /non-empty array/);
  const tooMany = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ sku: `SKU-${i}` }));
  assertBadRequest(() => validateSkuImportRows(tooMany), /at most/);
});
