import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { DB_PATH, DATA_DIR, SEED_PATH } from "./config.mjs";
import { PAPER_TYPES, SUBTYPES } from "../public/shared/domain.js";

const SCHEMA_VERSION = 4;

function nowISO() {
  return new Date().toISOString();
}

export function openDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 3000");
  migrate(db);
  seedPaperTypes(db);
  seedSubtypes(db);
  seedExams(db);
  return db;
}

function hasColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => String(c.name) === column);
}

function migrate(db) {
  const row = db.prepare("PRAGMA user_version").get();
  const current = Number(row?.user_version ?? 0);
  if (current >= SCHEMA_VERSION) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_type (
      id         INTEGER PRIMARY KEY,
      exam_type  TEXT NOT NULL,
      paper_name TEXT NOT NULL,
      sort       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subtype (
      id            INTEGER PRIMARY KEY,
      paper_type_id INTEGER NOT NULL DEFAULT 1,
      module        TEXT    NOT NULL,
      name          TEXT    NOT NULL,
      qty           INTEGER NOT NULL,
      pts           REAL    NOT NULL,
      sort          INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_type_id INTEGER NOT NULL DEFAULT 1,
      seq           INTEGER NOT NULL,
      name          TEXT,
      date          TEXT,
      note          TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      UNIQUE (paper_type_id, seq)
    );

    CREATE TABLE IF NOT EXISTS exam_item (
      exam_id    INTEGER NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
      subtype_id INTEGER NOT NULL REFERENCES subtype(id),
      correct    INTEGER NOT NULL,
      minutes    REAL,
      PRIMARY KEY (exam_id, subtype_id)
    );

    CREATE TABLE IF NOT EXISTS setting (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL,
      module      TEXT NOT NULL,
      correct     INTEGER NOT NULL,
      seconds     REAL,
      done_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_practice_module_done ON practice(module, done_at);
    CREATE INDEX IF NOT EXISTS idx_practice_done ON practice(done_at);

    CREATE TABLE IF NOT EXISTS wrong_book (
      question_id  TEXT PRIMARY KEY,
      module      TEXT NOT NULL,
      ease        REAL NOT NULL DEFAULT 2.5,
      interval_days REAL NOT NULL DEFAULT 0,
      reps        INTEGER NOT NULL DEFAULT 0,
      lapses      INTEGER NOT NULL DEFAULT 0,
      due_at      TEXT NOT NULL,
      last_done_at TEXT,
      last_result INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_wrong_due ON wrong_book(due_at);
  `);

  if (!hasColumn(db, "subtype", "paper_type_id")) {
    db.exec("ALTER TABLE subtype ADD COLUMN paper_type_id INTEGER NOT NULL DEFAULT 1");
  }
  if (!hasColumn(db, "exam", "name")) {
    db.exec("ALTER TABLE exam ADD COLUMN name TEXT");
  }
  if (!hasColumn(db, "exam", "paper_type_id")) {
    db.exec("ALTER TABLE exam ADD COLUMN paper_type_id INTEGER NOT NULL DEFAULT 1");
  }

  const examSql = String(
    db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'exam'").get()?.sql ?? ""
  );
  if (!examSql.includes("UNIQUE (paper_type_id, seq)")) {
    rebuildExam(db);
  }

  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

function rebuildExam(db) {
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE exam_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        paper_type_id INTEGER NOT NULL DEFAULT 1,
        seq           INTEGER NOT NULL,
        name          TEXT,
        date          TEXT,
        note          TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        UNIQUE (paper_type_id, seq)
      );
    `);
    db.exec(`
      INSERT INTO exam_new (id, paper_type_id, seq, name, date, note, created_at, updated_at)
      SELECT id, paper_type_id, seq, name, date, note, created_at, updated_at FROM exam;
    `);
    db.exec("DROP TABLE exam");
    db.exec("ALTER TABLE exam_new RENAME TO exam");
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

function seedPaperTypes(db) {
  const stmt = db.prepare("INSERT OR IGNORE INTO paper_type (id, exam_type, paper_name, sort) VALUES (?, ?, ?, ?)");
  PAPER_TYPES.forEach((t, i) => stmt.run(t.id, t.examType, t.paperName, i));
}

function seedSubtypes(db) {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO subtype (id, paper_type_id, module, name, qty, pts, sort) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const sortByType = new Map();
  for (const s of SUBTYPES) {
    const sort = sortByType.get(s.paperTypeId) ?? 0;
    sortByType.set(s.paperTypeId, sort + 1);
    stmt.run(s.id, s.paperTypeId, s.module, s.name, s.qty, s.pts, sort);
  }
}

function seedExams(db) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM exam").get();
  if (Number(row?.n ?? 0) > 0) return;
  if (!fs.existsSync(SEED_PATH)) return;

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  } catch (err) {
    console.warn(`[seed] 无法解析 ${SEED_PATH}：${err.message}`);
    return;
  }
  const exams = Array.isArray(payload?.exams) ? payload.exams : [];
  if (exams.length === 0) return;

  const known = new Map(SUBTYPES.map((s) => [s.id, s]));
  const insertExam = db.prepare(
    "INSERT INTO exam (paper_type_id, seq, name, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const insertItem = db.prepare(
    "INSERT INTO exam_item (exam_id, subtype_id, correct, minutes) VALUES (?, ?, ?, ?)"
  );

  let imported = 0;
  db.exec("BEGIN");
  try {
    for (const exam of exams) {
      const seq = Number(exam?.seq);
      if (!Number.isInteger(seq) || seq < 1) continue;
      if (!Array.isArray(exam.items) || exam.items.length === 0) continue;
      const paperTypeId = Number(exam.paperTypeId) || 1;
      const ts = nowISO();
      const res = insertExam.run(paperTypeId, seq, exam.name ?? null, exam.date ?? null, exam.note ?? null, ts, ts);
      const examId = Number(res.lastInsertRowid);
      for (const it of exam.items) {
        const subtype = known.get(Number(it.subtypeId));
        if (!subtype) continue;
        const correct = Number(it.correct);
        if (!Number.isInteger(correct) || correct < 0 || correct > subtype.qty) continue;
        const minutes = it.minutes === null || it.minutes === undefined ? null : Number(it.minutes);
        insertItem.run(examId, subtype.id, correct, Number.isFinite(minutes) ? minutes : null);
      }
      imported += 1;
    }
    db.exec("COMMIT");
    if (imported > 0) console.log(`[seed] 已导入 ${imported} 次历史模考`);
  } catch (err) {
    db.exec("ROLLBACK");
    console.warn(`[seed] 导入历史数据失败：${err.message}`);
  }
}

export function withTransaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      void 0;
    }
    throw err;
  }
}

export { nowISO };
