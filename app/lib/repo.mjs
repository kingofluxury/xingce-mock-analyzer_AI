import { ConflictError, NotFoundError, ValidationError } from "../public/shared/errors.js";
import { SUBTYPES, subtypesOf } from "../public/shared/domain.js";
import { normalizeExam } from "../public/shared/validate.js";
import { nowISO, withTransaction } from "./db.mjs";

function mapItem(row) {
  return {
    subtypeId: Number(row.subtype_id),
    correct: Number(row.correct),
    minutes: row.minutes === null || row.minutes === undefined ? null : Number(row.minutes),
  };
}

function mapExam(row) {
  return {
    id: Number(row.id),
    paperTypeId: Number(row.paper_type_id) || 1,
    seq: Number(row.seq),
    name: row.name ?? null,
    date: row.date,
    note: row.note,
    items: [],
  };
}

export function nextSeq(db, paperTypeId = 1) {
  const row = db
    .prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM exam WHERE paper_type_id = ?")
    .get(paperTypeId);
  return Number(row?.n ?? 1);
}

export function listExams(db, paperTypeId = null) {
  const sql =
    paperTypeId === null
      ? "SELECT id, paper_type_id, seq, name, date, note FROM exam ORDER BY paper_type_id, seq"
      : "SELECT id, paper_type_id, seq, name, date, note FROM exam WHERE paper_type_id = ? ORDER BY seq";
  const exams = (paperTypeId === null
    ? db.prepare(sql).all()
    : db.prepare(sql).all(paperTypeId)
  ).map(mapExam);

  if (exams.length === 0) return exams;

  const byId = new Map(exams.map((e) => [e.id, e]));
  const items = db
    .prepare("SELECT exam_id, subtype_id, correct, minutes FROM exam_item ORDER BY subtype_id")
    .all();
  for (const row of items) {
    const exam = byId.get(Number(row.exam_id));
    if (exam) exam.items.push(mapItem(row));
  }
  return exams;
}

export function getExam(db, id) {
  const row = db
    .prepare("SELECT id, paper_type_id, seq, name, date, note FROM exam WHERE id = ?")
    .get(id);
  if (!row) return null;
  const items = db
    .prepare("SELECT subtype_id, correct, minutes FROM exam_item WHERE exam_id = ? ORDER BY subtype_id")
    .all(id)
    .map(mapItem);
  return { ...mapExam(row), items };
}

function insertItems(db, examId, items) {
  const stmt = db.prepare(
    "INSERT INTO exam_item (exam_id, subtype_id, correct, minutes) VALUES (?, ?, ?, ?)"
  );
  for (const it of items) stmt.run(examId, it.subtypeId, it.correct, it.minutes ?? null);
}

function insertExam(db, data, seq) {
  const ts = nowISO();
  const res = db
    .prepare(
      "INSERT INTO exam (paper_type_id, seq, name, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(data.paperTypeId, seq, data.name ?? null, data.date ?? null, data.note ?? null, ts, ts);
  const examId = Number(res.lastInsertRowid);
  insertItems(db, examId, data.items);
  return examId;
}

export function createExam(db, data) {
  return withTransaction(db, () => {
    const seq = data.seq ?? nextSeq(db, data.paperTypeId);
    const dup = db
      .prepare("SELECT id FROM exam WHERE paper_type_id = ? AND seq = ?")
      .get(data.paperTypeId, seq);
    if (dup) throw new ConflictError(`第 ${seq} 次模考已存在`);
    return { id: insertExam(db, data, seq), seq };
  });
}

export function updateExam(db, id, data) {
  return withTransaction(db, () => {
    const existing = db.prepare("SELECT id, paper_type_id, seq FROM exam WHERE id = ?").get(id);
    if (!existing) throw new NotFoundError();

    const paperTypeId = Number(data.paperTypeId) || Number(existing.paper_type_id) || 1;
    const seq = data.seq ?? Number(existing.seq);
    const dup = db
      .prepare("SELECT id FROM exam WHERE paper_type_id = ? AND seq = ? AND id <> ?")
      .get(paperTypeId, seq, id);
    if (dup) throw new ConflictError(`第 ${seq} 次模考已存在`);

    db.prepare(
      "UPDATE exam SET paper_type_id = ?, seq = ?, name = ?, date = ?, note = ?, updated_at = ? WHERE id = ?"
    ).run(paperTypeId, seq, data.name ?? null, data.date ?? null, data.note ?? null, nowISO(), id);
    db.prepare("DELETE FROM exam_item WHERE exam_id = ?").run(id);
    insertItems(db, id, data.items);
    return { id, seq };
  });
}

export function deleteExam(db, id) {
  const res = db.prepare("DELETE FROM exam WHERE id = ?").run(id);
  if (Number(res.changes) === 0) throw new NotFoundError();
  return true;
}

export function moveExam(db, id, targetSeq) {
  return withTransaction(db, () => {
    const row = db.prepare("SELECT id, paper_type_id FROM exam WHERE id = ?").get(id);
    if (!row) throw new NotFoundError();
    const paperTypeId = Number(row.paper_type_id) || 1;

    const target = Number(targetSeq);
    if (!Number.isInteger(target) || target < 1) throw new ValidationError("目标顺序无效");

    const rows = db
      .prepare("SELECT id, seq FROM exam WHERE paper_type_id = ? ORDER BY seq")
      .all(paperTypeId)
      .map((r) => ({ id: Number(r.id), seq: Number(r.seq) }));

    const moving = rows.find((r) => r.id === id);
    const others = rows.filter((r) => r.id !== id);
    const index = Math.max(0, Math.min(target - 1, others.length));
    others.splice(index, 0, moving);

    const OFFSET = 1000000;
    const ts = nowISO();
    db.prepare("UPDATE exam SET seq = seq + ? WHERE paper_type_id = ?").run(OFFSET, paperTypeId);
    const update = db.prepare("UPDATE exam SET seq = ?, updated_at = ? WHERE id = ?");
    others.forEach((item, i) => update.run(i + 1, ts, item.id));
    return { id, seq: index + 1 };
  });
}

export function exportAll(db) {
  return {
    app: "xingce-analyzer",
    version: 2,
    exportedAt: nowISO(),
    subtypes: SUBTYPES,
    exams: listExams(db).map(({ paperTypeId, seq, name, date, note, items }) => ({
      paperTypeId,
      seq,
      name,
      date,
      note,
      items,
    })),
  };
}

export function importExams(db, payload) {
  if (!payload || !Array.isArray(payload.exams)) {
    throw new ValidationError("备份文件格式不正确");
  }

  const existing = new Map();
  for (const row of db.prepare("SELECT paper_type_id, seq FROM exam").all()) {
    const type = Number(row.paper_type_id) || 1;
    if (!existing.has(type)) existing.set(type, new Set());
    existing.get(type).add(Number(row.seq));
  }

  let imported = 0;
  let skipped = 0;

  withTransaction(db, () => {
    for (const raw of payload.exams) {
      try {
        const paperTypeId = Number(raw?.paperTypeId) || 1;
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
        if (!existing.has(paperTypeId)) existing.set(paperTypeId, new Set());
        const used = existing.get(paperTypeId);

        let seq = data.seq;
        if (seq === null) {
          seq = 1;
          while (used.has(seq)) seq += 1;
        }
        if (used.has(seq)) {
          skipped += 1;
          continue;
        }
        insertExam(db, data, seq);
        used.add(seq);
        imported += 1;
      } catch {
        skipped += 1;
      }
    }
  });

  return { imported, skipped };
}
