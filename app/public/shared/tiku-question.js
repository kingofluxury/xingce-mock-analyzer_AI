const LETTERS = "ABCDEFGH";

export function parseOptions(raw) {
  if (Array.isArray(raw)) return raw.map((o) => String(o ?? ""));
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((o) => String(o ?? "")) : [];
  } catch {
    return [];
  }
}

export function optionLetter(index) {
  return Number.isInteger(index) && index >= 0 && index < LETTERS.length ? LETTERS[index] : "?";
}

export function isJudgeable(row) {
  if (!row || Number(row.type) !== 1) return false;
  const options = parseOptions(row.options);
  if (options.length < 2 || options.length > 6) return false;
  if (options.every((o) => !o.trim())) return false;
  const idx = Number(row.answerIndex);
  return Number.isInteger(idx) && idx >= 0 && idx < options.length;
}

export function sanitizeHtml(html) {
  let out = String(html ?? "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<\/?(iframe|object|embed|link|meta|form|input)[^>]*>/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
  out = out.replace(/(src|href)\s*=\s*("|')\/\//gi, "$1=$2https://");
  return out;
}

export function normalizeQuestion(row, { module = null, paperName = null } = {}) {
  const options = parseOptions(row.options);
  const answerIndex = Number(row.answerIndex);
  return {
    questionId: String(row.questionId),
    module: module ?? null,
    chapter: row.chapter ?? null,
    paperId: row.paperId === null || row.paperId === undefined ? null : Number(row.paperId),
    paperName: paperName ?? null,
    contentHtml: sanitizeHtml(row.contentHtml || row.content || ""),
    options: options.map((html, i) => ({ letter: optionLetter(i), html: sanitizeHtml(html) })),
    answerIndex,
    answerLetter: optionLetter(answerIndex),
    analysisHtml: sanitizeHtml(row.analysisHtml || row.analysis || ""),
  };
}

export function scoreAnswers(items) {
  const list = Array.isArray(items) ? items : [];
  const answered = list.filter((it) => Number.isInteger(it?.pickedIndex) && it.pickedIndex >= 0);
  const correct = answered.filter((it) => it.pickedIndex === Number(it.answerIndex)).length;
  return {
    total: list.length,
    answered: answered.length,
    correct,
    pct: answered.length ? Math.round((correct / answered.length) * 1000) / 10 : null,
    results: list.map((it) => ({
      questionId: String(it.questionId),
      module: it.module ?? null,
      correct: Number.isInteger(it.pickedIndex) && it.pickedIndex === Number(it.answerIndex) ? 1 : 0,
      seconds: Number.isFinite(Number(it.seconds)) ? Number(it.seconds) : null,
    })),
  };
}
