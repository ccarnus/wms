/**
 * WMS Inventory Resolution Service
 *
 * Strategy: for each order line (SKU + qty), find the best pick location
 * from inventory in pick-type zones. Selects the location with the highest
 * available quantity (consolidate picks from fewest locations).
 *
 * If a SKU does not have enough stock across all pick locations, the line
 * is marked as "short" and the order is held until inventory is replenished.
 */

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * For a given SKU, find the best pick location that can fulfill the
 * requested quantity. Returns { locationId, availableQuantity } or null.
 *
 * Strategy: pick from the location with the highest stock (fewest picks
 * needed, reduces travel). Only considers locations in pick-type zones
 * with active status.
 */
const findBestPickLocation = async (client, skuId, requiredQuantity) => {
  const { rows } = await client.query(
    `SELECT
      i.location_id,
      i.quantity AS available_quantity
     FROM inventory i
     JOIN locations l ON l.id = i.location_id AND l.status = 'active'
     JOIN zones z ON z.id = l.zone_id AND z.type = 'pick'
     WHERE i.sku_id = $1
       AND i.quantity >= $2
     ORDER BY i.quantity DESC
     LIMIT 1`,
    [skuId, requiredQuantity]
  );

  if (rows.length > 0) {
    return {
      locationId: Number(rows[0].location_id),
      availableQuantity: Number(rows[0].available_quantity)
    };
  }

  return null;
};

/**
 * Get the total available quantity for a SKU across all pick locations.
 */
const getTotalPickableQuantity = async (client, skuId) => {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(i.quantity), 0)::int AS total
     FROM inventory i
     JOIN locations l ON l.id = i.location_id AND l.status = 'active'
     JOIN zones z ON z.id = l.zone_id AND z.type = 'pick'
     WHERE i.sku_id = $1`,
    [skuId]
  );

  return rows[0]?.total ?? 0;
};

/**
 * Attempt to resolve pick locations for all lines of a sales order.
 *
 * Returns {
 *   allResolved: boolean,
 *   lines: [{ salesOrderLineId, skuId, quantity, pickLocationId | null, availableQuantity, status }]
 * }
 */
const resolvePickLocationsForOrder = async (client, salesOrderLines) => {
  const resolvedLines = [];
  let allResolved = true;

  for (const line of salesOrderLines) {
    const bestLocation = await findBestPickLocation(client, line.sku_id || line.skuId, line.quantity);

    if (bestLocation) {
      resolvedLines.push({
        salesOrderLineId: line.id,
        skuId: line.sku_id || line.skuId,
        quantity: line.quantity,
        pickLocationId: bestLocation.locationId,
        availableQuantity: bestLocation.availableQuantity,
        status: "resolved"
      });
    } else {
      const totalAvailable = await getTotalPickableQuantity(client, line.sku_id || line.skuId);
      resolvedLines.push({
        salesOrderLineId: line.id,
        skuId: line.sku_id || line.skuId,
        quantity: line.quantity,
        pickLocationId: null,
        availableQuantity: totalAvailable,
        status: "short"
      });
      allResolved = false;
    }
  }

  return { allResolved, lines: resolvedLines };
};

module.exports = {
  findBestPickLocation,
  getTotalPickableQuantity,
  resolvePickLocationsForOrder
};
