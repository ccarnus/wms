// Pure validation/normalization logic for the configuration section
// (warehouses, zones, locations, SKUs). No database access — unit testable.

const ZONE_TYPES = ["pick", "bulk", "dock", "staging", "packing"];
const LOCATION_TYPES = ["rack", "shelf", "bin", "floor", "dock", "staging"];
const LOCATION_STATUSES = ["active", "locked"];

const MAX_CODE_LENGTH = 50;
const MAX_NAME_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 300;
const MAX_CITY_LENGTH = 100;
const MAX_COUNTRY_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_SKU_LENGTH = 100;
const MAX_UOM_LENGTH = 20;
const MAX_CATEGORY_LENGTH = 100;
const MAX_PICTURE_URL_LENGTH = 2048;
const MAX_BARCODE_LENGTH = 100;
const MAX_BARCODES = 20;
const MAX_BULK_LOCATIONS = 500;
const MAX_BULK_PREFIX_LENGTH = 40;
const MAX_BULK_PADDING = 6;
const MAX_IMPORT_ROWS = 500;

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const requiredString = (value, field, maxLength) => {
  if (value === undefined || value === null || typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw badRequest(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
};

// Returns null for empty/null input, the trimmed string otherwise.
const optionalString = (value, field, maxLength) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw badRequest(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) {
    throw badRequest(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
};

const optionalBoolean = (value, field) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") throw badRequest(`${field} must be a boolean`);
  return value;
};

const optionalNonNegativeNumber = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw badRequest(`${field} must be a non-negative number`);
  }
  return parsed;
};

const optionalNonNegativeInteger = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw badRequest(`${field} must be a non-negative integer`);
  }
  return parsed;
};

const requiredPositiveInteger = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return parsed;
};

const validateEnum = (value, field, allowed) => {
  if (!allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value;
};

const validateBarcodes = (barcodes) => {
  if (barcodes === undefined || barcodes === null) return null;
  if (!Array.isArray(barcodes)) {
    throw badRequest("barcodes must be an array of strings");
  }
  if (barcodes.length > MAX_BARCODES) {
    throw badRequest(`barcodes must contain at most ${MAX_BARCODES} entries`);
  }
  return barcodes.map((barcode, i) => {
    if (typeof barcode !== "string" || barcode.trim().length === 0) {
      throw badRequest(`barcodes[${i}] must be a non-empty string`);
    }
    if (barcode.length > MAX_BARCODE_LENGTH) {
      throw badRequest(`barcodes[${i}] must be at most ${MAX_BARCODE_LENGTH} characters`);
    }
    return barcode.trim();
  });
};

// ── Warehouses ───────────────────────────────────────────────────────
// Returns normalized fields; in partial mode, omits anything not provided.

const validateWarehousePayload = (payload = {}, { partial = false } = {}) => {
  const result = {};

  if (!partial || payload.code !== undefined) {
    result.code = requiredString(payload.code, "code", MAX_CODE_LENGTH);
  }
  if (!partial || payload.name !== undefined) {
    result.name = requiredString(payload.name, "name", MAX_NAME_LENGTH);
  }
  if (payload.address !== undefined) {
    result.address = optionalString(payload.address, "address", MAX_ADDRESS_LENGTH);
  }
  if (payload.city !== undefined) {
    result.city = optionalString(payload.city, "city", MAX_CITY_LENGTH);
  }
  if (payload.country !== undefined) {
    result.country = optionalString(payload.country, "country", MAX_COUNTRY_LENGTH);
  }
  if (payload.isActive !== undefined) {
    result.isActive = optionalBoolean(payload.isActive, "isActive");
  }

  if (partial && Object.keys(result).length === 0) {
    throw badRequest("At least one field to update is required");
  }
  return result;
};

// ── Zones ────────────────────────────────────────────────────────────

const validateZonePayload = (payload = {}, { partial = false } = {}) => {
  const result = {};

  if (!partial) {
    result.warehouseId = requiredPositiveInteger(payload.warehouseId, "warehouseId");
  }
  if (!partial || payload.name !== undefined) {
    result.name = requiredString(payload.name, "name", MAX_NAME_LENGTH);
  }
  if (!partial || payload.type !== undefined) {
    result.type = validateEnum(payload.type, "type", ZONE_TYPES);
  }
  if (payload.description !== undefined) {
    result.description = optionalString(payload.description, "description", MAX_DESCRIPTION_LENGTH);
  }

  if (partial && Object.keys(result).length === 0) {
    throw badRequest("At least one field to update is required");
  }
  return result;
};

// ── Locations ────────────────────────────────────────────────────────

const validateLocationPayload = (payload = {}, { partial = false } = {}) => {
  const result = {};

  if (!partial) {
    if (!payload.zoneId) throw badRequest("zoneId is required");
    result.zoneId = payload.zoneId;
    result.code = requiredString(payload.code, "code", MAX_CODE_LENGTH);
  } else if (payload.zoneId !== undefined) {
    if (!payload.zoneId) throw badRequest("zoneId cannot be empty");
    result.zoneId = payload.zoneId;
  }
  if (!partial || payload.name !== undefined) {
    result.name = requiredString(payload.name, "name", MAX_NAME_LENGTH);
  }
  if (payload.status !== undefined) {
    result.status = validateEnum(payload.status, "status", LOCATION_STATUSES);
  } else if (!partial) {
    result.status = "active";
  }
  if (payload.type !== undefined) {
    result.type = validateEnum(payload.type, "type", LOCATION_TYPES);
  } else if (!partial) {
    result.type = "rack";
  }
  if (payload.capacity !== undefined) {
    result.capacity = requiredPositiveInteger(payload.capacity, "capacity");
  } else if (!partial) {
    result.capacity = 1000;
  }

  if (partial && Object.keys(result).length === 0) {
    throw badRequest("At least one field to update is required");
  }
  return result;
};

// Expands a prefix + numeric range into location codes, e.g.
// { prefix: "A1-", start: 1, count: 3, padding: 2 } → ["A1-01", "A1-02", "A1-03"]
const buildBulkLocationCodes = ({ prefix, start, count, padding }) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(`${prefix}${String(start + i).padStart(padding, "0")}`);
  }
  return codes;
};

