const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const SECONDS_PER_DAY = 24 * 60 * 60;

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

const parseTimeToSeconds = (value, fieldName) => {
  const match = typeof value === "string" ? value.match(TIME_PATTERN) : null;
  if (!match) {
    throw new Error(`Invalid ${fieldName} time value '${value}'`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || "0");

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new Error(`Invalid ${fieldName} time value '${value}'`);
  }

  return hour * 3600 + minute * 60 + second;
};

const calculateShiftDurationSeconds = (shiftStart, shiftEnd) => {
  const shiftStartSeconds = parseTimeToSeconds(shiftStart, "shift_start");
  const shiftEndSeconds = parseTimeToSeconds(shiftEnd, "shift_end");

  if (shiftStartSeconds === shiftEndSeconds) {
    return 0;
  }

  if (shiftEndSeconds > shiftStartSeconds) {
    return shiftEndSeconds - shiftStartSeconds;
  }

  return SECONDS_PER_DAY - shiftStartSeconds + shiftEndSeconds;
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
  calculateShiftDurationSeconds,
  calculateUtilizationPercent,
  parseAggregationDate,
  toLocalIsoDate
};
