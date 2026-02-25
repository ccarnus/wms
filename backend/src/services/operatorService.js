const { query } = require("../db");
const { publishRealtimeEvent } = require("../realtime/eventBus");
const { REALTIME_EVENT_TYPES } = require("../realtime/eventTypes");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATOR_STATUSES = Object.freeze(["available", "busy", "offline"]);
const OPERATOR_STATUS_SET = new Set(OPERATOR_STATUSES);

const OPERATOR_SELECT_SQL = `SELECT
  o.id,
  o.name,
  o.role,
  o.status,
  o.shift_start AS "shiftStart",
  o.shift_end AS "shiftEnd",
  o.performance_score AS "performanceScore",
  o.created_at AS "createdAt",
  o.updated_at AS "updatedAt"
FROM operators o`;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertUuid = (value, fieldName) => {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw createHttpError(400, `${fieldName} must be a valid UUID`);
  }
};

const assertOperatorStatus = (value, fieldName = "status") => {
  if (!OPERATOR_STATUS_SET.has(value)) {
    throw createHttpError(400, `${fieldName} must be one of: ${OPERATOR_STATUSES.join(", ")}`);
  }
};

const parsePaginationParams = (page, limit) => {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const safePage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit
  };
};

const listOperators = async ({ status = null, page = 1, limit = 50 } = {}) => {
  const values = [];
  let whereClause = "";

  if (status !== null && status !== undefined) {
    assertOperatorStatus(status, "status");
    values.push(status);
    whereClause = `WHERE o.status = $${values.length}::operator_status`;
  }

  const pagination = parsePaginationParams(page, limit);
  const countResult = await query(
    `SELECT COUNT(*)::int AS total
FROM operators o
${whereClause}`,
    values
  );
  const total = countResult.rows[0]?.total ?? 0;

  const listValues = [...values, pagination.limit, pagination.offset];
  const listResult = await query(
    `${OPERATOR_SELECT_SQL}
${whereClause}
ORDER BY o.name ASC
LIMIT $${listValues.length - 1}
OFFSET $${listValues.length}`,
    listValues
  );

  return {
    items: listResult.rows,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    }
  };
};

const getOperatorById = async (operatorId) => {
  assertUuid(operatorId, "operatorId");

  const { rows } = await query(`${OPERATOR_SELECT_SQL} WHERE o.id = $1`, [operatorId]);
  return rows[0] ?? null;
};

const updateOperatorStatus = async (operatorId, status) => {
  assertUuid(operatorId, "operatorId");
  assertOperatorStatus(status, "status");

  const { rows, rowCount } = await query(
    `WITH current_operator AS (
       SELECT id, status
       FROM operators
       WHERE id = $1
     ),
     updated_operator AS (
       UPDATE operators o
       SET status = $2::operator_status,
           updated_at = NOW()
       FROM current_operator c
       WHERE o.id = c.id
       RETURNING
         o.id,
         o.name,
         o.role,
         o.status,
         o.shift_start AS "shiftStart",
         o.shift_end AS "shiftEnd",
         o.performance_score AS "performanceScore",
         o.created_at AS "createdAt",
         o.updated_at AS "updatedAt",
         c.status AS "previousStatus"
     )
     SELECT * FROM updated_operator`,
    [operatorId, status]
  );

  if (rowCount === 0) {
    throw createHttpError(404, "Operator not found");
  }

  const updatedOperator = rows[0];
  const previousStatus = updatedOperator.previousStatus;
  delete updatedOperator.previousStatus;

  if (previousStatus !== updatedOperator.status) {
    try {
      await publishRealtimeEvent({
        type: REALTIME_EVENT_TYPES.OPERATOR_STATUS_UPDATED,
        payload: {
          operatorId: updatedOperator.id,
          status: updatedOperator.status,
          previousStatus,
          updatedAt: updatedOperator.updatedAt
        }
      });
    } catch (error) {
      console.error("[realtime] Failed to publish operator status event", error);
    }
  }

  return updatedOperator;
};

module.exports = {
  OPERATOR_STATUSES,
  getOperatorById,
  listOperators,
  updateOperatorStatus
};
