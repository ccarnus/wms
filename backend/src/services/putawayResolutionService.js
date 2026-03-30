/**
 * WMS Putaway Resolution Service
 *
 * Resolves destination locations for purchase order lines based on strategy.
 * The WMS owns location assignment — callers only specify SKU + quantity + strategy.
 *
 * Strategies:
 *  - RANDOM:        Place into any active location that has existing inventory (any SKU).
 *  - CONSOLIDATION: Place into a location that already holds the same SKU.
 *  - EMPTY:         Place into a location that currently has no inventory.
 *
 * All strategies only consider active locations in bulk or staging zones
 * (putaway destinations, not pick zones). Locations must have sufficient
 * remaining capacity (capacity - current stock >= requested quantity).
 */

const { PUTAWAY_STRATEGIES } = require("./taskGenerationLogic");

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * CONSOLIDATION: find an active location that already holds the same SKU
 * and has enough remaining capacity for the requested quantity.
 * Prefers the location with the most existing stock of that SKU.
 */
const findConsolidationLocation = async (client, skuId, quantity) => {
  const { rows } = await client.query(
    `SELECT
       i.location_id,
       l.zone_id,
       l.capacity,
       i.quantity AS current_quantity,
       (l.capacity - COALESCE(loc_total.total, 0)) AS remaining_capacity
     FROM inventory i
     JOIN locations l ON l.id = i.location_id AND l.status = 'active'
     JOIN zones z ON z.id = l.zone_id AND z.type IN ('bulk', 'staging')
     LEFT JOIN LATERAL (
       SELECT SUM(inv.quantity) AS total
       FROM inventory inv
       WHERE inv.location_id = i.location_id
     ) loc_total ON TRUE
     WHERE i.sku_id = $1
       AND (l.capacity - COALESCE(loc_total.total, 0)) >= $2
     ORDER BY i.quantity DESC
     LIMIT 1`,
    [skuId, quantity]
  );

  if (rows.length > 0) {
    return {
      locationId: Number(rows[0].location_id),
      zoneId: rows[0].zone_id
    };
  }
  return null;
};

/**
 * RANDOM: find any active location that has existing inventory (any SKU)
 * and has enough remaining capacity.
 * Prefers the location with the most remaining capacity.
 */
const findRandomLocation = async (client, quantity) => {
  const { rows } = await client.query(
    `SELECT
       l.id AS location_id,
       l.zone_id,
       l.capacity,
       (l.capacity - COALESCE(loc_total.total, 0)) AS remaining_capacity
     FROM locations l
     JOIN zones z ON z.id = l.zone_id AND z.type IN ('bulk', 'staging')
     LEFT JOIN LATERAL (
       SELECT SUM(inv.quantity) AS total
       FROM inventory inv
       WHERE inv.location_id = l.id
     ) loc_total ON TRUE
     WHERE l.status = 'active'
       AND EXISTS (SELECT 1 FROM inventory inv WHERE inv.location_id = l.id AND inv.quantity > 0)
       AND (l.capacity - COALESCE(loc_total.total, 0)) >= $1
     ORDER BY (l.capacity - COALESCE(loc_total.total, 0)) DESC
     LIMIT 1`,
    [quantity]
  );

  if (rows.length > 0) {
    return {
      locationId: Number(rows[0].location_id),
      zoneId: rows[0].zone_id
    };
  }
  return null;
};

/**
 * EMPTY: find an active location with zero inventory.
 * Prefers the location with the highest capacity.
 */
const findEmptyLocation = async (client, quantity) => {
  const { rows } = await client.query(
    `SELECT
       l.id AS location_id,
       l.zone_id,
       l.capacity
     FROM locations l
     JOIN zones z ON z.id = l.zone_id AND z.type IN ('bulk', 'staging')
     WHERE l.status = 'active'
       AND l.capacity >= $1
       AND NOT EXISTS (
         SELECT 1 FROM inventory inv
         WHERE inv.location_id = l.id AND inv.quantity > 0
       )
     ORDER BY l.capacity DESC
     LIMIT 1`,
    [quantity]
  );

  if (rows.length > 0) {
    return {
      locationId: Number(rows[0].location_id),
      zoneId: rows[0].zone_id
    };
  }
  return null;
};

/**
 * Fallback: find any active location with enough remaining capacity,
 * regardless of current inventory. Used when the primary strategy
 * finds no suitable location.
 */
const findAnyAvailableLocation = async (client, quantity) => {
  const { rows } = await client.query(
    `SELECT
       l.id AS location_id,
       l.zone_id,
       l.capacity,
       (l.capacity - COALESCE(loc_total.total, 0)) AS remaining_capacity
     FROM locations l
     JOIN zones z ON z.id = l.zone_id AND z.type IN ('bulk', 'staging')
     LEFT JOIN LATERAL (
       SELECT SUM(inv.quantity) AS total
       FROM inventory inv
       WHERE inv.location_id = l.id
     ) loc_total ON TRUE
     WHERE l.status = 'active'
       AND (l.capacity - COALESCE(loc_total.total, 0)) >= $1
     ORDER BY (l.capacity - COALESCE(loc_total.total, 0)) DESC
     LIMIT 1`,
    [quantity]
  );

  if (rows.length > 0) {
    return {
      locationId: Number(rows[0].location_id),
      zoneId: rows[0].zone_id
    };
  }
  return null;
};

/**
 * Resolve a single line using the given strategy, with fallback.
 */
const resolveLineLocation = async (client, strategy, skuId, quantity) => {
  let result = null;

  if (strategy === PUTAWAY_STRATEGIES.CONSOLIDATION) {
    result = await findConsolidationLocation(client, skuId, quantity);
  } else if (strategy === PUTAWAY_STRATEGIES.RANDOM) {
    result = await findRandomLocation(client, quantity);
  } else if (strategy === PUTAWAY_STRATEGIES.EMPTY) {
    result = await findEmptyLocation(client, quantity);
  }

  // Fallback: if preferred strategy found nothing, try any available location
  if (!result) {
    result = await findAnyAvailableLocation(client, quantity);
  }

  return result;
};

/**
 * Resolve destination locations for all lines of a purchase order.
 *
 * Returns {
 *   allResolved: boolean,
 *   lines: [{ skuId, quantity, destinationLocationId, zoneId, status }]
 * }
 */
const resolvePutawayLocations = async (client, eventLines, strategy) => {
  const resolvedLines = [];
  let allResolved = true;

  for (const line of eventLines) {
    const result = await resolveLineLocation(client, strategy, line.skuId, line.quantity);

    if (result) {
      resolvedLines.push({
        skuId: line.skuId,
        quantity: line.quantity,
        destinationLocationId: result.locationId,
        zoneId: result.zoneId,
        status: "resolved"
      });
    } else {
      resolvedLines.push({
        skuId: line.skuId,
        quantity: line.quantity,
        destinationLocationId: null,
        zoneId: null,
        status: "no_capacity"
      });
      allResolved = false;
    }
  }

  return { allResolved, lines: resolvedLines };
};

module.exports = {
  resolvePutawayLocations,
  findConsolidationLocation,
  findRandomLocation,
  findEmptyLocation,
  findAnyAvailableLocation
};
