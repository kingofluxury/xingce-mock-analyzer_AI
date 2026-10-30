import {
  DEFAULT_PAPER_TYPE_ID,
  SUBTYPES,
  PAPER_TYPES,
  modulesOf,
  paperTypeById,
  subtypesOf,
  totalsOf,
} from "../shared/domain.js";
import { compactRows, summarize } from "../shared/metrics.js";
import { normalizeExam } from "../shared/validate.js";
import { sm2Next } from "../shared/sm2.js";
import { chapterToModule, moduleList } from "../shared/tiku-map.js";
import { withinDays, practiceSummaryRows } from "../shared/practice-stats.js";

export const kind = "local";

const DB_NAME = "xingce-analyzer";
const STORE = "exams";
const PRACTICE_STORE = "practice";
const WRONG_STORE = "wrongbook";
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("当前浏览器不支持本地存储"));
      return;
    }
    const timer = setTimeout(() => {
      dbPromise = null;
      reject(new Error("本地存储初始化超时（可能是隐私模式或浏览器限制）"));
    }, 8000);
    const done = (fn, value) => {
      clearTimeout(timer);
      fn(value);
    };
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        os.createIndex("seq", "seq", { unique: false });
        os.createIndex("paperTypeId", "paperTypeId", { unique: false });
      }
      if (!db.objectStoreNames.contains(PRACTICE_STORE)) {
        db.createObjectStore(PRACTICE_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(WRONG_STORE)) {
        db.createObjectStore(WRONG_STORE, { keyPath: "questionId" });
      }
    };
    request.onsuccess = () => done(resolve, request.result);
    request.onerror = () => done(reject, request.error || new Error("无法打开本地数据库"));
    request.onblocked = () => done(reject, new Error("本地数据库被其他标签页占用，请关闭后重试"));
  });
  return dbPromise;
}

function store(db, mode, name = STORE) {
  return db.transaction(name, mode).objectStore(name);
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("本地存储操作失败"));
  });
}

function writeAll(db, records) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    for (const record of records) os.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("写入失败"));
    tx.onabort = () => reject(tx.error || new Error("写入取消"));
  });
}

function mapOf(items) {
  return new Map((items || []).map((it) => [it.subtypeId, it]));
}

async function allExams() {
  const db = await open();
  const rows = await wrap(store(db, "readonly").getAll());
  return (rows || []).map((r) => ({ ...r, paperTypeId: Number(r.paperTypeId) || DEFAULT_PAPER_TYPE_ID }));
}

function typeOf(exam) {
  return paperTypeById(exam.paperTypeId) ? exam.paperTypeId : DEFAULT_PAPER_TYPE_ID;
}

function nextSeqFrom(rows, paperTypeId) {
  const seqs = rows.filter((r) => typeOf(r) === paperTypeId).map((r) => Number(r.seq) || 0);
  return seqs.length === 0 ? 1 : Math.max(...seqs) + 1;
}

export async function meta() {
  const rows = await allExams();
  return {
    defaultPaperTypeId: DEFAULT_PAPER_TYPE_ID,
    paperTypes: PAPER_TYPES.map((type) => ({
      id: type.id,
      examType: type.examType,
      paperName: type.paperName,
      subtypes: subtypesOf(type.id),
      modules: modulesOf(type.id),
      totals: totalsOf(type.id),
      nextSeq: nextSeqFrom(rows, type.id),
    })),
  };
}

export async function listExams() {
  const rows = await allExams();
  return rows
    .sort((a, b) => typeOf(a) - typeOf(b) || a.seq - b.seq)
    .map((e) => ({
      id: e.id,
      paperTypeId: typeOf(e),
      seq: e.seq,
      name: e.name ?? null,
      date: e.date,
      note: e.note,
      totals: summarize(mapOf(e.items), subtypesOf(typeOf(e))).totals,
    }));
}

export async function getExam(id) {
  const db = await open();
  const record = await wrap(store(db, "readonly").get(Number(id)));
  if (!record) return null;
  const paperTypeId = typeOf(record);
  return {
    ...record,
    paperTypeId,
    summary: summarize(mapOf(record.items), subtypesOf(paperTypeId)),
  };
}

