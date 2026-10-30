import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  DEFAULT_PAPER_TYPE_ID,
  PAPER_TYPES,
  modulesOf,
  paperTypeById,
  subtypesOf,
  totalsOf,
} from "../public/shared/domain.js";
import { DATA_DIR, VERSION } from "./config.mjs";
import { compactRows, summarize } from "../public/shared/metrics.js";
import { NotFoundError, ValidationError } from "../public/shared/errors.js";
import { parseId, normalizeExam } from "../public/shared/validate.js";
import { readJSON, sendJSON } from "./http.mjs";
import {
  createExam,
  deleteExam,
  exportAll,
  getExam,
  importExams,
  listExams,
  moveExam,
  nextSeq,
  updateExam,
} from "./repo.mjs";
import {
  logPractice,
  practiceSummary,
  reviewWrong,
  wrongBookDue,
  wrongBookStats,
} from "./repo-practice.mjs";
import { tikuStatus, tikuQuestions } from "./tiku.mjs";
import { publicAiConfig, runAiReview, saveAiConfig, testAi } from "./ai.mjs";

function meta(db) {
  return {
    defaultPaperTypeId: DEFAULT_PAPER_TYPE_ID,
    paperTypes: PAPER_TYPES.map((type) => ({
      id: type.id,
      examType: type.examType,
      paperName: type.paperName,
      subtypes: subtypesOf(type.id),
      modules: modulesOf(type.id),
      totals: totalsOf(type.id),
      nextSeq: nextSeq(db, type.id),
    })),
  };
}

function examSummary(exam) {
  const items = new Map(exam.items.map((it) => [it.subtypeId, it]));
  const s = summarize(items, subtypesOf(exam.paperTypeId));
  return {
    id: exam.id,
    paperTypeId: exam.paperTypeId,
    seq: exam.seq,
    name: exam.name ?? null,
    date: exam.date,
    note: exam.note,
    totals: s.totals,
  };
}

function backupDir() {
  const dir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeBackup(db) {
  const dir = backupDir();
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp =
    d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  const name = "行测模考备份-" + stamp + ".json";
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(exportAll(db), null, 2), "utf8");
  return { file: name, path: file, dir };
}

function resolveType(body) {  const raw = body?.paperTypeId;
  const id = raw === undefined || raw === null || raw === "" ? DEFAULT_PAPER_TYPE_ID : Number(raw);
  if (!Number.isInteger(id) || !paperTypeById(id)) throw new ValidationError("考试类型无效");
  return id;
}

