export function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export function round1(v) {
  return isNum(v) ? Math.round(v * 10) / 10 : null;
}

export function fmt(v, digits = 1) {
  if (!isNum(v)) return "—";
  return v.toFixed(digits);
}

export function fmtScore(v) {
  return fmt(v, 1);
}

export function fmtPct(v, digits = 0) {
  if (!isNum(v)) return "—";
  return (v * 100).toFixed(digits) + "%";
}

export function fmtMinutes(v, digits = 0) {
  if (!isNum(v)) return "—";
  return v.toFixed(digits) + " min";
}

export function fmtSeconds(v) {
  if (!isNum(v)) return "—";
  return Math.round(v) + " s";
}

export function scoreOf(correct, pts) {
  if (!isNum(correct)) return null;
  return Math.round(correct * Math.round(pts * 10)) / 10;
}

export function mean(list) {
  const nums = list.filter(isNum);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function stdDev(list) {
  const nums = list.filter(isNum);
  if (nums.length === 0) return null;
  const m = mean(nums);
  return Math.sqrt(nums.reduce((t, v) => t + (v - m) ** 2, 0) / nums.length);
}
