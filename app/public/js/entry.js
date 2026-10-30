import { getStore } from "./store.js";
import { scoreOf } from "./fmt.js";
import { $, $$, toast, markNav, escapeHtml, todayISO, showFatal } from "./ui.js";

const DRAFT_KEY = "xingce.draft.v2";
const root = $("#app");

const state = {
  meta: null,
  types: [],
  type: null,
  examId: null,
  store: null,
  saving: false,
  leaveOk: false,
  editing: false,
};

function readId() {
  const v = new URLSearchParams(location.search).get("id");
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function typeById(id) {
  return state.types.find((t) => t.id === Number(id)) || state.types[0] || null;
}

function examTypes() {
  const list = [];
  for (const type of state.types) {
    if (!list.includes(type.examType)) list.push(type.examType);
  }
  return list;
}

function subTypesOfExamType(examType) {
  return state.types.filter((t) => t.examType === examType);
}

function moduleHtml(m) {
  return (
    '<section class="card module" data-module="' +
    escapeHtml(m.name) +
    '">' +
    '<div class="card-head"><div class="head-title"><h2>' +
    escapeHtml(m.name) +
    '</h2><span class="muted tiny">' +
    m.qty +
    " 题 · " +
    m.full +
    ' 分</span></div><span class="spacer"></span><span class="muted tiny" data-module-pct>—</span><span class="muted tiny" data-module-time>—</span><span class="muted tiny" data-module-score>—</span></div>' +
    '<div class="rows">' +
    '<div class="row head"><div class="c-name">题型</div><div class="c-correct">答对</div><div class="c-time">用时</div><div class="c-pct">正确率</div><div class="c-score">得分</div></div>' +
    m.subtypes.map(rowHtml).join("") +
    "</div></section>"
  );
}

function rowHtml(s) {
  return (
    '<div class="row" data-id="' +
    s.id +
    '">' +
    '<div class="c-name">' +
    escapeHtml(s.name) +
    "<em>共 " +
    s.qty +
    " 题 · 每题 " +
    s.pts +
    " 分</em></div>" +
    '<div class="c-correct"><input type="number" inputmode="numeric" min="0" max="' +
    s.qty +
    '" step="1" data-field="correct" aria-label="' +
    escapeHtml(s.name) +
    ' 答对数" placeholder="—"><span>/ ' +
    s.qty +
    "</span></div>" +
    '<div class="c-time"><input type="number" inputmode="decimal" min="0" max="600" step="0.5" data-field="minutes" aria-label="' +
    escapeHtml(s.name) +
    ' 用时" placeholder="—"><span>分钟</span></div>' +
    '<div class="c-pct" data-out="pct">—</div>' +
    '<div class="c-score" data-out="score">—</div>' +
    "</div>"
  );
}

function render() {
  const type = state.type;
  const types = subTypesOfExamType(type.examType);
  const typeOptions = types
    .map(
      (t) =>
        '<option value="' + t.id + '"' + (t.id === type.id ? " selected" : "") + ">" + escapeHtml(t.paperName) + "</option>"
    )
    .join("");
  const examOptions = examTypes()
    .map((name) => '<option value="' + escapeHtml(name) + '"' + (name === type.examType ? " selected" : "") + ">" + escapeHtml(name) + "</option>")
    .join("");
  const disabled = state.editing ? " disabled" : "";

  root.innerHTML =
    '<div class="card head-form">' +
    "<label>考试 <select id=\"examType\"" +
    disabled +
    ">" +
    examOptions +
    "</select></label>" +
    "<label>试卷 <select id=\"paperType\"" +
    disabled +
    ">" +
    typeOptions +
    "</select></label>" +
    '<label>第 <input type="number" id="seq" min="1" max="9999" step="1"> 次</label>' +
    '<label>日期 <input type="date" id="date"></label>' +
    '<label>卷名 <input type="text" id="name" maxlength="60" placeholder="可选，如：如风12"></label>' +
    '<label>备注 <input type="text" id="note" maxlength="200" placeholder="可选，如：状态不好"></label>' +
    '<button class="btn ghost sm" id="clear" type="button">清空重填</button>' +
    "</div>" +
    '<div id="modules">' +
    type.modules.map(moduleHtml).join("") +
    "</div>" +
    '<div class="summary"><div class="summary-inner">' +
    '<div class="stat"><b id="sum-score">—</b><span>/ ' +
    type.totals.full +
    " 分</span></div>" +
    '<div class="stat"><b id="sum-pct">—</b><span>正确率</span></div>' +
    '<div class="stat"><b id="sum-time">—</b><span>总用时</span></div>' +
    '<div class="stat"><b id="sum-missing" class="tiny"></b><span></span></div>' +
    '<div class="actions">' +
    '<a class="btn ghost" href="records.html">返回</a>' +
    '<button class="btn" id="save" type="button">保存</button>' +
    '<button class="btn primary" id="save-curves" type="button">保存并看曲线</button>' +
    "</div></div></div>";
}

function inputsFor(id) {
  const row = document.querySelector('.row[data-id="' + id + '"]');
  if (!row) return null;
  return {
    row,
    correct: row.querySelector('[data-field="correct"]'),
    minutes: row.querySelector('[data-field="minutes"]'),
    pct: row.querySelector('[data-out="pct"]'),
    score: row.querySelector('[data-out="score"]'),
  };
}

function parseCorrect(input, qty) {
  const raw = input.value.trim();
  if (raw === "") return { value: null, valid: true };
  const n = Number(raw);
  const valid = Number.isInteger(n) && n >= 0 && n <= qty;
  return { value: valid ? n : null, valid };
}

function parseMinutes(input) {
  const raw = input.value.trim();
  if (raw === "") return { value: null, valid: true };
  const n = Number(raw);
  const valid = Number.isFinite(n) && n >= 0 && n <= 600;
  return { value: valid ? Math.round(n * 100) / 100 : null, valid };
}

function recalc() {
  if (!state.saving) state.leaveOk = false;
  if (!state.type) return;

  let totalScore = 0;
  let totalCorrect = 0;
  let totalQtyAll = 0;
  let totalMinutes = 0;
  let timedCount = 0;
  let missing = 0;

  for (const s of state.type.subtypes) {
    const refs = inputsFor(s.id);
    if (!refs) continue;
    const c = parseCorrect(refs.correct, s.qty);
    const t = parseMinutes(refs.minutes);

    refs.correct.classList.toggle("invalid", refs.correct.value.trim() !== "" && !c.valid);
    refs.minutes.classList.toggle("invalid", refs.minutes.value.trim() !== "" && !t.valid);

    const score = c.value === null ? null : scoreOf(c.value, s.pts);
    refs.pct.textContent = c.value === null ? "—" : Math.round((c.value / s.qty) * 100) + "%";
    refs.pct.classList.toggle("low", c.value !== null && c.value / s.qty < 0.4);
    refs.score.textContent = score === null ? "—" : score.toFixed(1);

    if (c.value === null) missing += 1;
    else {
      totalScore += score;
      totalCorrect += c.value;
    }
    totalQtyAll += s.qty;

    if (t.value !== null) {
      totalMinutes += t.value;
      timedCount += 1;
    }
  }

  for (const m of state.type.modules) {
    let score = 0;
    let known = 0;
    let correctSum = 0;
    let qtySum = 0;
    let minutesSum = 0;
    let minutesKnown = 0;
    for (const s of m.subtypes) {
      const refs = inputsFor(s.id);
      if (!refs) continue;
      const c = parseCorrect(refs.correct, s.qty);
      const t = parseMinutes(refs.minutes);
      qtySum += s.qty;
      if (t.value !== null) {
        minutesSum += t.value;
        minutesKnown += 1;
      }
      if (c.value === null) continue;
      score += scoreOf(c.value, s.pts) || 0;
      correctSum += c.value;
      known += 1;
    }
    const base = '.module[data-module="' + CSS.escape(m.name) + '"] ';
    const pctOut = document.querySelector(base + "[data-module-pct]");
    if (pctOut) {
      pctOut.textContent = known === 0 ? "—" : "正确率 " + Math.round((correctSum / qtySum) * 100) + "%";
    }
    const timeOut = document.querySelector(base + "[data-module-time]");
    if (timeOut) {
      timeOut.textContent = minutesKnown === 0 ? "—" : "总用时 " + Math.round(minutesSum * 10) / 10 + " 分钟";
    }
    const out = document.querySelector(base + "[data-module-score]");
    if (out) out.textContent = known === 0 ? "—" : score.toFixed(1) + " / " + m.full + " 分";
  }

  $("#sum-score").textContent = totalScore.toFixed(1);
  $("#sum-pct").textContent = totalQtyAll > 0 ? Math.round((totalCorrect / totalQtyAll) * 100) + "%" : "—";
  $("#sum-time").textContent = timedCount === 0 ? "—" : totalMinutes.toFixed(0) + " 分钟";

  const miss = $("#sum-missing");
  if (miss) {
    miss.textContent = missing > 0 ? "还差 " + missing + " 项" : "";
    miss.style.color = missing > 0 ? "var(--warn)" : "";
  }

  scheduleDraft();
}

let draftTimer = null;
function scheduleDraft() {
  if (state.examId) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 400);
}

