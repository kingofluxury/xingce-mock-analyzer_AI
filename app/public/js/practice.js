import { getStore } from "./store.js";
import { $, $$, markNav, showFatal, toast } from "./ui.js";
import { moduleList } from "../shared/tiku-map.js";
import { scoreAnswers } from "../shared/tiku-question.js";
import {
  tikuCard,
  startCard,
  questionCard,
  resultCard,
  reviewCard,
  reviewGradeCard,
  summaryCard,
  wrongCard,
} from "./views/practice.js";

const root = $("#app");

const state = {
  store: null,
  tiku: null,
  questions: [],
  index: 0,
  picked: null,
  reveal: false,
  marks: [],
  startedAt: 0,
  wrongIds: [],
};

function renderStart() {
  const host = $("#app");
  const moduleStats = state.summary?.modules ?? [];
  const wrong = state.wrong;
  host.innerHTML =
    startCard({ modules: moduleList(), wrong }) +
    tikuCard(state.tiku) +
    summaryCard(state.summary ?? { days: 30, modules: moduleStats }) +
    wrongCard(wrong);
  bindStart();
}

function renderQuestion() {
  const q = state.questions[state.index];
  const host = $("#app");
  host.innerHTML = questionCard(q, state.index, state.questions.length, {
    picked: state.picked,
    reveal: state.reveal,
  });
  if (!state.reveal) {
    $$(".option").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.picked = Number(btn.dataset.pick);
        state.marks[state.index] = state.picked;
        state.reveal = true;
        state.marksSeconds = state.marksSeconds || [];
        state.marksSeconds[state.index] = Math.round((Date.now() - state.questionAt) / 1000);
        renderQuestion();
      })
    );
    return;
  }
  $("#quizNext")?.addEventListener("click", () => {
    if (state.index + 1 >= state.questions.length) finishQuiz();
    else {
      state.index += 1;
      state.picked = null;
      state.reveal = false;
      state.questionAt = Date.now();
      renderQuestion();
    }
  });
}

async function startQuiz() {
  const module = ($('input[name="quizModule"]:checked') || {}).value || moduleList()[0];
  const limit = Number($("#quizCount")?.value || 10);
  const category = $("#quizCategory")?.value || null;
  const btn = $("#quizStart");
  if (btn) btn.disabled = true;
  try {
    const res = await state.store.tikuQuestions({ module, limit, category });
    if (!res?.available) {
      toast("题库未就绪，请先放置 app/data/tiku.db", "err", 4200);
      if (btn) btn.disabled = false;
      return;
    }
    const list = Array.isArray(res.questions) ? res.questions : [];
    if (list.length === 0) {
      toast("这个范围里没有抽到题，换模块或范围再试", "err", 3600);
      if (btn) btn.disabled = false;
      return;
    }
    state.questions = list;
    state.index = 0;
    state.picked = null;
    state.reveal = false;
    state.marks = new Array(list.length).fill(null);
    state.marksSeconds = new Array(list.length).fill(null);
    state.startedAt = Date.now();
    state.questionAt = Date.now();
    renderQuestion();
  } catch (err) {
    toast(err.message || "抽题失败", "err", 4000);
    if (btn) btn.disabled = false;
  }
}

async function finishQuiz() {
  const items = state.questions.map((q, i) => ({
    questionId: q.questionId,
    module: q.module,
    answerIndex: q.answerIndex,
    pickedIndex: state.marks[i],
    seconds: state.marksSeconds[i],
  }));
  const result = scoreAnswers(items);
  let saved = null;
  try {
    saved = await state.store.logPractice(result.results);
  } catch (err) {
    toast("练习记录保存失败：" + (err.message || ""), "err", 4200);
  }
  $("#app").innerHTML = resultCard(result, saved);
  $("#quizAgain")?.addEventListener("click", () => {
    void refreshAll().then(renderStart);
  });
}

async function startReview() {
  const due = state.wrongItems ?? [];
  if (due.length === 0) {
    toast("今天没有待复习的错题", "", 3000);
    return;
  }
  const ids = due.map((r) => r.questionId);
  const res = await state.store.tikuQuestions({ ids });
  const list = (res?.questions ?? []).filter((q) => ids.includes(q.questionId));
  if (list.length === 0) {
    toast("错题对应的题目在题库里找不到", "err", 3600);
    return;
  }
  state.questions = list;
  state.index = 0;
  state.picked = null;
  state.reveal = true;
  state.questionAt = Date.now();
  renderReview();
}

function renderReview() {
  const q = state.questions[state.index];
  $("#app").innerHTML =
    reviewCard(q, state.index, state.questions.length) +
    reviewGradeCard() +
    '<div class="quiz-controls"><span class="spacer"></span><button class="btn sm" id="reviewQuit" type="button">结束复习</button></div>';
  $$("[data-grade]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const quality = Number(btn.dataset.grade);
      try {
        await state.store.reviewWrong(q.questionId, quality);
      } catch (err) {
        toast(err.message || "保存复习结果失败", "err", 3600);
      }
      if (state.index + 1 >= state.questions.length) {
        toast("复习完成", "ok", 2600);
        void refreshAll().then(renderStart);
      } else {
        state.index += 1;
        renderReview();
      }
    })
  );
  $("#reviewQuit")?.addEventListener("click", () => {
    void refreshAll().then(renderStart);
  });
}

async function refreshAll() {
  const [tiku, summary, wrong, due] = await Promise.allSettled([
    state.store.tikuStatus(),
    state.store.practiceSummary(30),
    state.store.wrongBookStats(),
    state.store.wrongBookDue(50),
  ]);
  state.tiku = tiku.status === "fulfilled" ? tiku.value : { available: false };
  state.summary = summary.status === "fulfilled" ? summary.value : null;
  state.wrong = wrong.status === "fulfilled" ? wrong.value : null;
  state.wrongItems = due.status === "fulfilled" ? due.value : [];
}

function bindStart() {
  $("#quizStart")?.addEventListener("click", () => void startQuiz());
  $("#quizReview")?.addEventListener("click", () => void startReview());
  $("#quizQuit")?.addEventListener("click", () => {
    if (confirm("结束本次练习？已答的题不会记录。")) void refreshAll().then(renderStart);
  });
}

async function init() {
  markNav();
  if (!root) return;
  try {
    state.store = await getStore();
  } catch (err) {
    showFatal(root, err.message, "请通过 启动.bat 打开页面。");
    return;
  }
  await refreshAll();

  if (state.tiku?.available === false && state.store.kind === "local") {
    root.innerHTML = tikuCard(state.tiku);
    return;
  }
  root.innerHTML = "";
  renderStart();
}

init().catch((err) => {
  console.error(err);
  if (root) showFatal(root, err.message || "未知错误");
});