export async function createExam(payload) {
  const paperTypeId = Number(payload?.paperTypeId) || DEFAULT_PAPER_TYPE_ID;
  const data = normalizeExam({ ...payload, paperTypeId }, subtypesOf(paperTypeId));
  const db = await open();
  const rows = await allExams();
  const seq = data.seq ?? nextSeqFrom(rows, paperTypeId);
  if (rows.some((r) => typeOf(r) === paperTypeId && r.seq === seq)) {
    throw new Error(`该试卷的第 ${seq} 次已存在`);
  }

  const now = new Date().toISOString();
  const record = {
    paperTypeId,
    seq,
    name: data.name,
    date: data.date,
    note: data.note,
    createdAt: now,
    updatedAt: now,
    items: data.items,
  };
  try {
    const id = await wrap(store(db, "readwrite").add(record));
    return { id, seq };
  } catch (err) {
    if (err?.name === "ConstraintError") throw new Error(`该试卷的第 ${seq} 次已存在`);
    throw err;
  }
}

export async function updateExam(id, payload) {
  const db = await open();
  const record = await wrap(store(db, "readonly").get(Number(id)));
  if (!record) throw new Error("记录不存在");

  const paperTypeId = Number(payload?.paperTypeId) || typeOf(record);
  const data = normalizeExam({ ...payload, paperTypeId }, subtypesOf(paperTypeId));

  const rows = await allExams();
  const seq = data.seq ?? record.seq;
  if (rows.some((r) => r.id !== record.id && typeOf(r) === paperTypeId && r.seq === seq)) {
    throw new Error(`该试卷的第 ${seq} 次已存在`);
  }

  const next = {
    ...record,
    paperTypeId,
    seq,
    name: data.name,
    date: data.date,
    note: data.note,
    updatedAt: new Date().toISOString(),
    items: data.items,
  };
  try {
    await wrap(store(db, "readwrite").put(next));
    return { id: record.id, seq };
  } catch (err) {
    if (err?.name === "ConstraintError") throw new Error(`该试卷的第 ${seq} 次已存在`);
    throw err;
  }
}

export async function deleteExam(id) {
  const db = await open();
  const record = await wrap(store(db, "readonly").get(Number(id)));
  if (!record) throw new Error("记录不存在");
  await wrap(store(db, "readwrite").delete(Number(id)));
  return true;
}

export async function moveExam(id, targetSeq) {
  const rows = await allExams();
  const moving = rows.find((r) => r.id === Number(id));
  if (!moving) throw new Error("记录不存在");

  const target = Number(targetSeq);
  if (!Number.isInteger(target) || target < 1) throw new Error("目标顺序无效");

  const paperTypeId = typeOf(moving);
  const sameType = rows.filter((r) => typeOf(r) === paperTypeId).sort((a, b) => a.seq - b.seq);
  const others = sameType.filter((r) => r.id !== moving.id);
  const index = Math.max(0, Math.min(target - 1, others.length));
  others.splice(index, 0, moving);

  const db = await open();
  const OFFSET = 1000000;
  await writeAll(
    db,
    others.map((r) => ({ ...r, seq: (Number(r.seq) || 0) + OFFSET }))
  );
  await writeAll(db, others.map((r, i) => ({ ...r, seq: i + 1 })));
  return { id: moving.id, seq: index + 1 };
}

export async function stats(paperTypeId = DEFAULT_PAPER_TYPE_ID) {
  const typeId = paperTypeById(paperTypeId) ? Number(paperTypeId) : DEFAULT_PAPER_TYPE_ID;
  const rows = (await allExams())
    .filter((r) => typeOf(r) === typeId)
    .sort((a, b) => a.seq - b.seq);
  return {
    paperTypeId: typeId,
    rows: compactRows(rows),
    modules: modulesOf(typeId),
    totals: totalsOf(typeId),
  };
}

export async function exportAll() {
  const rows = await allExams();
  return {
    app: "xingce-analyzer",
    version: 2,
    exportedAt: new Date().toISOString(),
    subtypes: SUBTYPES,
    exams: rows.map(({ paperTypeId, seq, name, date, note, items }) => ({
      paperTypeId: typeOf({ paperTypeId }),
      seq,
      name,
      date,
      note,
      items,
    })),
  };
}

export const backupFile = null;

export const revealBackups = null;