const validateBulkLocationPayload = (payload = {}) => {
  if (!payload.zoneId) throw badRequest("zoneId is required");

  const prefix = requiredString(payload.prefix, "prefix", MAX_BULK_PREFIX_LENGTH);

  const start = payload.start === undefined ? 1 : Number(payload.start);
  if (!Number.isInteger(start) || start < 0) {
    throw badRequest("start must be a non-negative integer");
  }

  const count = Number(payload.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BULK_LOCATIONS) {
    throw badRequest(`count must be an integer between 1 and ${MAX_BULK_LOCATIONS}`);
  }

  const padding = payload.padding === undefined ? 0 : Number(payload.padding);
  if (!Number.isInteger(padding) || padding < 0 || padding > MAX_BULK_PADDING) {
    throw badRequest(`padding must be an integer between 0 and ${MAX_BULK_PADDING}`);
  }

  const status = payload.status === undefined
    ? "active"
    : validateEnum(payload.status, "status", LOCATION_STATUSES);
  const type = payload.type === undefined
    ? "rack"
    : validateEnum(payload.type, "type", LOCATION_TYPES);
  const capacity = payload.capacity === undefined
    ? 1000
    : requiredPositiveInteger(payload.capacity, "capacity");

  return {
    zoneId: payload.zoneId,
    status,
    type,
    capacity,
    codes: buildBulkLocationCodes({ prefix, start, count, padding })
  };
};

// ── SKUs ─────────────────────────────────────────────────────────────

const validateSkuPayload = (payload = {}, { partial = false } = {}) => {
  const result = {};

  if (!partial) {
    result.sku = requiredString(payload.sku, "sku", MAX_SKU_LENGTH);
  }
  if (payload.description !== undefined) {
    result.description = optionalString(payload.description, "description", MAX_DESCRIPTION_LENGTH);
  }
  if (payload.unitOfMeasure !== undefined) {
    result.unitOfMeasure = optionalString(payload.unitOfMeasure, "unitOfMeasure", MAX_UOM_LENGTH) || "each";
  } else if (!partial) {
    result.unitOfMeasure = "each";
  }
  if (payload.category !== undefined) {
    result.category = optionalString(payload.category, "category", MAX_CATEGORY_LENGTH);
  }
  if (payload.weightKg !== undefined) {
    result.weightKg = optionalNonNegativeNumber(payload.weightKg, "weightKg");
  }
  if (payload.dimensionXCm !== undefined) {
    result.dimensionXCm = optionalNonNegativeNumber(payload.dimensionXCm, "dimensionXCm");
  }
  if (payload.dimensionYCm !== undefined) {
    result.dimensionYCm = optionalNonNegativeNumber(payload.dimensionYCm, "dimensionYCm");
  }
  if (payload.dimensionZCm !== undefined) {
    result.dimensionZCm = optionalNonNegativeNumber(payload.dimensionZCm, "dimensionZCm");
  }
  if (payload.pictureUrl !== undefined) {
    result.pictureUrl = optionalString(payload.pictureUrl, "pictureUrl", MAX_PICTURE_URL_LENGTH);
  }
  if (payload.barcodes !== undefined) {
    result.barcodes = validateBarcodes(payload.barcodes);
  }
  if (payload.minStockLevel !== undefined) {
    result.minStockLevel = optionalNonNegativeInteger(payload.minStockLevel, "minStockLevel");
  }
  if (payload.maxStockLevel !== undefined) {
    result.maxStockLevel = optionalNonNegativeInteger(payload.maxStockLevel, "maxStockLevel");
  }
  if (
    result.minStockLevel != null &&
    result.maxStockLevel != null &&
    result.minStockLevel > result.maxStockLevel
  ) {
    throw badRequest("minStockLevel cannot be greater than maxStockLevel");
  }
  if (payload.isActive !== undefined) {
    result.isActive = optionalBoolean(payload.isActive, "isActive");
  }

  if (partial && Object.keys(result).length === 0) {
    throw badRequest("At least one field to update is required");
  }
  return result;
};

// Validates a batch of SKU import rows. Never throws for per-row issues —
// returns { valid: [{ row, index }], errors: [{ index, sku, message }] }.
const validateSkuImportRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw badRequest("skus must be a non-empty array");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw badRequest(`skus must contain at most ${MAX_IMPORT_ROWS} rows`);
  }

  const valid = [];
  const errors = [];
  const seen = new Set();

  rows.forEach((row, index) => {
    try {
      const normalized = validateSkuPayload(row, { partial: false });
      if (seen.has(normalized.sku)) {
        throw badRequest(`duplicate sku "${normalized.sku}" in import batch`);
      }
      seen.add(normalized.sku);
      valid.push({ row: normalized, index });
    } catch (error) {
      errors.push({ index, sku: row?.sku ?? null, message: error.message });
    }
  });

  return { valid, errors };
};

module.exports = {
  ZONE_TYPES,
  LOCATION_TYPES,
  LOCATION_STATUSES,
  MAX_BULK_LOCATIONS,
  MAX_IMPORT_ROWS,
  validateWarehousePayload,
  validateZonePayload,
  validateLocationPayload,
  buildBulkLocationCodes,
  validateBulkLocationPayload,
  validateSkuPayload,
  validateSkuImportRows
};
