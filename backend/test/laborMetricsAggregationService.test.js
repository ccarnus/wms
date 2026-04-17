const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateUtilizationPercent,
  parseAggregationDate
} = require("../src/services/laborMetricsAggregationUtils");

test("calculateUtilizationPercent rounds to 2 decimals and clamps to 100", () => {
  assert.equal(calculateUtilizationPercent(3600, 28800), 12.5);
  assert.equal(calculateUtilizationPercent(999999, 28800), 100);
});

test("calculateUtilizationPercent returns 0 for invalid or zero shift duration", () => {
  assert.equal(calculateUtilizationPercent(1000, 0), 0);
  assert.equal(calculateUtilizationPercent(1000, -1), 0);
});

test("parseAggregationDate accepts valid ISO date and rejects invalid dates", () => {
  assert.equal(parseAggregationDate("2026-02-25"), "2026-02-25");
  assert.throws(() => parseAggregationDate("2026-02-30"), /valid calendar date/);
  assert.throws(() => parseAggregationDate("25-02-2026"), /YYYY-MM-DD/);
});