export async function importExams(payload) {
  if (!payload || !Array.isArray(payload.exams)) throw new Error("备份文件格式不正确");
  const db = await open();
  const rows = await allExams();
  const used = new Map();
  for (const r of rows) {
    const type = typeOf(r);
    if (!used.has(type)) used.set(type, new Set());
    used.get(type).add(r.seq);
  }

  let imported = 0;
  let skipped = 0;

  for (const raw of payload.exams) {
    try {
      const paperTypeId = Number(raw?.paperTypeId) || DEFAULT_PAPER_TYPE_ID;
      const subtypes = subtypesOf(paperTypeId);
      if (subtypes.length === 0) {
        skipped += 1;
        continue;
      }
      const data = normalizeExam(
        {
          paperTypeId,
          seq: raw?.seq ?? null,
          name: raw?.name ?? null,
          date: raw?.date ?? null,
          note: raw?.note ?? null,
          items: raw?.items,
        },
        subtypes
      );
      if (!used.has(paperTypeId)) used.set(paperTypeId, new Set());
      const set = used.get(paperTypeId);

      let seq = data.seq;
      if (seq === null) {
        seq = 1;
        while (set.has(seq)) seq += 1;
      }
      if (set.has(seq)) {
        skipped += 1;
        continue;
      }
      const now = new Date().toISOString();
      await wrap(
        store(db, "readwrite").add({
          paperTypeId,
          seq,
          name: data.name,
          date: data.date,
          note: data.note,
          createdAt: now,
          updatedAt: now,
          items: data.items,
        })
      );
      set.add(seq);
      imported += 1;
    } catch {
      skipped += 1;
    }
  }

  return { imported, skipped };
}

const KNOWN_MODULES = new Set(moduleList());

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

let packPromise = null;

