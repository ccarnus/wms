const { randomUUID } = require("node:crypto");

const ORDER_EVENT_TYPES = Object.freeze({
  SALES_ORDER_READY_FOR_PICK: "sales_order_ready_for_pick",
  PURCHASE_ORDER_RECEIVED: "purchase_order_received"
});

const DEFAULT_PICK_BASE_TIME_SECONDS = 90;
const DEFAULT_PICK_TIME_PER_UNIT_SECONDS = 12;
const DEFAULT_PUTAWAY_BASE_TIME_SECONDS = 75;
const DEFAULT_PUTAWAY_TIME_PER_UNIT_SECONDS = 10;
const DEFAULT_PUTAWAY_PRIORITY = 60;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parsePositiveInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} must be a positive integer`);
  }
  return parsed;
};

const parseDate = (value, fieldName) => {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid ISO date`);
  }
  return parsed;
};

const calculateEstimatedTimeSeconds = (units, baseTimeSeconds, timePerUnitSeconds) => {
  const safeUnits = parsePositiveInteger(units, "units");
  const safeBaseTimeSeconds = parsePositiveInteger(baseTimeSeconds, "baseTimeSeconds");
  const safeTimePerUnitSeconds = parsePositiveInteger(timePerUnitSeconds, "timePerUnitSeconds");
  return safeBaseTimeSeconds + safeUnits * safeTimePerUnitSeconds;
};

const calculatePickPriority = (shipDate, now = new Date()) => {
  const shipDateValue = parseDate(shipDate, "shipDate");
  const nowValue = parseDate(now, "now");
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilShip = Math.floor((shipDateValue.getTime() - nowValue.getTime()) / msPerDay);

  if (daysUntilShip <= 0) {
    return 100;
  }
  if (daysUntilShip === 1) {
    return 90;
  }
  if (daysUntilShip <= 3) {
    return 70;
  }
  return 50;
};

const createEventKey = (eventType, sourceDocumentId) => {
  const safeEventType = String(eventType || "").trim();
  const safeSourceDocumentId = String(sourceDocumentId || "").trim();
  if (!safeEventType || !safeSourceDocumentId) {
    throw createHttpError(400, "eventType and sourceDocumentId are required to build eventKey");
  }
  return `${safeEventType}:${safeSourceDocumentId}:${randomUUID()}`;
};

const normalizeSalesOrderEvent = (payload) => {
  const salesOrderId = String(payload.salesOrderId || "").trim();
  if (!salesOrderId) {
    throw createHttpError(400, "salesOrderId is required");
  }

  const shipDate = parseDate(payload.shipDate, "shipDate").toISOString();
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    throw createHttpError(400, "lines must be a non-empty array");
  }

  const lines = payload.lines.map((line, index) => {
    const skuId = parsePositiveInteger(line.skuId, `lines[${index}].skuId`);
    const quantity = parsePositiveInteger(line.quantity, `lines[${index}].quantity`);
    const pickLocationId = parsePositiveInteger(
      line.pickLocationId ?? line.fromLocationId,
      `lines[${index}].pickLocationId`
    );

    return {
      skuId,
      quantity,
      pickLocationId
    };
  });

  const sourceDocumentId = `SO:${salesOrderId}`;
  const providedEventKey = payload.eventKey ? String(payload.eventKey).trim() : "";

  return {
    type: ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK,
    sourceDocumentId,
    eventKey:
      providedEventKey || createEventKey(ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK, sourceDocumentId),
    salesOrderId,
    shipDate,
    lines
  };
};

const normalizePurchaseOrderEvent = (payload) => {
  const purchaseOrderId = String(payload.purchaseOrderId || "").trim();
  if (!purchaseOrderId) {
    throw createHttpError(400, "purchaseOrderId is required");
  }

  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    throw createHttpError(400, "lines must be a non-empty array");
  }

  const lines = payload.lines.map((line, index) => {
    const skuId = parsePositiveInteger(line.skuId, `lines[${index}].skuId`);
    const quantity = parsePositiveInteger(line.quantity, `lines[${index}].quantity`);
    const destinationLocationId = parsePositiveInteger(
      line.destinationLocationId ?? line.toLocationId,
      `lines[${index}].destinationLocationId`
    );
    const fromLocationId =
      line.fromLocationId === undefined || line.fromLocationId === null
        ? null
        : parsePositiveInteger(line.fromLocationId, `lines[${index}].fromLocationId`);

    return {
      skuId,
      quantity,
      destinationLocationId,
      fromLocationId
    };
  });

  const sourceDocumentId = `PO:${purchaseOrderId}`;
  const providedEventKey = payload.eventKey ? String(payload.eventKey).trim() : "";

  return {
    type: ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
    sourceDocumentId,
    eventKey:
      providedEventKey || createEventKey(ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED, sourceDocumentId),
    purchaseOrderId,
    receivedAt: payload.receivedAt ? parseDate(payload.receivedAt, "receivedAt").toISOString() : null,
    lines
  };
};

