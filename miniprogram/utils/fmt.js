function fmt(value, digits = 1) {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  return value.toFixed(digits);
}

module.exports = { fmt };
