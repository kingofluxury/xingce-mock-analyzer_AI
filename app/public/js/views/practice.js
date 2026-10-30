import { escapeHtml } from "../ui.js";
import { fmt } from "../fmt.js";

export function pctText(v) {
  return v === null || v === undefined ? "—" : fmt(v, 1) + "%";
}

export function tikuCard(tiku) {
  if (tiku?.available) {
    const rows = Object.entries(tiku.modules ?? {})
      .map(
        ([name, n]) =>
          "<tr><td>" +
          escapeHtml(name) +
          '</td><td class="num">' +
          Number(n).toLocaleString() +
          " 题</td></tr>"
      )
      .join("");
    return (
      '<section class="card"><div class="card-head"><h2>题库</h2><span class="muted">' +
      (tiku.papers ? Number(tiku.papers).toLocaleString() + " 卷 / " : "内置题库 · ") +
      Number(tiku.questions).toLocaleString() +
      " 题" +
      (tiku.generatedAt ? " · " + escapeHtml(String(tiku.generatedAt)) : "") +
      "</span></div>" +
      '<table class="table"><thead><tr><th>模块</th><th class="num">题量</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></section>"
    );
  }
  return (
    '<section class="card"><div class="card-head"><h2>题库未就绪</h2><span class="muted">缺 app/data/tiku.db</span></div>' +
    '<ol class="muted" style="margin:8px 0 0;padding-left:20px;line-height:1.9">' +
    "<li>克隆 <code>https://github.com/ERRRC/kaogong-shuati</code></li>" +
    "<li>在仓库里跑 <code>node tools/reassemble-tiku.mjs</code>，得到 <code>tiku.db</code></li>" +
    "<li>把 <code>tiku.db</code> 放到 <code>" +
    escapeHtml(tiku?.path || "app/data/tiku.db") +
    "</code></li>" +
    "<li>刷新本页</li></ol>" +
    (tiku?.error ? '<p class="muted tiny">读取失败：' + escapeHtml(tiku.error) + "</p>" : "") +
    '<p class="muted tiny" style="margin:8px 0 0">刷题依赖桌面版的本地文件读取；网页/手机版只做统计。</p></section>'
  );
}

export function startCard({ modules, wrong }) {
  const moduleOptions = modules
    .map(
      (m, i) =>
        '<label class="chip"><input type="radio" name="quizModule" value="' +
        escapeHtml(m) +
        '"' +
        (i === 0 ? " checked" : "") +
        "> " +
        escapeHtml(m) +
        "</label>"
    )
    .join("");
  return (
    '<section class="card"><div class="card-head"><h2>开始练习</h2><span class="muted">真题随机抽题，答错自动进错题本</span></div>' +
    '<div class="chips" id="quizModules">' +
    moduleOptions +
    "</div>" +
    '<div class="quiz-controls">' +
    '<label class="tiny muted">题量 <select id="quizCount">' +
    ['5', '10', '20']
      .map((n) => '<option value="' + n + '"' + (n === "10" ? " selected" : "") + ">" + n + " 题</option>")
      .join("") +
    "</select></label>" +
    '<label class="tiny muted">范围 <select id="quizCategory">' +
    ['', '国考', '江苏']
      .map((c) => '<option value="' + c + '">' + (c || "全部省份") + "</option>")
      .join("") +
    "</select></label>" +
    '<span class="spacer"></span>' +
    '<button class="btn primary" id="quizStart" type="button">开始刷题</button>' +
    (wrong?.due > 0
      ? '<button class="btn" id="quizReview" type="button">复习错题 ' + wrong.due + '</button>'
      : "") +
    "</div></section>"
  );
}

