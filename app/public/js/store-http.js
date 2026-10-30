export const kind = "http";

async function req(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`响应格式错误（HTTP ${res.status}）`);
      }
    }
    if (!res.ok) {
      const err = new Error(data?.error || `请求失败（HTTP ${res.status}）`);
      err.details = Array.isArray(data?.details) ? data.details : [];
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("请求超时，请确认程序仍在运行");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const meta = () => req("/api/meta");

export const listExams = async (paperTypeId) => {
  const query = paperTypeId ? "?paperTypeId=" + encodeURIComponent(paperTypeId) : "";
  const data = await req("/api/exams" + query);
  return Array.isArray(data?.exams) ? data.exams : [];
};

export const getExam = async (id) => {
  const data = await req("/api/exams/" + id);
  return data?.exam ?? null;
};

export const createExam = (payload) => req("/api/exams", { method: "POST", body: JSON.stringify(payload) });

export const updateExam = (id, payload) =>
  req("/api/exams/" + id, { method: "PUT", body: JSON.stringify(payload) });

export const deleteExam = (id) => req("/api/exams/" + id, { method: "DELETE" });

export const moveExam = (id, seq) =>
  req("/api/exams/" + id + "/move", { method: "POST", body: JSON.stringify({ seq }) });

export const stats = (paperTypeId) =>
  req("/api/stats?paperTypeId=" + encodeURIComponent(paperTypeId || 1));

export const exportAll = () => req("/api/export");

export const backupFile = () => req("/api/backup", { method: "POST" });

export const revealBackups = () => req("/api/backup/reveal", { method: "POST" });

export const importExams = (payload) => req("/api/import", { method: "POST", body: JSON.stringify(payload) });

export const tikuStatus = () => req("/api/tiku/status");

export const tikuQuestions = (params = {}) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  }
  return req("/api/tiku/questions?" + q.toString());
};

export const practiceSummary = (days = 30) =>
  req("/api/practice/summary?days=" + encodeURIComponent(days));

export const logPractice = (results) =>
  req("/api/practice", { method: "POST", body: JSON.stringify({ results }) });

export const wrongBookStats = () => req("/api/wrongbook/stats");

export const wrongBookDue = (limit = 50) =>
  req("/api/wrongbook/due?limit=" + encodeURIComponent(limit));

export const reviewWrong = (questionId, quality) =>
  req("/api/wrongbook/review", {
    method: "POST",
    body: JSON.stringify({ questionId, quality }),
  });

export const aiConfig = () => req("/api/ai/config");

export const saveAiConfig = (payload) =>
  req("/api/ai/config", { method: "POST", body: JSON.stringify(payload) });

export const aiTest = () => req("/api/ai/test", { method: "POST", body: "{}" });

export const aiReview = (payload) =>
  req("/api/ai/review", { method: "POST", body: JSON.stringify(payload) });
