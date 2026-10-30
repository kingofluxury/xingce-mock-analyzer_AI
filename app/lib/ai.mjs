import { ValidationError } from "../public/shared/errors.js";
import { compactRows } from "../public/shared/metrics.js";
import { moduleStats, weakModules } from "../public/shared/report.js";
import { listExams } from "./repo.mjs";
import { practiceSummary, wrongBookStats } from "./repo-practice.mjs";
import { modulesOf, paperTypeLabel, totalsOf } from "../public/shared/domain.js";

const KEY = {
  baseUrl: "ai.baseUrl",
  model: "ai.model",
  apiKey: "ai.apiKey",
};

const DEFAULTS = {
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
};

function readSetting(db, key) {
  const row = db.prepare("SELECT value FROM setting WHERE key = ?").get(key);
  return row ? String(row.value) : "";
}

function writeSetting(db, key, value) {
  db.prepare(
    "INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, String(value ?? ""));
}

export function getAiConfig(db) {
  return {
    baseUrl: readSetting(db, KEY.baseUrl) || DEFAULTS.baseUrl,
    model: readSetting(db, KEY.model) || DEFAULTS.model,
    apiKey: readSetting(db, KEY.apiKey),
  };
}

export function maskKey(key) {
  const k = String(key ?? "");
  if (!k) return "";
  if (k.length <= 8) return "****";
  return k.slice(0, 4) + "****" + k.slice(-4);
}

export function publicAiConfig(db) {
  const cfg = getAiConfig(db);
  return {
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    hasKey: Boolean(cfg.apiKey),
    keyMasked: maskKey(cfg.apiKey),
  };
}

export function saveAiConfig(db, body) {
  const baseUrl = String(body?.baseUrl ?? "").trim();
  const model = String(body?.model ?? "").trim();
  const rawKey = body?.apiKey;
  const apiKey = rawKey === undefined ? undefined : rawKey === null ? null : String(rawKey).trim();

  if (!/^https?:\/\/.+/i.test(baseUrl)) throw new ValidationError("base_url 必须以 http:// 或 https:// 开头");
  if (!model) throw new ValidationError("model 不能为空");

  writeSetting(db, KEY.baseUrl, baseUrl.replace(/\/+$/, ""));
  writeSetting(db, KEY.model, model);
  if (apiKey === null) writeSetting(db, KEY.apiKey, "");
  else if (apiKey !== undefined && apiKey !== "") writeSetting(db, KEY.apiKey, apiKey);
  return publicAiConfig(db);
}

async function chat(db, messages, { maxTokens = 1400, timeoutMs = 60000 } = {}) {
  const cfg = getAiConfig(db);
  if (!cfg.apiKey) throw new ValidationError("还没有配置 API key（设置 → AI 复盘）");
  const url = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.apiKey,
      },
      body: JSON.stringify({ model: cfg.model, messages, max_tokens: maxTokens, temperature: 0.4 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const hint = err?.name === "TimeoutError" ? "请求超时" : err?.message || "请求失败";
    throw new ValidationError("AI 请求失败：" + hint);
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      detail = j?.error?.message || j?.message || detail;
    } catch {
      void 0;
    }
    throw new ValidationError("AI 接口返回 " + res.status + "：" + detail);
  }
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ValidationError("AI 接口返回了非 JSON 内容");
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new ValidationError("AI 接口没有返回内容");
  return { content, model: cfg.model, baseUrl: cfg.baseUrl };
}

function summarizeForPrompt(db, paperTypeId, window = 15) {
  const rows = compactRows(listExams(db, paperTypeId)).slice(-Math.max(1, Math.min(Number(window) || 15, 50)));
  const modules = modulesOf(paperTypeId);
  const stats = moduleStats(modules, rows);
  const practice = practiceSummary(db, 30);
  const wrong = wrongBookStats(db);
  const last = rows[rows.length - 1];

  return {
    label: paperTypeLabel(paperTypeId),
    full: totalsOf(paperTypeId).full,
    window: rows.length,
    latest: last
      ? {
          seq: last.seq,
          date: last.date,
          name: last.name,
          score: last.totals?.score ?? null,
          pct: last.totals?.pct ?? null,
          minutes: last.totals?.minutes ?? null,
          verdict: last.diagnosis?.verdict ?? null,
          expected: last.diagnosis?.expected ?? null,
          se: last.diagnosis?.se ?? null,
          delta: last.diagnosis?.delta ?? null,
        }
      : null,
    exams: rows.map((r) => ({
      seq: r.seq,
      date: r.date,
      score: r.totals?.score ?? null,
      pct: r.totals?.pct ?? null,
      minutes: r.totals?.minutes ?? null,
    })),
    modules: stats.map((s) => ({
      name: s.name,
      qty: s.qty,
      full: s.full,
      avgPct: s.avgPct === null ? null : Math.round(s.avgPct * 1000) / 10,
      lastPct: s.lastPct === null ? null : Math.round(s.lastPct * 1000) / 10,
      gapPts: s.gapPts === null ? null : Math.round(s.gapPts * 10) / 10,
    })),
    weak: weakModules(stats).map((s) => ({
      name: s.name,
      gapQty: Math.round(s.gapQty * 10) / 10,
      gapPts: Math.round(s.gapPts * 10) / 10,
    })),
    practice: practice.modules
      .filter((m) => m.qty > 0)
      .map((m) => ({ module: m.module, qty: m.qty, pct: m.pct })),
    wrong: { total: wrong.total, due: wrong.due },
  };
}

export async function runAiReview(db, body) {
  const paperTypeId = Number(body?.paperTypeId) || 1;
  const window = Number(body?.window) || 15;
  const summary = summarizeForPrompt(db, paperTypeId, window);
  if (!summary.latest) throw new ValidationError("这套试卷还没有记录，先录入一次模考");

  const system =
    "你是一名行测备考教练。你只依据用户提供的统计数据说话，不编造题目内容、不猜测未给出的信息。" +
    "输出中文 Markdown，结构固定：## 结论 / ## 主要问题 / ## 两周计划 / ## 下次模考验证点。" +
    "结论要指出这次波动是否在噪声范围内（给了期望分与 SE 就用它判断）；" +
    "计划要落到可执行的每日动作（题量、模块、复盘方式），总长度不超过 500 字。";

  const user =
    "以下是该考生同一套试卷的统计（不含题目文本）：\n\n```json\n" +
    JSON.stringify(summary, null, 1) +
    "\n```\n\n" +
    "请据此给出诊断和下一步计划。";

  const out = await chat(db, [
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return { ...out, summary };
}

export async function testAi(db) {
  const out = await chat(db, [{ role: "user", content: "只回复两个字：可用" }], {
    maxTokens: 16,
    timeoutMs: 30000,
  });
  return { ok: true, reply: out.content.trim().slice(0, 40), model: out.model };
}