export function questionCard(question, index, total, { picked, reveal, showVerdict = true }) {
  const options = question.options
    .map((opt, i) => {
      let cls = "option";
      if (reveal) {
        if (i === question.answerIndex) cls += " correct";
        else if (i === picked) cls += " wrong";
      } else if (i === picked) {
        cls += " picked";
      }
      return (
        '<button class="' +
        cls +
        '" data-pick="' +
        i +
        '" type="button"' +
        (reveal ? " disabled" : "") +
        "><b>" +
        opt.letter +
        "</b><span>" +
        opt.html +
        "</span></button>"
      );
    })
    .join("");
  const media = question.contentHtml.includes("<img") ? '<p class="tiny muted">图片题：若图片不显示，说明源图需联网</p>' : "";
  return (
    '<section class="card"><div class="card-head"><h2>第 ' +
    (index + 1) +
    " / " +
    total +
    " 题</h2><span class=\"muted\">" +
    escapeHtml(question.module || "") +
    (question.paperName ? " · " + escapeHtml(question.paperName) : "") +
    '</span><span class="spacer"></span><button class="btn sm" id="quizQuit" type="button">结束</button></div>' +
    '<div class="stem">' +
    question.contentHtml +
    media +
    "</div>" +
    '<div class="options">' +
    options +
    "</div>" +
    (reveal && showVerdict
      ? '<div class="answer-note ' +
        (picked === question.answerIndex ? "ok" : "low") +
        '">' +
        (picked === question.answerIndex ? "答对了" : "答错，正确答案 " + question.answerLetter) +
        "</div>" +
        '<div class="analysis">' +
        (question.analysisHtml || '<span class="muted">这道题没有解析</span>') +
        "</div>" +
        '<div class="quiz-controls"><span class="spacer"></span><button class="btn primary" id="quizNext" type="button">' +
        (index + 1 >= total ? "交卷" : "下一题") +
        "</button></div>"
      : "") +
    "</section>"
  );
}

export function resultCard(result, saved) {
  const rows = result.results
    .map(
      (r) =>
        "<tr><td>" +
        escapeHtml(r.questionId) +
        '</td><td class="num">' +
        (r.correct ? '<span class="badge ok">对</span>' : '<span class="badge low">错</span>') +
        "</td></tr>"
    )
    .join("");
  return (
    '<section class="card"><div class="card-head"><h2>本次结果</h2><span class="muted">答对 ' +
    result.correct +
    " / " +
    result.answered +
    (result.pct === null ? "" : " · " + pctText(result.pct)) +
    "</span></div>" +
    '<div class="kpis">' +
    '<div class="kpi"><b>' + result.correct + "</b><span>答对</span></div>" +
    '<div class="kpi"><b>' + Math.max(result.answered - result.correct, 0) + "</b><span>答错</span></div>" +
    '<div class="kpi"><b>' + (saved?.wrong ?? 0) + "</b><span>新进错题本</span></div>" +
    "</div>" +
    (result.answered === 0
      ? ""
      : '<table class="table"><thead><tr><th>题目</th><th class="num">结果</th></tr></thead><tbody>' +
        rows +
        "</tbody></table>") +
    '<div class="quiz-controls"><span class="spacer"></span><button class="btn primary" id="quizAgain" type="button">再来一组</button></div>' +
    "</section>"
  );
}

export function reviewCard(question, index, total) {
  return questionCard(question, index, total, { picked: null, reveal: true, showVerdict: false });
}

export function reviewGradeCard() {
  return (
    '<section class="card"><div class="card-head"><h2>这题记得吗</h2><span class="muted">SM-2 按你的回忆程度排下次复习</span></div>' +
    '<div class="quiz-controls">' +
    '<button class="btn danger" data-grade="2" type="button">忘了</button>' +
    '<button class="btn" data-grade="4" type="button">有点模糊</button>' +
    '<button class="btn primary" data-grade="5" type="button">记得</button>' +
    "</div></section>"
  );
}

export function summaryCard(summary) {
  const modules = summary?.modules ?? [];
  const total = modules.reduce((sum, m) => sum + m.qty, 0);
  const rows = modules
    .filter((m) => m.qty > 0)
    .map(
      (m) =>
        "<tr><td>" +
        escapeHtml(m.module) +
        '</td><td class="num">' +
        m.qty +
        '</td><td class="num">' +
        (m.qty ? pctText(m.pct) : "—") +
        "</td></tr>"
    )
    .join("");
  return (
    '<section class="card"><div class="card-head"><h2>近 ' +
    (summary?.days ?? 30) +
    ' 天练习</h2><span class="muted">共 ' +
    total +
    ' 题</span></div>' +
    (total === 0
      ? '<p class="muted" style="margin:6px 0 0">还没有练习记录。</p>'
      : '<table class="table"><thead><tr><th>模块</th><th class="num">题量</th><th class="num">正确率</th></tr></thead><tbody>' +
        rows +
        "</tbody></table>") +
    "</section>"
  );
}

export function wrongCard(stats) {
  return (
    '<section class="card"><div class="card-head"><h2>错题本</h2><span class="muted">SM-2 间隔重复</span></div>' +
    '<div class="kpis"><div class="kpi"><b>' +
    (stats?.total ?? 0) +
    "</b><span>错题总数</span></div>" +
    '<div class="kpi"><b>' +
    (stats?.due ?? 0) +
    "</b><span>今日待复习</span></div></div></section>"
  );
}
