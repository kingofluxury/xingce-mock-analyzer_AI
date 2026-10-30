#!/usr/bin/env node
// 把桌面端 tiku.db 的真题导出成 App 内置题库（JSON）。
// 用法：node tools/export-question-pack.mjs [--db app/data/tiku.db] [--per-module 600] [--out app/public/data/question-pack.json]
//       [--category 国考,江苏] [--all-modules]
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { chapterToModule, moduleList } from "../app/public/shared/tiku-map.js";
import { isJudgeable, normalizeQuestion } from "../app/public/shared/tiku-question.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dbPath = path.resolve(ROOT, arg("db", "app/data/tiku.db"));
const perModule = Math.max(20, Math.min(Number(arg("per-module", 600)) || 600, 5000));
const outPath = path.resolve(ROOT, arg("out", "app/public/data/question-pack.json"));
const categories = (arg("category", "国考,江苏") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!fs.existsSync(dbPath)) {
  console.error("找不到题库：" + dbPath);
  console.error("先克隆 ERRRC/kaogong-shuati，跑 node tools/reassemble-tiku.mjs 得到 tiku.db，放到 app/data/。");
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

const chapterRows = db.prepare("SELECT DISTINCT chapter FROM questions WHERE chapter IS NOT NULL").all();
const chaptersByModule = new Map();
for (const row of chapterRows) {
  const mod = chapterToModule(row.chapter);
  if (!mod) continue;
  if (!chaptersByModule.has(mod)) chaptersByModule.set(mod, []);
  chaptersByModule.get(mod).push(row.chapter);
}

const papers = new Map(
  db.prepare("SELECT id, name, category FROM papers").all().map((p) => [Number(p.id), p])
);

const catSql = categories.length ? " AND paperId IN (SELECT id FROM papers WHERE category IN (" + categories.map(() => "?").join(",") + "))" : "";

const questions = [];
const counts = {};

for (const mod of moduleList()) {
  const chapters = chaptersByModule.get(mod) ?? [];
  if (chapters.length === 0) continue;
  const placeholders = chapters.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT questionId, paperId, chapter, type, content, contentHtml, options, answerIndex, analysis, analysisHtml
       FROM questions
       WHERE chapter IN (${placeholders})
         AND type = 1 AND json_valid(options)
         AND json_array_length(options) BETWEEN 2 AND 6
         AND answerIndex >= 0 AND answerIndex < json_array_length(options)
         ${catSql}
       ORDER BY RANDOM() LIMIT ?`
    )
    .all(...chapters, ...categories, perModule);

  let kept = 0;
  for (const row of rows) {
    if (!isJudgeable(row)) continue;
    const paper = papers.get(Number(row.paperId));
    const q = normalizeQuestion(row, { module: mod, paperName: paper?.name ?? null });
    questions.push({
      id: q.questionId,
      m: q.module,
      s: q.contentHtml,
      o: q.options.map((o) => o.html),
      a: q.answerIndex,
      x: q.analysisHtml,
      p: (q.paperName || "").replace(/\s*（网友回忆版）\s*/g, "").slice(0, 40),
      c: paper?.category ?? null,
    });
    kept += 1;
  }
  counts[mod] = kept;
  console.log(`${mod}: ${kept} 题`);
}

db.close();

if (questions.length === 0) {
  console.error("没有导出任何题目，检查 --category 与题库内容。");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const payload = {
  format: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  source: "ERRRC/kaogong-shuati tiku.db",
  categories,
  counts,
  questions,
};
fs.writeFileSync(outPath, JSON.stringify(payload), "utf8");
const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`已导出 ${questions.length} 题 → ${path.relative(ROOT, outPath)}（${mb} MB）`);