function collect() {
  const seqRaw = $("#seq").value.trim();
  const seq = seqRaw === "" ? null : Number(seqRaw);
  const name = $("#name").value.trim() || null;
  const date = $("#date").value || null;
  const note = $("#note").value.trim() || null;
  const items = [];

  for (const s of state.type.subtypes) {
    const refs = inputsFor(s.id);
    const c = parseCorrect(refs.correct, s.qty);
    const t = parseMinutes(refs.minutes);
    items.push({ subtypeId: s.id, correct: c.value, minutes: t.value, valid: c.valid && t.valid });
  }
  return { paperTypeId: state.type.id, seq, name, date, note, items };
}

function validate(payload) {
  const errors = [];
  if (payload.seq !== null && (!Number.isInteger(payload.seq) || payload.seq < 1 || payload.seq > 9999)) {
    errors.push("次数应为 1–9999 的整数");
  }
  const byId = new Map(state.type.subtypes.map((s) => [s.id, s]));
  for (const it of payload.items) {
    const s = byId.get(it.subtypeId);
    if (!it.valid) {
      errors.push("「" + s.name + "」的答对数或用时填写有误");
      continue;
    }
    if (it.correct === null) errors.push("「" + s.name + "」还没填答对数");
  }
  return errors;
}

async function save(goCurves) {
  if (state.saving) return;
  const payload = collect();
  const errors = validate(payload);
  if (errors.length > 0) {
    toast(errors[0], "err", 3200);
    const firstInvalid = document.querySelector("input.invalid");
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  state.saving = true;
  const buttons = [$("#save"), $("#save-curves")];
  buttons.forEach((b) => b && (b.disabled = true));

  const body = {
    paperTypeId: payload.paperTypeId,
    seq: payload.seq,
    name: payload.name,
    date: payload.date,
    note: payload.note,
    items: payload.items.map(({ subtypeId, correct, minutes }) => ({ subtypeId, correct, minutes })),
  };

  try {
    const saved = state.examId
      ? await state.store.updateExam(state.examId, body)
      : await state.store.createExam(body);
    clearDraft();
    state.leaveOk = true;
    const seq = Number(saved?.seq ?? payload.seq ?? 0);

    if (state.type.nextSeq <= seq) state.type.nextSeq = seq + 1;

    if (goCurves) {
      toast("已保存第 " + seq + " 次", "ok", 1200);
      setTimeout(() => location.assign("curves.html?paperTypeId=" + state.type.id), 250);
      return;
    }

    if (state.examId) {
      toast("已更新第 " + seq + " 次", "ok");
      setTimeout(() => location.assign("records.html"), 500);
      return;
    }

    toast("已保存第 " + seq + " 次，继续录下一次", "ok");
    resetForNext(seq + 1);
  } catch (err) {
    toast(err.message || "保存失败", "err", 3600);
  } finally {
    state.saving = false;
    buttons.forEach((b) => b && (b.disabled = false));
  }
}

function resetForNext(nextSeq) {
  state.leaveOk = false;
  $("#seq").value = String(nextSeq);
  $("#name").value = "";
  $("#note").value = "";
  for (const s of state.type.subtypes) {
    const refs = inputsFor(s.id);
    if (!refs) continue;
    refs.correct.value = "";
    refs.minutes.value = "";
  }
  recalc();
  window.scrollTo({ top: 0, behavior: "smooth" });
  const first = document.querySelector('[data-field="correct"]');
  if (first) first.focus();
}

function saveDraft() {
  try {
    const payload = collect();
    const values = {};
    let touched = false;
    for (const it of payload.items) {
      const refs = inputsFor(it.subtypeId);
      const c = it.correct === null ? "" : String(it.correct);
      const t = refs?.minutes.value.trim() ?? "";
      values[it.subtypeId] = { c, t };
      if (c !== "" || t !== "") touched = true;
    }
    if (!touched) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        paperTypeId: payload.paperTypeId,
        seq: $("#seq").value,
        name: $("#name").value,
        date: $("#date").value,
        note: $("#note").value,
        values,
      })
    );
  } catch {
    void 0;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    void 0;
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft.values !== "object") return false;
    if (Number(draft.paperTypeId) && Number(draft.paperTypeId) !== state.type.id) return false;
    if (draft.seq) $("#seq").value = draft.seq;
    if (draft.name) $("#name").value = draft.name;
    if (draft.date) $("#date").value = draft.date;
    if (draft.note) $("#note").value = draft.note;
    for (const s of state.type.subtypes) {
      const refs = inputsFor(s.id);
      const v = draft.values[s.id];
      if (!refs || !v) continue;
      if (v.c !== undefined) refs.correct.value = v.c;
      if (v.t !== undefined) refs.minutes.value = v.t;
    }
    return true;
  } catch {
    return false;
  }
}

