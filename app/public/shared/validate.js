import { ValidationError } from "./errors.js";

export function parseId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError("无效的记录 ID");
  return n;
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : NaN;
}

function cleanText(value, max) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const s = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function cleanDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("日期格式应为 YYYY-MM-DD");
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new ValidationError("日期不存在");
  }
  return value;
}

export function normalizeExam(body, subtypes) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("请求体必须是 JSON 对象");
  }

  let paperTypeId = 1;
  if (body.paperTypeId !== undefined && body.paperTypeId !== null && body.paperTypeId !== "") {
    paperTypeId = Number(body.paperTypeId);
    if (!Number.isInteger(paperTypeId) || paperTypeId < 1) {
      throw new ValidationError("考试类型无效");
    }
  }

  let seq = null;
  if (body.seq !== undefined && body.seq !== null && body.seq !== "") {
    const n = asNumber(body.seq);
    if (!Number.isInteger(n) || n < 1 || n > 9999) {
      throw new ValidationError("次数应为 1–9999 的整数");
    }
    seq = n;
  }

  const name = cleanText(body.name, 60);
  const date = cleanDate(body.date);
  const note = cleanText(body.note, 200);

  if (!Array.isArray(body.items)) {
    throw new ValidationError("items 必须是数组");
  }

  const known = new Map(subtypes.map((s) => [s.id, s]));
  const seen = new Set();
  const items = [];
  const errors = [];

  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") {
      errors.push("items 中存在非对象项");
      continue;
    }
    const id = asNumber(raw.subtypeId ?? raw.id);
    if (!Number.isInteger(id) || !known.has(id)) {
      errors.push(`未知的题型 ID：${raw.subtypeId ?? raw.id}`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`题型「${known.get(id).name}」重复提交`);
      continue;
    }
    seen.add(id);

    const subtype = known.get(id);
    const correct = asNumber(raw.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct > subtype.qty) {
      errors.push(`「${subtype.name}」答对数应为 0–${subtype.qty} 的整数`);
      continue;
    }

    let minutes = asNumber(raw.minutes);
    if (Number.isNaN(minutes)) {
      errors.push(`「${subtype.name}」用时必须是数字`);
      continue;
    }
    if (minutes !== null && (minutes < 0 || minutes > 600)) {
      errors.push(`「${subtype.name}」用时应为 0–600 分钟`);
      continue;
    }
    if (minutes !== null) minutes = Math.round(minutes * 100) / 100;

    items.push({ subtypeId: id, correct, minutes });
  }

  const missing = subtypes.filter((s) => !seen.has(s.id));
  if (missing.length > 0) {
    errors.push(`缺少题型：${missing.map((s) => s.name).join("、")}`);
  }

  if (errors.length > 0) {
    throw new ValidationError(errors[0], errors);
  }

  return { paperTypeId, seq, name, date, note, items };
}
