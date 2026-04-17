const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toLocalIsoDate = (value = new Date()) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Invalid date object");
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseAggregationDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return toLocalIsoDate(new Date());
  }

  if (value instanceof Date) {
    return toLocalIsoDate(value);
  }

  const text = String(value).trim();
  if (!DATE_PATTERN.test(text)) {
    const error = new Error("date must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  const [yearText, monthText, dayText] = text.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    const error = new Error("date must be a valid calendar date");
    error.statusCode = 400;
    throw error;
  }

  return text;
};

const calculateUtilizationPercent = (totalActiveTimeSeconds, shiftDurationSeconds) => {
  const safeActiveTime = Number.isFinite(totalActiveTimeSeconds) ? Math.max(0, totalActiveTimeSeconds) : 0;
  const safeShiftDuration = Number.isFinite(shiftDurationSeconds) ? shiftDurationSeconds : 0;

  if (safeShiftDuration <= 0) {
    return 0;
  }

  const rawPercent = (safeActiveTime / safeShiftDuration) * 100;
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));
  return Number(clampedPercent.toFixed(2));
};

module.exports = {
  calculateUtilizationPercent,
  parseAggregationDate,
  toLocalIsoDate
};
