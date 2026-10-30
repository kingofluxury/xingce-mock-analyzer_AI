var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// app/public/shared/index.js
var index_exports = {};
__export(index_exports, {
  AppError: () => AppError,
  ConflictError: () => ConflictError,
  DEFAULT_PAPER_TYPE_ID: () => DEFAULT_PAPER_TYPE_ID,
  NotFoundError: () => NotFoundError,
  PAPER_TYPES: () => PAPER_TYPES,
  SUBTYPES: () => SUBTYPES,
  SUBTYPE_BY_ID: () => SUBTYPE_BY_ID,
  ValidationError: () => ValidationError,
  compactRows: () => compactRows,
  diagnose: () => diagnose,
  modulesOf: () => modulesOf,
  normalizeExam: () => normalizeExam,
  paperTypeById: () => paperTypeById,
  paperTypeLabel: () => paperTypeLabel,
  parseId: () => parseId,
  round1: () => round1,
  scoreOf: () => scoreOf,
  subtypesOf: () => subtypesOf,
  summarize: () => summarize,
  tenthsOf: () => tenthsOf,
  totalsOf: () => totalsOf,
  verdictOf: () => verdictOf
});
module.exports = __toCommonJS(index_exports);

// app/public/shared/domain.js
var PAPER_TYPES = [
  { id: 1, examType: "\u6C5F\u82CF", paperName: "A/B\u7C7B" },
  { id: 2, examType: "\u6C5F\u82CF", paperName: "C\u7C7B" },
  { id: 3, examType: "\u56FD\u8003", paperName: "\u526F\u7701\u7EA7" },
  { id: 4, examType: "\u56FD\u8003", paperName: "\u5730\u5E02\u7EA7/\u884C\u653F\u6267\u6CD5\u7C7B" }
];
var DEFAULT_PAPER_TYPE_ID = 1;
function s(id, paperTypeId, module2, name, qty, pts) {
  return { id, paperTypeId, module: module2, name, qty, pts };
}
var SUBTYPES = [
  s(1, 1, "\u653F\u6CBB\u7406\u8BBA", "\u653F\u6CBB\u7406\u8BBA", 10, 0.7),
  s(2, 1, "\u5E38\u8BC6\u5224\u65AD", "\u5E38\u8BC6\u5224\u65AD", 10, 0.6),
  s(3, 1, "\u8A00\u8BED\u7406\u89E3", "\u7247\u6BB5\u9605\u8BFB", 15, 0.7),
  s(4, 1, "\u8A00\u8BED\u7406\u89E3", "\u9009\u8BCD\u586B\u7A7A", 10, 0.5),
  s(5, 1, "\u8A00\u8BED\u7406\u89E3", "\u6587\u7AE0\u9605\u8BFB", 5, 0.7),
  s(6, 1, "\u6570\u91CF\u5173\u7CFB", "\u6570\u5B57\u63A8\u7406", 5, 0.7),
  s(7, 1, "\u6570\u91CF\u5173\u7CFB", "\u6570\u5B57\u8FD0\u7B97", 15, 0.9),
  s(8, 1, "\u5224\u65AD\u63A8\u7406", "\u7C7B\u6BD4\u63A8\u7406", 10, 0.5),
  s(9, 1, "\u5224\u65AD\u63A8\u7406", "\u56FE\u5F62\u63A8\u7406", 10, 0.8),
  s(10, 1, "\u5224\u65AD\u63A8\u7406", "\u903B\u8F91\u5224\u65AD", 15, 0.8),
  s(11, 1, "\u5224\u65AD\u63A8\u7406", "\u5B9A\u4E49\u5224\u65AD", 10, 0.8),
  s(12, 1, "\u8D44\u6599\u5206\u6790", "\u8D44\u6599\u5206\u6790", 20, 0.9),
  s(13, 2, "\u653F\u6CBB\u7406\u8BBA", "\u653F\u6CBB\u7406\u8BBA", 10, 0.8),
  s(14, 2, "\u5E38\u8BC6\u5224\u65AD", "\u5E38\u8BC6\u5224\u65AD", 10, 0.7),
  s(15, 2, "\u8A00\u8BED\u7406\u89E3", "\u7247\u6BB5\u9605\u8BFB", 15, 0.7),
  s(16, 2, "\u8A00\u8BED\u7406\u89E3", "\u9009\u8BCD\u586B\u7A7A", 10, 0.6),
  s(17, 2, "\u8A00\u8BED\u7406\u89E3", "\u6587\u7AE0\u9605\u8BFB", 5, 0.8),
  s(18, 2, "\u6570\u91CF\u5173\u7CFB", "\u6570\u5B57\u63A8\u7406", 5, 0.7),
  s(19, 2, "\u6570\u91CF\u5173\u7CFB", "\u6570\u5B57\u8FD0\u7B97", 15, 0.8),
  s(20, 2, "\u5224\u65AD\u63A8\u7406", "\u7C7B\u6BD4\u63A8\u7406", 10, 0.7),
  s(21, 2, "\u5224\u65AD\u63A8\u7406", "\u56FE\u5F62\u63A8\u7406", 10, 0.8),
  s(22, 2, "\u5224\u65AD\u63A8\u7406", "\u903B\u8F91\u5224\u65AD", 10, 0.8),
  s(23, 2, "\u5224\u65AD\u63A8\u7406", "\u5B9A\u4E49\u5224\u65AD", 10, 0.8),
  s(24, 2, "\u8D44\u6599\u5206\u6790", "\u8D44\u6599\u5206\u6790", 20, 0.9),
  s(25, 3, "\u653F\u6CBB\u7406\u8BBA", "\u653F\u6CBB\u7406\u8BBA", 20, 0.5),
  s(26, 3, "\u5E38\u8BC6\u5224\u65AD", "\u5E38\u8BC6\u5224\u65AD", 15, 0.5),
  s(27, 3, "\u8A00\u8BED\u7406\u89E3", "\u8A00\u8BED\u7406\u89E3", 30, 0.8),
  s(28, 3, "\u5224\u65AD\u63A8\u7406", "\u56FE\u5F62\u63A8\u7406", 10, 0.8),
  s(29, 3, "\u5224\u65AD\u63A8\u7406", "\u5B9A\u4E49\u5224\u65AD", 10, 0.8),
  s(30, 3, "\u5224\u65AD\u63A8\u7406", "\u7C7B\u6BD4\u63A8\u7406", 5, 0.8),
  s(31, 3, "\u5224\u65AD\u63A8\u7406", "\u903B\u8F91\u5224\u65AD", 10, 0.85),
  s(32, 3, "\u6570\u91CF\u5173\u7CFB", "\u6570\u91CF\u5173\u7CFB", 10, 1),
  s(33, 3, "\u8D44\u6599\u5206\u6790", "\u8D44\u6599\u5206\u6790", 20, 1),
  s(34, 4, "\u653F\u6CBB\u7406\u8BBA", "\u653F\u6CBB\u7406\u8BBA", 20, 0.5),
  s(35, 4, "\u5E38\u8BC6\u5224\u65AD", "\u5E38\u8BC6\u5224\u65AD", 15, 0.5),
  s(36, 4, "\u8A00\u8BED\u7406\u89E3", "\u8A00\u8BED\u7406\u89E3", 30, 0.8),
  s(37, 4, "\u5224\u65AD\u63A8\u7406", "\u56FE\u5F62\u63A8\u7406", 10, 0.8),
  s(38, 4, "\u5224\u65AD\u63A8\u7406", "\u5B9A\u4E49\u5224\u65AD", 10, 0.7),
  s(39, 4, "\u5224\u65AD\u63A8\u7406", "\u7C7B\u6BD4\u63A8\u7406", 5, 0.7),
  s(40, 4, "\u5224\u65AD\u63A8\u7406", "\u903B\u8F91\u5224\u65AD", 10, 0.8),
  s(41, 4, "\u6570\u91CF\u5173\u7CFB", "\u6570\u91CF\u5173\u7CFB", 15, 0.8),
  s(42, 4, "\u8D44\u6599\u5206\u6790", "\u8D44\u6599\u5206\u6790", 20, 1)
];
var SUBTYPE_BY_ID = new Map(SUBTYPES.map((item) => [item.id, item]));
function tenthsOf(subtype) {
  return Math.round(subtype.pts * 10);
}
function paperTypeById(id) {
  return PAPER_TYPES.find((t) => t.id === Number(id)) || null;
}
function paperTypeLabel(id) {
  const type = paperTypeById(id);
  return type ? type.examType + " \xB7 " + type.paperName : "\u672A\u77E5\u8BD5\u5377";
}
var subtypesCache = /* @__PURE__ */ new Map();
function subtypesOf(paperTypeId) {
  const key = Number(paperTypeId) || DEFAULT_PAPER_TYPE_ID;
  if (!subtypesCache.has(key)) {
    subtypesCache.set(
      key,
      SUBTYPES.filter((item) => item.paperTypeId === key).sort((a, b) => a.id - b.id)
    );
  }
  return subtypesCache.get(key);
}
var moduleCache = /* @__PURE__ */ new Map();
function modulesOf(paperTypeId) {
  const key = Number(paperTypeId) || DEFAULT_PAPER_TYPE_ID;
  if (moduleCache.has(key)) return moduleCache.get(key);
  const order = [];
  const byName = /* @__PURE__ */ new Map();
  for (const item of subtypesOf(key)) {
    if (!byName.has(item.module)) {
      byName.set(item.module, { name: item.module, subtypes: [], qty: 0, tenths: 0 });
      order.push(item.module);
    }
    const mod = byName.get(item.module);
    mod.subtypes.push(item);
    mod.qty += item.qty;
    mod.tenths += item.qty * tenthsOf(item);
  }
  const modules = order.map((name) => {
    const mod = byName.get(name);
    return { name, subtypes: mod.subtypes, qty: mod.qty, full: mod.tenths / 10 };
  });
  moduleCache.set(key, modules);
  return modules;
}
var totalsCache = /* @__PURE__ */ new Map();
function totalsOf(paperTypeId) {
  const key = Number(paperTypeId) || DEFAULT_PAPER_TYPE_ID;
  if (!totalsCache.has(key)) {
    const list = subtypesOf(key);
    totalsCache.set(key, {
      qty: list.reduce((sum, item) => sum + item.qty, 0),
      full: Math.round(list.reduce((sum, item) => sum + item.qty * tenthsOf(item), 0)) / 10
    });
  }
  return totalsCache.get(key);
}

