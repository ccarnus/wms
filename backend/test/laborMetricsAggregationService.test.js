const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseAggregationDate
} = require("../src/services/laborMetricsAggregationUtils");

test("parseAggregationDate accepts valid ISO date and rejects invalid dates", () => {
  assert.equal(parseAggregationDate("2026-02-25"), "2026-02-25");
  assert.throws(() => parseAggregationDate("2026-02-30"), /valid calendar date/);
  assert.throws(() => parseAggregationDate("25-02-2026"), /YYYY-MM-DD/);
});