function loadPack() {
  if (!packPromise) {
    packPromise = fetch("data/question-pack.json", { cache: "force-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return packPromise;
}

function toQuestion(item) {
  const options = (item.o || []).map((html, i) => ({
    letter: "ABCDEFGH"[i] || "?",
    html: String(html ?? ""),
  }));
  const idx = Number(item.a);
  return {
    questionId: String(item.id),
    module: item.m || null,
    chapter: null,
    paperId: null,
    paperName: item.p || null,
    contentHtml: String(item.s ?? ""),
    options,
    answerIndex: idx,
    answerLetter: "ABCDEFGH"[idx] || "?",
    analysisHtml: String(item.x ?? ""),
  };
}

function sample(list, n) {
  const pool = list.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export async function tikuStatus() {
  const pack = await loadPack();
  if (!pack) {
    return {
      available: false,
      path: "app/data/tiku.db",
      hint: "网页/手机版读不到本地题库文件；App 版需要内置题库子集（tools/export-question-pack.mjs 生成）",
    };
  }
  return {
    available: true,
    source: "pack",
    path: "内置题库",
    generatedAt: pack.generatedAt ?? null,
    papers: null,
    questions: Array.isArray(pack.questions) ? pack.questions.length : 0,
    modules: pack.counts ?? {},
    unmapped: 0,
  };
}

export async function tikuQuestions({ module = null, limit = 10, ids = null, category = null } = {}) {
  const pack = await loadPack();
  if (!pack || !Array.isArray(pack.questions)) return { available: false, questions: [] };

  if (Array.isArray(ids) && ids.length > 0) {
    const wanted = new Set(ids.map(String));
    return {
      available: true,
      questions: pack.questions.filter((q) => wanted.has(String(q.id))).map(toQuestion),
    };
  }

  let pool = module ? pack.questions.filter((q) => q.m === module) : pack.questions;
  if (category) pool = pool.filter((q) => q.c === category);
  const cap = Math.min(Math.max(Number(limit) || 10, 1), 50);
  return { available: true, questions: sample(pool, cap).map(toQuestion) };
}

export async function aiConfig() {
  return { enabled: false, hint: "AI 复盘需要桌面版（key 存本机数据库）" };
}

export async function saveAiConfig() {
  throw new Error("AI 复盘需要桌面版");
}

export async function aiTest() {
  throw new Error("AI 复盘需要桌面版");
}

export async function aiReview() {
  throw new Error("AI 复盘需要桌面版");
}

async function putWrongFromLapse(db, row, ts) {
  const existing = await wrap(store(db, "readonly", WRONG_STORE).get(row.questionId));
  const today = ts.slice(0, 10);
  if (!existing) {
    await wrap(
      store(db, "readwrite", WRONG_STORE).put({
        questionId: row.questionId,
        module: row.module,
        ease: 2.5,
        intervalDays: 0,
        reps: 0,
        lapses: 1,
        dueAt: today,
        lastDoneAt: ts,
        lastResult: 0,
      })
    );
    return;
  }
  const card = sm2Next(
    {
      ease: existing.ease,
      intervalDays: existing.intervalDays,
      reps: existing.reps,
      lapses: existing.lapses,
    },
    2,
    new Date(ts)
  );
  await wrap(
    store(db, "readwrite", WRONG_STORE).put({
      ...existing,
      ease: card.ease,
      intervalDays: card.intervalDays,
      reps: card.reps,
      lapses: card.lapses,
      dueAt: card.dueAt,
      lastDoneAt: ts,
      lastResult: 0,
    })
  );
}

export async function logPractice(results) {
  const list = Array.isArray(results) ? results : [];
  if (list.length === 0) throw new Error("results 不能为空");
  const db = await open();
  const ts = new Date().toISOString();
  let saved = 0;
  let wrong = 0;
  for (const raw of list) {
    const questionId =
      raw?.questionId === undefined || raw?.questionId === null ? "" : String(raw.questionId);
    if (!questionId) continue;
    let module = typeof raw?.module === "string" ? raw.module : "";
    if (!KNOWN_MODULES.has(module)) module = chapterToModule(raw?.chapter ?? raw?.module);
    if (!module) continue;
    const correct = Number(raw?.correct) === 1 ? 1 : 0;
    const seconds = Number(raw?.seconds);
    await wrap(
      store(db, "readwrite", PRACTICE_STORE).add({
        questionId,
        module,
        correct,
        seconds: Number.isFinite(seconds) && seconds >= 0 ? seconds : null,
        doneAt: typeof raw?.doneAt === "string" && raw.doneAt ? raw.doneAt : ts,
      })
    );
    saved += 1;
    if (correct === 0) {
      wrong += 1;
      await putWrongFromLapse(db, { questionId, module }, ts);
    }
  }
  return { saved, wrong };
}

export async function practiceSummary(days = 30) {
  const windowDays = Number(days) > 0 ? Number(days) : 30;
  const db = await open();
  const rows = (await wrap(store(db, "readonly", PRACTICE_STORE).getAll())) || [];
  return { days: windowDays, modules: practiceSummaryRows(withinDays(rows, windowDays)) };
}

export async function wrongBookStats() {
  const db = await open();
  const rows = (await wrap(store(db, "readonly", WRONG_STORE).getAll())) || [];
  const today = todayStr();
  return { total: rows.length, due: rows.filter((r) => String(r.dueAt) <= today).length };
}

export async function wrongBookDue(limit = 50) {
  const db = await open();
  const rows = (await wrap(store(db, "readonly", WRONG_STORE).getAll())) || [];
  const today = todayStr();
  return rows
    .filter((r) => String(r.dueAt) <= today)
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
    .slice(0, Math.min(Math.max(Number(limit) || 50, 1), 200));
}

export async function reviewWrong(questionId, quality) {
  const id = String(questionId ?? "");
  if (!id) throw new Error("缺少 questionId");
  const q = Number(quality);
  if (!Number.isInteger(q) || q < 0 || q > 5) throw new Error("quality 必须是 0-5 的整数");
  const db = await open();
  const row = await wrap(store(db, "readonly", WRONG_STORE).get(id));
  if (!row) throw new Error("错题本里没有这题");
  const card = sm2Next(
    { ease: row.ease, intervalDays: row.intervalDays, reps: row.reps, lapses: row.lapses },
    q
  );
  const ts = new Date().toISOString();
  await wrap(
    store(db, "readwrite", WRONG_STORE).put({
      ...row,
      ease: card.ease,
      intervalDays: card.intervalDays,
      reps: card.reps,
      lapses: card.lapses,
      dueAt: card.dueAt,
      lastDoneAt: ts,
      lastResult: q >= 3 ? 1 : 0,
    })
  );
  return { questionId: id, ...card };
}