function hasInput() {
  return state.type.subtypes.some((s) => {
    const refs = inputsFor(s.id);
    return refs && refs.correct.value.trim() !== "";
  });
}

function switchType(typeId) {
  const next = typeById(typeId);
  if (!next || !state.type || next.id === state.type.id) return;
  if (hasInput() && !confirm("切换试卷会清空当前输入，继续？")) {
    $("#paperType").value = String(state.type.id);
    return;
  }
  state.type = next;
  render();
  $("#seq").value = String(next.nextSeq);
  $("#date").value = todayISO();
  recalc();
  const first = document.querySelector('[data-field="correct"]');
  if (first) first.focus();
}

function bind() {
  document.addEventListener("input", (e) => {
    if (e.target.closest(".row") || ["seq", "date", "name", "note"].includes(e.target.id)) recalc();
  });

  document.addEventListener(
    "wheel",
    (e) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.type === "number") {
        e.preventDefault();
        el.blur();
      }
    },
    { passive: false }
  );

  document.addEventListener("change", (e) => {
    if (e.target.id === "paperType") switchType(Number(e.target.value));
    if (e.target.id === "examType") {
      const list = subTypesOfExamType(e.target.value);
      if (list.length > 0) switchType(list[0].id);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const input = e.target.closest('[data-field="correct"]');
    if (input) {
      e.preventDefault();
      const rows = $$(".row[data-id]");
      const idx = rows.indexOf(input.closest(".row"));
      if (idx >= 0 && idx < rows.length - 1) {
        const next = rows[idx + 1].querySelector('[data-field="correct"]');
        if (next) {
          next.focus();
          next.select();
        }
      } else {
        const saveBtn = $("#save");
        if (saveBtn) saveBtn.focus();
      }
    }
  });

  root.addEventListener("click", (e) => {
    const id = e.target.id;
    if (id === "save") save(false);
    if (id === "save-curves") save(true);
    if (id === "clear") {
      if (!confirm("清空当前未保存的输入？")) return;
      for (const s of state.type.subtypes) {
        const refs = inputsFor(s.id);
        if (!refs) continue;
        refs.correct.value = "";
        refs.minutes.value = "";
      }
      $("#name").value = "";
      $("#note").value = "";
      clearDraft();
      recalc();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (state.saving || state.leaveOk) return;
    if (hasInput()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

function fillExam(exam) {
  $("#seq").value = String(exam.seq);
  $("#name").value = exam.name || "";
  $("#date").value = exam.date || "";
  $("#note").value = exam.note || "";
  for (const it of exam.items) {
    const refs = inputsFor(it.subtypeId);
    if (!refs) continue;
    refs.correct.value = String(it.correct);
    refs.minutes.value = it.minutes === null || it.minutes === undefined ? "" : String(it.minutes);
  }
  document.title = "编辑第 " + exam.seq + " 次 · 行测模考分析器";
  const h1 = $("#title");
  if (h1) h1.textContent = "编辑第 " + exam.seq + " 次模考";
}

async function init() {
  markNav();
  if (!root) return;
  state.examId = readId();
  state.editing = Boolean(state.examId);

  try {
    state.store = await getStore();
    state.meta = await state.store.meta();
  } catch (err) {
    showFatal(root, err.message, "请通过 启动.bat 打开页面，不要直接双击 html 文件。");
    return;
  }

  state.types = state.meta.paperTypes;
  if (state.types.length === 0) {
    showFatal(root, "没有可用的试卷类型");
    return;
  }

  if (state.examId) {
    let exam;
    try {
      exam = await state.store.getExam(state.examId);
    } catch (err) {
      toast("加载记录失败：" + err.message, "err", 4000);
    }
    state.type = typeById(exam?.paperTypeId ?? state.meta.defaultPaperTypeId);
    render();
    if (exam) fillExam(exam);
  } else {
    state.type = typeById(state.meta.defaultPaperTypeId);
    render();
    $("#seq").value = String(state.type.nextSeq);
    $("#date").value = todayISO();
    if (restoreDraft()) toast("已恢复上次未保存的输入");
  }

  bind();
  recalc();
  const first = document.querySelector('[data-field="correct"]');
  if (first && !state.examId) first.focus();
}

init().catch((err) => {
  if (root) showFatal(root, err.message || "未知错误");
  console.error(err);
});
