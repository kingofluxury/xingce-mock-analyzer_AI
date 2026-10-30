import { DEFAULT_PAPER_TYPE_ID, subtypesOf, tenthsOf } from "./domain.js";

export function round1(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pick(items, id) {
  if (!items) return null;
  if (items instanceof Map) return items.get(id) ?? null;
  return items[id] ?? null;
}

export function scoreOf(subtype, correct) {
  const c = num(correct);
  if (c === null) return null;
  return round1((c * tenthsOf(subtype)) / 10);
}

function moduleList(subtypes) {
  const order = [];
  const byName = new Map();
  for (const s of subtypes) {
    if (!byName.has(s.module)) {
      byName.set(s.module, { name: s.module, qty: 0, tenths: 0 });
      order.push(s.module);
    }
    const m = byName.get(s.module);
    m.qty += s.qty;
    m.tenths += s.qty * tenthsOf(s);
  }
  return order.map((name) => {
    const m = byName.get(name);
    return { name, qty: m.qty, full: m.tenths / 10 };
  });
}

export function summarize(items, subtypes = subtypesOf(DEFAULT_PAPER_TYPE_ID)) {
  const subs = {};
  const modules = moduleList(subtypes);
  const moduleAcc = new Map(
    modules.map((m) => [m.name, { correct: 0, qty: 0, score: 0, minutes: 0, known: 0, hasScore: true }])
  );

  let totalCorrect = 0;
  let totalScore = 0;
  let totalMinutes = 0;
  let missingCorrect = 0;
  let missingMinutes = 0;

  for (const s of subtypes) {
    const it = pick(items, s.id) ?? {};
    const correct = num(it.correct);
    const minutes = num(it.minutes);
    const score = correct === null ? null : scoreOf(s, correct);
    const pct = correct === null ? null : correct / s.qty;
    const avgSec = minutes === null ? null : round1((minutes * 60) / s.qty);

    subs[s.id] = { correct, minutes, score, pct, avgSec };

    const m = moduleAcc.get(s.module);
    m.qty += s.qty;
    if (correct === null) {
      missingCorrect += 1;
      m.hasScore = false;
    } else {
      totalCorrect += correct;
      totalScore += score;
      m.correct += correct;
      m.score += score;
    }
    if (minutes === null) missingMinutes += 1;
    else {
      totalMinutes += minutes;
      m.minutes += minutes;
      m.known += 1;
    }
  }

  const moduleRows = modules.map((m) => {
    const a = moduleAcc.get(m.name);
    return {
      name: m.name,
      qty: m.qty,
      full: m.full,
      correct: a.correct,
      score: round1(a.score),
      minutes: a.known > 0 ? round1(a.minutes) : null,
      pct: a.hasScore && a.qty > 0 ? a.correct / a.qty : null,
    };
  });

  return {
    subs,
    modules: moduleRows,
    totals: {
      correct: missingCorrect === 0 ? totalCorrect : null,
      score: missingCorrect === 0 ? round1(totalScore) : null,
      minutes: missingMinutes === 0 ? round1(totalMinutes) : null,
      pct: missingCorrect === 0 ? totalCorrect / subtypes.reduce((t, s) => t + s.qty, 0) : null,
      missingCorrect,
      missingMinutes,
    },
  };
}

export function diagnose(priorAttempts, subtypes = subtypesOf(DEFAULT_PAPER_TYPE_ID), window = 5) {
  if (!Array.isArray(priorAttempts) || priorAttempts.length === 0) return null;

  const recent = priorAttempts.slice(-window);
  let pooledCorrect = 0;
  let pooledQty = 0;
  for (const items of recent) {
    for (const s of subtypes) {
      const it = pick(items, s.id);
      const c = num(it?.correct);
      if (c !== null) {
        pooledCorrect += c;
        pooledQty += s.qty;
      }
    }
  }
  const pooled = pooledQty > 0 ? pooledCorrect / pooledQty : null;
  if (pooled === null) return null;

  let expected = 0;
  let variance = 0;
  let observed = 0;

  for (const s of subtypes) {
    const rates = [];
    for (const items of recent) {
      const c = num(pick(items, s.id)?.correct);
      if (c !== null) rates.push(c / s.qty);
    }
    const p = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : pooled;
    if (rates.length > 0) observed += 1;
    const unit = tenthsOf(s) / 10;
    expected += s.qty * p * unit;
    variance += unit * unit * s.qty * p * (1 - p);
  }

  return {
    expected: round1(expected),
    se: round1(Math.sqrt(Math.max(variance, 0))),
    window,
    observed,
  };
}

export function verdictOf(delta, se) {
  const d = num(delta);
  const s = num(se);
  if (d === null || s === null) return null;
  const tol = Math.max(s, 0.05);
  if (Math.abs(d) <= tol) return "normal";
  return d < 0 ? "low" : "high";
}

export function compactRows(exams, window = 5) {
  const rows = [];
  const historyByType = new Map();

  for (const exam of exams) {
    const paperTypeId = Number(exam.paperTypeId) || DEFAULT_PAPER_TYPE_ID;
    const subtypes = subtypesOf(paperTypeId);
    const items = new Map();
    for (const it of exam.items) items.set(it.subtypeId, { correct: it.correct, minutes: it.minutes });

    const s = summarize(items, subtypes);
    const history = historyByType.get(paperTypeId) || [];
    const d = diagnose(history, subtypes, window);
    const delta = d && s.totals.score !== null ? round1(s.totals.score - d.expected) : null;

    rows.push({
      id: exam.id,
      seq: exam.seq,
      name: exam.name ?? null,
      paperTypeId,
      date: exam.date,
      note: exam.note,
      subs: s.subs,
      modules: s.modules,
      totals: s.totals,
      diagnosis: d
        ? { expected: d.expected, se: d.se, delta, verdict: verdictOf(delta, d.se), window: d.window, observed: d.observed }
        : null,
    });

    history.push(items);
    historyByType.set(paperTypeId, history);
  }
  return rows;
}