const normalizeTaskGenerationEvent = (payload) => {
  const type = String(payload?.type || "").trim();
  if (!type) {
    throw createHttpError(400, "type is required");
  }

  if (type === ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK) {
    return normalizeSalesOrderEvent(payload);
  }

  if (type === ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED) {
    return normalizePurchaseOrderEvent(payload);
  }

  throw createHttpError(400, `Unsupported event type '${type}'`);
};

const groupLinesByZone = (lines, zoneResolver, locationFieldName) => {
  const grouped = new Map();

  for (const line of lines) {
    const locationId = line[locationFieldName];
    const zoneId = zoneResolver(locationId);
    if (!zoneId) {
      throw createHttpError(400, `No zone mapping found for location ${locationId}`);
    }

    if (!grouped.has(zoneId)) {
      grouped.set(zoneId, []);
    }
    grouped.get(zoneId).push(line);
  }

  return grouped;
};

const buildSalesOrderPickTaskSpecs = (event, zoneResolver, options = {}) => {
  const baseTimeSeconds = parsePositiveInteger(
    options.baseTimeSeconds ?? DEFAULT_PICK_BASE_TIME_SECONDS,
    "baseTimeSeconds"
  );
  const timePerUnitSeconds = parsePositiveInteger(
    options.timePerUnitSeconds ?? DEFAULT_PICK_TIME_PER_UNIT_SECONDS,
    "timePerUnitSeconds"
  );
  const priority = calculatePickPriority(event.shipDate, options.now ?? new Date());

  const groupedByZone = groupLinesByZone(event.lines, zoneResolver, "pickLocationId");
  const taskSpecs = [];

  for (const [zoneId, lines] of groupedByZone.entries()) {
    const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);

    taskSpecs.push({
      type: "pick",
      priority,
      zoneId,
      sourceDocumentId: event.sourceDocumentId,
      estimatedTimeSeconds: calculateEstimatedTimeSeconds(totalUnits, baseTimeSeconds, timePerUnitSeconds),
      lines: lines.map((line) => ({
        skuId: line.skuId,
        fromLocationId: line.pickLocationId,
        toLocationId: null,
        quantity: line.quantity,
        status: "created"
      }))
    });
  }

  return taskSpecs;
};

const buildPurchaseOrderPutawayTaskSpecs = (event, zoneResolver, options = {}) => {
  const baseTimeSeconds = parsePositiveInteger(
    options.baseTimeSeconds ?? DEFAULT_PUTAWAY_BASE_TIME_SECONDS,
    "baseTimeSeconds"
  );
  const timePerUnitSeconds = parsePositiveInteger(
    options.timePerUnitSeconds ?? DEFAULT_PUTAWAY_TIME_PER_UNIT_SECONDS,
    "timePerUnitSeconds"
  );
  const priority = parsePositiveInteger(options.priority ?? DEFAULT_PUTAWAY_PRIORITY, "priority");

  const groupedByZone = groupLinesByZone(event.lines, zoneResolver, "destinationLocationId");
  const taskSpecs = [];

  for (const [zoneId, lines] of groupedByZone.entries()) {
    const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);

    taskSpecs.push({
      type: "putaway",
      priority,
      zoneId,
      sourceDocumentId: event.sourceDocumentId,
      estimatedTimeSeconds: calculateEstimatedTimeSeconds(totalUnits, baseTimeSeconds, timePerUnitSeconds),
      lines: lines.map((line) => ({
        skuId: line.skuId,
        fromLocationId: line.fromLocationId ?? null,
        toLocationId: line.destinationLocationId,
        quantity: line.quantity,
        status: "created"
      }))
    });
  }

  return taskSpecs;
};

module.exports = {
  DEFAULT_PICK_BASE_TIME_SECONDS,
  DEFAULT_PICK_TIME_PER_UNIT_SECONDS,
  DEFAULT_PUTAWAY_BASE_TIME_SECONDS,
  DEFAULT_PUTAWAY_PRIORITY,
  DEFAULT_PUTAWAY_TIME_PER_UNIT_SECONDS,
  ORDER_EVENT_TYPES,
  buildPurchaseOrderPutawayTaskSpecs,
  buildSalesOrderPickTaskSpecs,
  calculateEstimatedTimeSeconds,
  calculatePickPriority,
  createEventKey,
  normalizeTaskGenerationEvent
};
