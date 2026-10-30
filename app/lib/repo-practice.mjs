import { NotFoundError, ValidationError } from "../public/shared/errors.js";
import { sm2Next } from "../public/shared/sm2.js";
import { chapterToModule, moduleList } from "../public/shared/tiku-map.js";
import { nowISO, withTransaction } from "./db.mjs";

const KNOWN_MODULES = new Set(moduleList());

function normalizePracticeRow(raw, ts) {
  const questionId = raw?.questionId === undefined || raw?.questionId === null ? null : String(raw.questionId);
  if (!questionId) throw new ValidationError("缺少 questionId");
  let module = typeof raw?.module === "string" ? raw.module : "";
  if (!KNOWN_MODULES.has(module)) module = chapterToModule(raw?.chapter ?? raw?.module);
  if (!module) throw new ValidationError("练习记录缺少有效模块");
  const correct = Number(raw?.correct);
  if (correct !== 0 && correct !== 1) throw new ValidationError("correct 必须是 0 或 1");
  const seconds = Number(raw?.seconds);
  return {
    questionId,
    module,
    correct,
    seconds: Number.isFinite(seconds) && seconds >= 0 ? seconds : null,
    doneAt: typeof raw?.doneAt === "string" && raw.doneAt ? raw.doneAt : ts,
  };
}

export function logPractice(db, results) {
  if (!Array.isArray(results) || results.length === 0) throw new ValidationError("results 不能为空");
  const ts = nowISO();
  const rows = results.map((r) => normalizePracticeRow(r, ts));
  return withTransaction(db, () => {
    const insert = db.prepare(
      "INSERT INTO practice (question_id, module, correct, seconds, done_at) VALUES (?, ?, ?, ?, ?)"
    );
    let wrong = 0;
    for (const r of rows) {
      insert.run(r.questionId, r.module, r.correct, r.seconds, r.doneAt);
      if (r.correct === 0) {
        upsertWrongOnLapse(db, r, r.doneAt);
        wrong += 1;
      }
    }
    return { saved: rows.length, wrong };
  });
}

function upsertWrongOnLapse(db, row, ts) {
  const existing = db
    .prepare("SELECT question_id, module, ease, interval_days, reps, lapses FROM wrong_book WHERE question_id = ?")
    .get(row.questionId);
  if (!existing) {
    db.prepare(
      `INSERT INTO wrong_book (question_id, module, ease, interval_days, reps, lapses, due_at, last_done_at, last_result)
       VALUES (?, ?, 2.5, 0, 0, 1, ?, ?, 0)
       ON CONFLICT(question_id) DO UPDATE SET
         lapses = lapses + 1, due_at = excluded.due_at,
         last_done_at = excluded.last_done_at, last_result = 0`
    ).run(row.questionId, row.module, ts.slice(0, 10), ts);
    return;
  }
  const card = sm2Next(
    {
      ease: existing.ease,
      intervalDays: existing.interval_days,
      reps: existing.reps,
      lapses: existing.lapses,
    },
    2,
    new Date(ts)
  );
  db.prepare(
    `UPDATE wrong_book SET ease = ?, interval_days = ?, reps = ?, lapses = ?,
       due_at = ?, last_done_at = ?, last_result = 0
     WHERE question_id = ?`
  ).run(card.ease, card.intervalDays, card.reps, card.lapses, card.dueAt, ts, row.questionId);
}

export function practiceSummary(db, days = 30) {
  const d = Number(days);
  const windowDays = Number.isFinite(d) && d > 0 ? Math.floor(d) : 30;
  const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString();
  const rows = db
    .prepare("SELECT module, COUNT(*) AS qty, SUM(correct) AS correct FROM practice WHERE done_at >= ? GROUP BY module")
    .all(cutoff);
  const byModule = new Map(rows.map((r) => [r.module, { qty: Number(r.qty), correct: Number(r.correct) }]));
  return {
    days: windowDays,
    modules: moduleList().map((m) => {
      const hit = byModule.get(m);
      const qty = hit?.qty ?? 0;
      const correct = hit?.correct ?? 0;
      return { module: m, qty, correct, pct: qty > 0 ? Math.round((correct / qty) * 1000) / 10 : null };
    }),
  };
}

export function wrongBookStats(db) {
  const today = new Date().toISOString().slice(0, 10);
  const total = Number(db.prepare("SELECT COUNT(*) AS n FROM wrong_book").get()?.n ?? 0);
  const due = Number(
    db.prepare("SELECT COUNT(*) AS n FROM wrong_book WHERE due_at <= ?").get(today)?.n ?? 0
  );
  return { total, due };
}

export function wrongBookDue(db, limit = 50) {
  const today = new Date().toISOString().slice(0, 10);
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return db
    .prepare(
      `SELECT question_id, module, ease, interval_days, reps, lapses, due_at, last_done_at, last_result
       FROM wrong_book WHERE due_at <= ? ORDER BY due_at LIMIT ?`
    )
    .all(today, cap)
    .map((r) => ({
      questionId: r.question_id,
      module: r.module,
      ease: Number(r.ease),
      intervalDays: Number(r.interval_days),
      reps: Number(r.reps),
      lapses: Number(r.lapses),
      dueAt: r.due_at,
      lastDoneAt: r.last_done_at,
      lastResult: r.last_result === null ? null : Number(r.last_result),
    }));
}

export function reviewWrong(db, questionId, quality) {
  const id = String(questionId ?? "");
  if (!id) throw new ValidationError("缺少 questionId");
  const q = Number(quality);
  if (!Number.isInteger(q) || q < 0 || q > 5) throw new ValidationError("quality 必须是 0-5 的整数");

  return withTransaction(db, () => {
    const row = db
      .prepare("SELECT ease, interval_days, reps, lapses FROM wrong_book WHERE question_id = ?")
      .get(id);
    if (!row) throw new NotFoundError("错题本里没有这题");
    const card = sm2Next(
      { ease: row.ease, intervalDays: row.interval_days, reps: row.reps, lapses: row.lapses },
      q
    );
    const ts = nowISO();
    db.prepare(
      "UPDATE wrong_book SET ease = ?, interval_days = ?, reps = ?, lapses = ?, due_at = ?, last_done_at = ?, last_result = ? WHERE question_id = ?"
    ).run(card.ease, card.intervalDays, card.reps, card.lapses, card.dueAt, ts, q >= 3 ? 1 : 0, id);
    return { questionId: id, ...card };
  });
}