export async function handleApi(req, res, db, url) {
  const { pathname } = url;
  const method = req.method || "GET";
  const examsMatch = pathname.match(/^\/api\/exams\/(\d+)$/);
  const moveMatch = pathname.match(/^\/api\/exams\/(\d+)\/move$/);

  if (moveMatch) {
    if (method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const id = parseId(moveMatch[1]);
    const body = await readJSON(req);
    return sendJSON(res, 200, moveExam(db, id, body?.seq));
  }

  if (pathname === "/api/health") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    return sendJSON(res, 200, { ok: true, version: VERSION });
  }

  if (pathname === "/api/meta") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    return sendJSON(res, 200, meta(db));
  }

  if (pathname === "/api/exams") {
    if (method === "GET") {
      const filter = url.searchParams.get("paperTypeId");
      const typeId = filter ? Number(filter) : null;
      const exams = listExams(db, Number.isInteger(typeId) ? typeId : null).map(examSummary);
      return sendJSON(res, 200, { exams });
    }
    if (method === "POST") {
      const body = await readJSON(req);
      const typeId = resolveType(body);
      const payload = normalizeExam(body, subtypesOf(typeId));
      return sendJSON(res, 201, createExam(db, payload));
    }
    return sendJSON(res, 405, { error: "Method Not Allowed" });
  }

  if (examsMatch) {
    const id = parseId(examsMatch[1]);
    if (method === "GET") {
      const exam = getExam(db, id);
      if (!exam) throw new NotFoundError();
      const items = new Map(exam.items.map((it) => [it.subtypeId, it]));
      return sendJSON(res, 200, {
        exam: { ...exam, summary: summarize(items, subtypesOf(exam.paperTypeId)) },
      });
    }
    if (method === "PUT") {
      const body = await readJSON(req);
      const typeId = resolveType(body);
      const payload = normalizeExam(body, subtypesOf(typeId));
      return sendJSON(res, 200, updateExam(db, id, payload));
    }
    if (method === "DELETE") {
      deleteExam(db, id);
      return sendJSON(res, 200, { ok: true });
    }
    return sendJSON(res, 405, { error: "Method Not Allowed" });
  }

  if (pathname === "/api/stats") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const filter = url.searchParams.get("paperTypeId");
    const typeId = filter ? Number(filter) : DEFAULT_PAPER_TYPE_ID;
    if (!Number.isInteger(typeId) || !paperTypeById(typeId)) {
      throw new ValidationError("考试类型无效");
    }
    const rows = compactRows(listExams(db, typeId));
    return sendJSON(res, 200, {
      paperTypeId: typeId,
      rows,
      modules: modulesOf(typeId),
      totals: totalsOf(typeId),
    });
  }

  if (pathname === "/api/export") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    return sendJSON(res, 200, exportAll(db));
  }

  if (pathname === "/api/backup") {
    if (method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });
    return sendJSON(res, 200, writeBackup(db));
  }

  if (pathname === "/api/backup/reveal") {
    if (method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const dir = path.join(DATA_DIR, "backups");
    fs.mkdirSync(dir, { recursive: true });
    try {
      const child = spawn("explorer", [dir], { detached: true, stdio: "ignore" });
      child.unref();
    } catch {
      void 0;
    }
    return sendJSON(res, 200, { ok: true, dir });
  }

  if (pathname === "/api/import") {
    if (method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const payload = await readJSON(req);
    return sendJSON(res, 200, importExams(db, payload));
  }

  if (pathname === "/api/tiku/status") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    return sendJSON(res, 200, tikuStatus());
  }

  if (pathname === "/api/tiku/questions") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const idsRaw = url.searchParams.get("ids");
    const ids = idsRaw ? idsRaw.split(",").map((s) => s.trim()).filter(Boolean) : null;
    return sendJSON(
      res,
      200,
      tikuQuestions({
        module: url.searchParams.get("module") || null,
        limit: Number(url.searchParams.get("limit") ?? 10),
        ids,
        category: url.searchParams.get("category") || null,
      })
    );
  }

  if (pathname === "/api/practice/summary") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const days = Number(url.searchParams.get("days") ?? 30);
    return sendJSON(res, 200, practiceSummary(db, days));
  }

  if (pathname === "/api/practice") {
    if (method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const body = await readJSON(req);
    const result = logPractice(db, Array.isArray(body?.results) ? body.results : []);
    return sendJSON(res, 201, result);
  }

  if (pathname === "/api/wrongbook/stats") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    return sendJSON(res, 200, wrongBookStats(db));
  }

  if (pathname === "/api/wrongbook/due") {
    if (method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const limit = Number(url.searchParams.get("limit") ?? 50);
    return sendJSON(res, 200, { items: wrongBookDue(db, limit) });
  }

  if (pathname === "/api/wrongbook/review") {
    if (method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const body = await readJSON(req);
    return sendJSON(res, 200, reviewWrong(db, body?.questionId, body?.quality));
  }

  if (pathname === "/api/ai/config") {
    if (method === "GET") return sendJSON(res, 200, publicAiConfig(db));
    if (method === "POST") {
      const body = await readJSON(req);
      return sendJSON(res, 200, saveAiConfig(db, body));
    }
    return sendJSON(res, 405, { error: "Method Not Allowed" });
  }

  if (pathname === "/api/ai/test") {
    if (method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });
    return sendJSON(res, 200, await testAi(db));
  }

  if (pathname === "/api/ai/review") {
    if (method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });
    const body = await readJSON(req);
    return sendJSON(res, 200, await runAiReview(db, body));
  }

  return sendJSON(res, 404, { error: "接口不存在" });
}