// app/public/shared/metrics.js
function round1(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}
function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function pick(items, id) {
  var _a, _b;
  if (!items) return null;
  if (items instanceof Map) return (_a = items.get(id)) != null ? _a : null;
  return (_b = items[id]) != null ? _b : null;
}
function scoreOf(subtype, correct) {
  const c = num(correct);
  if (c === null) return null;
  return round1(c * tenthsOf(subtype) / 10);
}
function moduleList(subtypes) {
  const order = [];
  const byName = /* @__PURE__ */ new Map();
  for (const s2 of subtypes) {
    if (!byName.has(s2.module)) {
      byName.set(s2.module, { name: s2.module, qty: 0, tenths: 0 });
      order.push(s2.module);
    }
    const m = byName.get(s2.module);
    m.qty += s2.qty;
    m.tenths += s2.qty * tenthsOf(s2);
  }
  return order.map((name) => {
    const m = byName.get(name);
    return { name, qty: m.qty, full: m.tenths / 10 };
  });
}
function summarize(items, subtypes = subtypesOf(DEFAULT_PAPER_TYPE_ID)) {
  var _a;
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
  for (const s2 of subtypes) {
    const it = (_a = pick(items, s2.id)) != null ? _a : {};
    const correct = num(it.correct);
    const minutes = num(it.minutes);
    const score = correct === null ? null : scoreOf(s2, correct);
    const pct = correct === null ? null : correct / s2.qty;
    const avgSec = minutes === null ? null : round1(minutes * 60 / s2.qty);
    subs[s2.id] = { correct, minutes, score, pct, avgSec };
    const m = moduleAcc.get(s2.module);
    m.qty += s2.qty;
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
      pct: a.hasScore && a.qty > 0 ? a.correct / a.qty : null
    };
  });
  return {
    subs,
    modules: moduleRows,
    totals: {
      correct: missingCorrect === 0 ? totalCorrect : null,
      score: missingCorrect === 0 ? round1(totalScore) : null,
      minutes: missingMinutes === 0 ? round1(totalMinutes) : null,
      pct: missingCorrect === 0 ? totalCorrect / subtypes.reduce((t, s2) => t + s2.qty, 0) : null,
      missingCorrect,
      missingMinutes
    }
  };
}
function diagnose(priorAttempts, subtypes = subtypesOf(DEFAULT_PAPER_TYPE_ID), window = 5) {
  var _a;
  if (!Array.isArray(priorAttempts) || priorAttempts.length === 0) return null;
  const recent = priorAttempts.slice(-window);
  let pooledCorrect = 0;
  let pooledQty = 0;
  for (const items of recent) {
    for (const s2 of subtypes) {
      const it = pick(items, s2.id);
      const c = num(it == null ? void 0 : it.correct);
      if (c !== null) {
        pooledCorrect += c;
        pooledQty += s2.qty;
      }
    }
  }
  const pooled = pooledQty > 0 ? pooledCorrect / pooledQty : null;
  if (pooled === null) return null;
  let expected = 0;
  let variance = 0;
  let observed = 0;
  for (const s2 of subtypes) {
    const rates = [];
    for (const items of recent) {
      const c = num((_a = pick(items, s2.id)) == null ? void 0 : _a.correct);
      if (c !== null) rates.push(c / s2.qty);
    }
    const p = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : pooled;
    if (rates.length > 0) observed += 1;
    const unit = tenthsOf(s2) / 10;
    expected += s2.qty * p * unit;
    variance += unit * unit * s2.qty * p * (1 - p);
  }
  return {
    expected: round1(expected),
    se: round1(Math.sqrt(Math.max(variance, 0))),
    window,
    observed
  };
}
function verdictOf(delta, se) {
  const d = num(delta);
  const s2 = num(se);
  if (d === null || s2 === null) return null;
  const tol = Math.max(s2, 0.05);
  if (Math.abs(d) <= tol) return "normal";
  return d < 0 ? "low" : "high";
}
function compactRows(exams, window = 5) {
  var _a;
  const rows = [];
  const historyByType = /* @__PURE__ */ new Map();
  for (const exam of exams) {
    const paperTypeId = Number(exam.paperTypeId) || DEFAULT_PAPER_TYPE_ID;
    const subtypes = subtypesOf(paperTypeId);
    const items = /* @__PURE__ */ new Map();
    for (const it of exam.items) items.set(it.subtypeId, { correct: it.correct, minutes: it.minutes });
    const s2 = summarize(items, subtypes);
    const history = historyByType.get(paperTypeId) || [];
    const d = diagnose(history, subtypes, window);
    const delta = d && s2.totals.score !== null ? round1(s2.totals.score - d.expected) : null;
    rows.push({
      id: exam.id,
      seq: exam.seq,
      name: (_a = exam.name) != null ? _a : null,
      paperTypeId,
      date: exam.date,
      note: exam.note,
      subs: s2.subs,
      modules: s2.modules,
      totals: s2.totals,
      diagnosis: d ? { expected: d.expected, se: d.se, delta, verdict: verdictOf(delta, d.se), window: d.window, observed: d.observed } : null
    });
    history.push(items);
    historyByType.set(paperTypeId, history);
  }
  return rows;
}

