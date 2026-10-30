import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "./config.mjs";
import { chapterToModule, moduleList } from "../public/shared/tiku-map.js";
import { isJudgeable, normalizeQuestion } from "../public/shared/tiku-question.js";

const JUDGEABLE_SQL = `type = 1 AND json_valid(options)
  AND json_array_length(options) BETWEEN 2 AND 6
  AND answerIndex >= 0 AND answerIndex < json_array_length(options)`;

export const CATEGORY_OPTIONS = ["国考", "江苏"];

export function tikuDbPath() {
  return path.join(DATA_DIR, "tiku.db");
}

export function tikuOpen() {
  const p = tikuDbPath();
  if (!fs.existsSync(p)) return null;
  try {
    return new DatabaseSync(p, { readOnly: true });
  } catch {
    return null;
  }
}

export function tikuStatus() {
  const p = tikuDbPath();
  if (!fs.existsSync(p)) {
    return { available: false, path: p, hint: "把 tiku.db 放到上述路径后刷新本页" };
  }
  let tdb = null;
  try {
    tdb = new DatabaseSync(p, { readOnly: true });
    const papers = Number(tdb.prepare("SELECT COUNT(*) AS n FROM papers").get()?.n ?? 0);
    const questions = Number(tdb.prepare("SELECT COUNT(*) AS n FROM questions").get()?.n ?? 0);
    const chapters = tdb.prepare("SELECT chapter, COUNT(*) AS n FROM questions GROUP BY chapter").all();
    const modules = {};
    for (const m of moduleList()) modules[m] = 0;
    let unmapped = 0;
    for (const row of chapters) {
      const mod = chapterToModule(row.chapter);
      const n = Number(row.n ?? 0);
      if (mod) modules[mod] += n;
      else unmapped += n;
    }
    return { available: true, path: p, papers, questions, modules, unmapped };
  } catch (err) {
    return { available: false, path: p, error: err.message };
  } finally {
    try {
      tdb?.close();
    } catch {
      void 0;
    }
  }
}

export function tikuQuestions({ module = null, limit = 10, ids = null, category = null } = {}) {
  const tdb = tikuOpen();
  if (!tdb) return { available: false, questions: [] };
  try {
    const map = new Map(
      tdb
        .prepare("SELECT id, name, category, subjectName FROM papers")
        .all()
        .map((p) => [Number(p.id), p])
    );

    let rows = [];
    if (Array.isArray(ids) && ids.length > 0) {
      const clean = ids.slice(0, 100).map((v) => String(v));
      const stmt = tdb.prepare(
        `SELECT questionId, paperId, chapter, type, content, contentHtml, options, answerIndex, analysis, analysisHtml
          FROM questions WHERE type = 1 AND questionId IN (${clean.map(() => "?").join(",")})`
      );
      rows = stmt.all(...clean.map((v) => (Number.isFinite(Number(v)) ? Number(v) : v)));
    } else {
      const cap = Math.min(Math.max(Number(limit) || 10, 1), 50);
      const wanted = module ? [module] : moduleList();
      const wantedRows = [];
      for (const mod of wanted) {
        const chapters = tdb
          .prepare("SELECT DISTINCT chapter FROM questions WHERE chapter IS NOT NULL")
          .all()
          .map((r) => r.chapter)
          .filter((ch) => chapterToModule(ch) === mod);
        if (chapters.length === 0) continue;
        const placeholders = chapters.map(() => "?").join(",");
        const cats = category ? " AND paperId IN (SELECT id FROM papers WHERE category = ?)" : "";
        const args = category ? [...chapters, category] : chapters;
        const perModule = Math.max(1, Math.ceil(cap / wanted.length));
        const found = tdb
          .prepare(
            `SELECT questionId, paperId, chapter, type, content, contentHtml, options, answerIndex, analysis, analysisHtml
              FROM questions WHERE chapter IN (${placeholders}) AND ${JUDGEABLE_SQL}${cats}
              ORDER BY RANDOM() LIMIT ?`
          )
          .all(...args, perModule);
        wantedRows.push(...found);
      }
      rows = wantedRows.slice(0, cap);
    }

    const questions = rows
      .filter((r) => isJudgeable(r))
      .map((r) => {
        const paper = map.get(Number(r.paperId));
        return normalizeQuestion(r, {
          module: chapterToModule(r.chapter),
          paperName: paper?.name ?? null,
        });
      });

    return { available: true, questions };
  } finally {
    try {
      tdb.close();
    } catch {
      void 0;
    }
  }
}

export function tikuPapers({ category = null, subject = null, limit = 50 } = {}) {
  const tdb = tikuOpen();
  if (!tdb) return { available: false, papers: [] };
  try {
    const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const where = [];
    const args = [];
    if (category) {
      where.push("category = ?");
      args.push(category);
    }
    if (subject) {
      where.push("subjectName LIKE ?");
      args.push("%" + subject + "%");
    }
    const sql =
      "SELECT id, name, category, subjectName, questionCount FROM papers" +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY id DESC LIMIT ?";
    return { available: true, papers: tdb.prepare(sql).all(...args, cap) };
  } finally {
    try {
      tdb.close();
    } catch {
      void 0;
    }
  }
}
