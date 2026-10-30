import { moduleList } from "./tiku-map.js";

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export function practiceModuleStats(records, modules = moduleList()) {
  const acc = new Map(modules.map((m) => [m, { module: m, qty: 0, correct: 0 }]));
  for (const r of Array.isArray(records) ? records : []) {
    const mod = acc.get(r?.module);
    if (!mod) continue;
    const correct = Number(r?.correct);
    if (correct !== 0 && correct !== 1) continue;
    mod.qty += 1;
    mod.correct += correct;
  }
  const list = [...acc.values()];
  for (const m of list) m.pct = m.qty > 0 ? m.correct / m.qty : null;
  return list;
}

export function withinDays(records, days = 30, now = new Date()) {
  const cutoff = now.getTime() - days * 86400000;
  return (Array.isArray(records) ? records : []).filter((r) => {
    const t = Date.parse(r?.doneAt ?? "");
    return Number.isFinite(t) && t >= cutoff;
  });
}

export const WEAK_EXAM_THRESHOLD_PTS = 0.05;
export const PRACTICE_GAP = 0.05;

export function classifyModule({ examGapPts, examAvgPct, practicePct }) {
  if (!isNum(practicePct)) return null;
  const examWeak = isNum(examGapPts) && examGapPts > WEAK_EXAM_THRESHOLD_PTS;
  const practiceBelowExam =
    isNum(examAvgPct) && practicePct < examAvgPct - PRACTICE_GAP;
  if (examWeak && practiceBelowExam) return "真薄弱";
  if (examWeak) return "临场问题";
  if (practiceBelowExam) return "练习偏弱";
  return null;
}

export function practiceSummaryRows(records, modules = moduleList()) {
  return practiceModuleStats(records, modules).map((m) => ({
    module: m.module,
    qty: m.qty,
    correct: m.correct,
    pct: m.qty > 0 ? Math.round((m.correct / m.qty) * 1000) / 10 : null,
  }));
}