// app/public/shared/errors.js
var AppError = class extends Error {
  constructor(message, { status = 500, details = [], expose = false } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
    this.expose = expose;
  }
};
var ValidationError = class extends AppError {
  constructor(message, details = []) {
    super(message, { status: 400, details, expose: true });
    this.name = "ValidationError";
  }
};
var NotFoundError = class extends AppError {
  constructor(message = "\u8BB0\u5F55\u4E0D\u5B58\u5728") {
    super(message, { status: 404, expose: true });
    this.name = "NotFoundError";
  }
};
var ConflictError = class extends AppError {
  constructor(message) {
    super(message, { status: 409, expose: true });
    this.name = "ConflictError";
  }
};

// app/public/shared/validate.js
function parseId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError("\u65E0\u6548\u7684\u8BB0\u5F55 ID");
  return n;
}
function asNumber(value) {
  if (value === null || value === void 0 || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : NaN;
}
function cleanText(value, max) {
  if (value === null || value === void 0) return null;
  if (typeof value !== "string") return null;
  const s2 = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  if (!s2) return null;
  return s2.length > max ? s2.slice(0, max) : s2;
}
function cleanDate(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("\u65E5\u671F\u683C\u5F0F\u5E94\u4E3A YYYY-MM-DD");
  }
  const d = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new ValidationError("\u65E5\u671F\u4E0D\u5B58\u5728");
  }
  return value;
}
function normalizeExam(body, subtypes) {
  var _a, _b;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
  }
  let paperTypeId = 1;
  if (body.paperTypeId !== void 0 && body.paperTypeId !== null && body.paperTypeId !== "") {
    paperTypeId = Number(body.paperTypeId);
    if (!Number.isInteger(paperTypeId) || paperTypeId < 1) {
      throw new ValidationError("\u8003\u8BD5\u7C7B\u578B\u65E0\u6548");
    }
  }
  let seq = null;
  if (body.seq !== void 0 && body.seq !== null && body.seq !== "") {
    const n = asNumber(body.seq);
    if (!Number.isInteger(n) || n < 1 || n > 9999) {
      throw new ValidationError("\u6B21\u6570\u5E94\u4E3A 1\u20139999 \u7684\u6574\u6570");
    }
    seq = n;
  }
  const name = cleanText(body.name, 60);
  const date = cleanDate(body.date);
  const note = cleanText(body.note, 200);
  if (!Array.isArray(body.items)) {
    throw new ValidationError("items \u5FC5\u987B\u662F\u6570\u7EC4");
  }
  const known = new Map(subtypes.map((s2) => [s2.id, s2]));
  const seen = /* @__PURE__ */ new Set();
  const items = [];
  const errors = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") {
      errors.push("items \u4E2D\u5B58\u5728\u975E\u5BF9\u8C61\u9879");
      continue;
    }
    const id = asNumber((_a = raw.subtypeId) != null ? _a : raw.id);
    if (!Number.isInteger(id) || !known.has(id)) {
      errors.push(`\u672A\u77E5\u7684\u9898\u578B ID\uFF1A${(_b = raw.subtypeId) != null ? _b : raw.id}`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`\u9898\u578B\u300C${known.get(id).name}\u300D\u91CD\u590D\u63D0\u4EA4`);
      continue;
    }
    seen.add(id);
    const subtype = known.get(id);
    const correct = asNumber(raw.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct > subtype.qty) {
      errors.push(`\u300C${subtype.name}\u300D\u7B54\u5BF9\u6570\u5E94\u4E3A 0\u2013${subtype.qty} \u7684\u6574\u6570`);
      continue;
    }
    let minutes = asNumber(raw.minutes);
    if (Number.isNaN(minutes)) {
      errors.push(`\u300C${subtype.name}\u300D\u7528\u65F6\u5FC5\u987B\u662F\u6570\u5B57`);
      continue;
    }
    if (minutes !== null && (minutes < 0 || minutes > 600)) {
      errors.push(`\u300C${subtype.name}\u300D\u7528\u65F6\u5E94\u4E3A 0\u2013600 \u5206\u949F`);
      continue;
    }
    if (minutes !== null) minutes = Math.round(minutes * 100) / 100;
    items.push({ subtypeId: id, correct, minutes });
  }
  const missing = subtypes.filter((s2) => !seen.has(s2.id));
  if (missing.length > 0) {
    errors.push(`\u7F3A\u5C11\u9898\u578B\uFF1A${missing.map((s2) => s2.name).join("\u3001")}`);
  }
  if (errors.length > 0) {
    throw new ValidationError(errors[0], errors);
  }
  return { paperTypeId, seq, name, date, note, items };
}
