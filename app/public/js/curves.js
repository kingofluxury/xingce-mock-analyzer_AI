import { getStore } from "./store.js";
import { fmt, isNum, mean, stdDev } from "./fmt.js";
import { $, escapeHtml, markNav, showFatal, toast, downloadText, exportedToast, todayISO } from "./ui.js";
import { moduleStats, weakModules, buildMarkdown, buildCsv } from "../shared/report.js";
import { classifyModule } from "../shared/practice-stats.js";
import { markdownToHtml } from "../shared/markdown-lite.js";

const PALETTE = ["#3b6fd4", "#e8833a", "#c94f4f", "#4b9b8a", "#8b6bb1", "#b08a2e"];
const FONT = '"Microsoft YaHei","PingFang SC",system-ui,sans-serif';
const LAZY = window.matchMedia("(max-width: 900px)").matches;
const charts = [];
const root = $("#app");

let store = null;
let meta = null;
let currentType = null;
let currentData = null;

const DEFAULT_WINDOW = 15;
const ranges = new Map();

let practiceByModule = new Map();

function lazyChart(id, option) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!LAZY || !("IntersectionObserver" in window)) {
    makeChart(id, option);
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        obs.disconnect();
        makeChart(id, option);
      }
    },
    { rootMargin: "300px 0px" }
  );
  observer.observe(el);
}

function hasEcharts() {
  return typeof window.echarts !== "undefined";
}

function makeChart(id, option) {
  const el = document.getElementById(id);
  if (!el) return null;
  const instance = window.echarts.init(el, null, { renderer: "canvas" });
  instance.setOption(option);
  charts.push(instance);
  return instance;
}

function disposeCharts() {
  for (const chart of charts) {
    try {
      chart.dispose();
    } catch {
      void 0;
    }
  }
  charts.length = 0;
}

function baseOption(labels, unit, digits, extra = {}) {
  const titleOf = extra.titleOf;
  return {
    animationDuration: 450,
    textStyle: { fontFamily: FONT },
    grid: { left: 46, right: extra.right ?? 34, top: extra.top ?? 16, bottom: 26 },
    legend: { show: false },
    tooltip: {
      trigger: "axis",
      confine: true,
      textStyle: { fontSize: 12, fontFamily: FONT },
      formatter: (params) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const index = params[0].dataIndex;
        const head = titleOf ? titleOf(index) : params[0].axisValue;
        let html = '<div style="font-weight:600;margin-bottom:4px">' + escapeHtml(head) + "</div>";
        for (const p of params) {
          const suffix = p.seriesName.includes("正确率")
            ? "%"
            : p.seriesName.includes("用时")
              ? " 分钟"
              : p.seriesName.includes("得分")
                ? " 分"
                : unit;
          const pDigits = p.seriesName.includes("得分") ? 1 : digits;
          const value = isNum(p.value) ? fmt(p.value, pDigits) + suffix : "—";
          html +=
            '<div style="display:flex;gap:10px;justify-content:space-between">' +
            "<span>" +
            p.marker +
            escapeHtml(p.seriesName) +
            "</span><b>" +
            value +
            "</b></div>";
        }
        return html;
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: extra.boundaryGap ?? false,
      axisLine: { lineStyle: { color: "#d7dade" } },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: "#8a9099", hideOverlap: true },
    },
    yAxis: {
      type: "value",
      min: extra.yMin ?? 0,
      max: extra.yMax ?? null,
      splitNumber: 4,
      interval: extra.yInterval,
      axisLabel: { fontSize: 10, color: "#8a9099", formatter: (v) => fmt(v, digits) + unit },
      splitLine: { lineStyle: { color: "#eef0f3" } },
    },
    series: [],
  };
}

function lineSeries(name, colorIndex, data, digits, unit) {
  return {
    name,
    type: "line",
    smooth: false,
    symbol: "circle",
    symbolSize: 5,
    lineStyle: { width: 2 },
    itemStyle: { color: PALETTE[colorIndex % PALETTE.length] },
    emphasis: { focus: "series" },
    label: {
      show: true,
      position: "top",
      fontSize: 9,
      color: PALETTE[colorIndex % PALETTE.length],
      formatter: (p) => (isNum(p.value) ? fmt(p.value, digits) : ""),
    },
    labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
    endLabel: { show: false },
    data,
  };
}

function legendFor(subtypes) {
  return {
    show: subtypes.length > 1,
    top: 0,
    right: 0,
    itemWidth: 10,
    itemHeight: 6,
    itemGap: 10,
    textStyle: { fontSize: 10, color: "#6b7280" },
  };
}

function moduleCard(mod, index, rows) {
  let pctSum = 0;
  let pctCount = 0;
  let minutesSum = 0;
  let minutesCount = 0;

  for (const row of rows) {
    let qty = 0;
    let correct = 0;
    let minutes = 0;
    let knownMinutes = 0;
    for (const s of mod.subtypes) {
      const cell = row.subs?.[s.id];
      qty += s.qty;
      if (isNum(cell?.correct)) correct += cell.correct;
      if (isNum(cell?.minutes)) {
        minutes += cell.minutes;
        knownMinutes += 1;
      }
    }
    if (qty > 0) {
      pctSum += correct / qty;
      pctCount += 1;
    }
    if (knownMinutes === mod.subtypes.length) {
      minutesSum += minutes;
      minutesCount += 1;
    }
  }

  const avgPct = pctCount ? Math.round((pctSum / pctCount) * 100) : null;
  const avgMinutes = minutesCount ? minutesSum / minutesCount : null;

  return (
    '<section class="card module">' +
    '<div class="card-head"><h2>' +
    escapeHtml(mod.name) +
    '</h2><span class="muted">' +
    mod.subtypes.length +
    " 个子题型 · " +
    mod.qty +
    " 题 / " +
    mod.full +
    ' 分</span><span class="spacer"></span><span class="muted tiny">平均：正确率 ' +
    (avgPct === null ? "—" : avgPct + "%") +
    " · 用时 " +
    (avgMinutes === null ? "—" : fmt(avgMinutes, 0) + " 分钟") +
    "</span></div>" +
    '<div class="grid4">' +
    ["正确率", "总用时"]
      .map(
        (t, i) =>
          '<div class="panel"><div class="t">' +
          t +
          '</div><div class="chart" id="c' +
          index +
          "-" +
          i +
          '"></div></div>'
      )
      .join("") +
    "</div></section>"
  );
}

function verdictHtml(row) {
  if (!row) {
    return '<section class="card"><div class="verdict"><p class="line1">还没有数据</p><p>录入第一次模考后，这里会给出成绩与波动判断。</p></div></section>';
  }
  const d = row.diagnosis;
  const score = row.totals?.score;
  if (!d) {
    return (
      '<section class="card"><div class="verdict"><p class="line1">第 ' +
      row.seq +
      " 次：" +
      fmt(score, 1) +
      " 分</p><p>这是第一条记录，从第 2 次开始就能判断波动是否正常。</p></div></section>"
    );
  }
  const delta = d.delta;
  const abs = isNum(delta) ? Math.abs(delta).toFixed(1) : "—";
  let cls = "";
  let text = "";
  if (d.verdict === "normal") {
    text =
      "第 " +
      row.seq +
      " 次 " +
      fmt(score, 1) +
      " 分，期望 " +
      fmt(d.expected, 1) +
      " 分（±" +
      fmt(d.se, 1) +
      "），偏差 " +
      (isNum(delta) && delta > 0 ? "+" : "") +
      fmt(delta, 1) +
      " 分，属于正常波动。真实水平没有明显变化，不必因这一次调整策略。";
  } else if (d.verdict === "low") {
    cls = "low";
    text =
      "第 " +
      row.seq +
      " 次 " +
      fmt(score, 1) +
      " 分，比期望低 " +
      abs +
      " 分，超出随机波动（SE " +
      fmt(d.se, 1) +
      "）。这次确实有可归因的失分，去看哪个子题型掉得最多。";
  } else {
    cls = "high";
    text =
      "第 " +
      row.seq +
      " 次 " +
      fmt(score, 1) +
      " 分，比期望高 " +
      abs +
      " 分，超出随机波动（SE " +
      fmt(d.se, 1) +
      "）。注意这套卷是否偏简单，别急着加码。";
  }
  const badge =
    d.verdict === "normal"
      ? '<span class="badge ok">正常波动</span>'
      : d.verdict === "low"
        ? '<span class="badge low">低于预期</span>'
        : '<span class="badge high">高于预期</span>';

  return (
    '<section class="card"><div class="verdict ' +
    cls +
    '"><p class="line1">' +
    badge +
    " 第 " +
    row.seq +
    " 次 · " +
    fmt(score, 1) +
    " 分</p><p>" +
    escapeHtml(text) +
    "</p><p class=\"tiny\">期望值基于最近 " +
    d.window +
    " 次的各子题型正确率，标准误 SE 由题量与分值推算。</p></div></section>"
  );
}

function titleOfFactory(rows) {
  return (index) => {
    const row = rows[index];
    if (!row) return "";
    return "第" + row.seq + "次" + (row.name ? " · " + row.name : "");
  };
}

function pctFloor(values) {
  const nums = values.filter(isNum);
  if (nums.length === 0) return 0;
  const lo = Math.min(...nums);
  if (lo < 60) return 0;
  return Math.max(0, Math.floor((lo - 5) / 10) * 10);
}

function renderOverview(rows, full) {
  const labels = rows.map((r) => "第" + r.seq + "次");
  const times = rows.map((r) => r.totals?.minutes ?? null);
  const scores = rows.map((r) => r.totals?.score ?? null);
  const opt = baseOption(labels, "", 0, {
    right: 56,
    top: 30,
    boundaryGap: false,
    titleOf: titleOfFactory(rows),
  });
  opt.legend = {
    show: true,
    top: 2,
    right: 66,
    itemGap: 20,
    itemWidth: 12,
    itemHeight: 6,
    textStyle: { fontSize: 11, color: "#6b7280" },
  };
  opt.yAxis = [
    {
      type: "value",
      name: "分钟",
      nameTextStyle: { fontSize: 10, color: "#8a9099" },
      splitNumber: 4,
      axisLabel: { fontSize: 10, color: "#8a9099", formatter: (v) => fmt(v, 0) },
      splitLine: { lineStyle: { color: "#eef0f3" } },
    },
    {
      type: "value",
      name: "分",
      position: "right",
      min: 0,
      max: full || 100,
      interval: 20,
      nameTextStyle: { fontSize: 10, color: "#8a9099" },
      axisLabel: { fontSize: 10, color: "#8a9099", formatter: (v) => fmt(v, 1) },
      splitLine: { show: false },
    },
  ];
  opt.series = [
    {
      name: "总用时",
      type: "line",
      symbol: "circle",
      symbolSize: 5,
      lineStyle: { width: 2, color: "#e8833a" },
      itemStyle: { color: "#e8833a" },
      connectNulls: false,
      data: times,
    },
    {
      name: "得分",
      type: "line",
      yAxisIndex: 1,
      symbol: "circle",
      symbolSize: 5,
      lineStyle: { width: 2, color: "#4b9b8a" },
      itemStyle: { color: "#4b9b8a" },
      connectNulls: false,
      data: scores,
    },
  ];
  makeChart("c-overview", opt);
}

function renderModuleCharts(mod, index, rows) {
  const labels = rows.map((r) => "第" + r.seq + "次");
  const multi = mod.subtypes.length > 1;

  const build = (panel, unit, digits, getter, yMax, yMin = 0, yInterval) => {
    const opt = baseOption(labels, unit, digits, {
      top: multi ? 30 : 14,
      right: multi ? 40 : 30,
      yMax,
      yMin,
      yInterval,
      titleOf: titleOfFactory(rows),
    });
    opt.legend = legendFor(mod.subtypes);
    opt.series = mod.subtypes.map((s, i) =>
      lineSeries(s.name, i, rows.map((r) => getter(r, s)), digits, unit)
    );
    const id = "c" + index + "-" + panel;
    if (LAZY) lazyChart(id, opt);
    else makeChart(id, opt);
  };

  const pctValues = [];
  for (const r of rows) {
    for (const s of mod.subtypes) {
      const cell = r.subs?.[s.id];
      if (isNum(cell?.pct)) pctValues.push(cell.pct * 100);
    }
  }
  const pctBase = pctFloor(pctValues);

  build(
    0,
    "%",
    0,
    (r, s) => {
      const cell = r.subs?.[s.id];
      return isNum(cell?.pct) ? cell.pct * 100 : null;
    },
    100,
    pctBase,
    pctBase > 0 ? 10 : 25
  );

  build(1, "分钟", 0, (r, s) => {
    const cell = r.subs?.[s.id];
    return isNum(cell?.minutes) ? cell.minutes : null;
  }, null);
}

function renderKpis(rows, total) {
  const pcts = rows.map((r) => r.totals?.pct).filter(isNum);
  const times = rows.map((r) => r.totals?.minutes).filter(isNum);
  const latest = rows[rows.length - 1];
  const avgPct = mean(pcts);
  const sdPct = stdDev(pcts);
  const avgTime = mean(times);

  const items = [
    ["区间末次正确率", isNum(latest?.totals?.pct) ? fmt(latest.totals.pct * 100, 0) + "%" : "—"],
    ["平均正确率", isNum(avgPct) ? fmt(avgPct * 100, 0) + "%" : "—"],
    ["正确率波动 σ", isNum(sdPct) ? fmt(sdPct * 100, 1) + "%" : "—"],
    ["区间末次用时", isNum(latest?.totals?.minutes) ? fmt(latest.totals.minutes, 0) + " 分钟" : "—"],
    ["平均总用时", isNum(avgTime) ? fmt(avgTime, 0) + " 分钟" : "—"],
    ["区间 / 总次数", rows.length + " / " + total],
  ];
  $("#kpis").innerHTML = items
    .map(([k, v]) => '<div class="kpi"><b>' + escapeHtml(v) + "</b><span>" + escapeHtml(k) + "</span></div>")
    .join("");
}

function practiceCell(name, s) {
  const pct = practiceByModule.get(name);
  const tag = classifyModule({
    examGapPts: s.gapPts,
    examAvgPct: s.avgPct,
    practicePct: pct,
  });
  const pctHtml = pct === undefined ? '<span class="muted">未练</span>' : fmt(pct * 100, 0) + "%";
  const tagHtml = tag ? '<span class="badge ' + (tag === "临场问题" ? "high" : "low") + '">' + tag + "</span>" : "";
  return '<td class="num">' + pctHtml + '</td><td class="num">' + tagHtml + "</td>";
}

function diagnosisHtml(stats) {
  const weak = weakModules(stats);
  const hasPractice = practiceByModule.size > 0;
  const head =
    '<div class="card-head"><h2>薄弱板块</h2><span class="muted">以区间平均为基准 · 末次差多少' +
    (hasPractice ? " · 练习取近 30 天" : "") +
    "</span></div>";
  if (stats.length === 0) return "";
  if (weak.length === 0) {
    return (
      '<section class="card">' +
      head +
      '<p class="muted" style="margin:6px 0 0">末次各板块都不低于区间平均，没有明显短板。</p></section>'
    );
  }
  const totalPts = weak.reduce((sum, s) => sum + s.gapPts, 0);
  const totalQty = weak.reduce((sum, s) => sum + s.gapQty, 0);
  const body = weak
    .map(
      (s) =>
        "<tr><td>" +
        escapeHtml(s.name) +
        '</td><td class="num">' +
        fmt(s.lastPct * 100, 0) +
        '%</td><td class="num">' +
        fmt(s.avgPct * 100, 0) +
        '%</td><td class="num">-' +
        fmt(s.gap * 100, 1) +
        '%</td><td class="num">+' +
        fmt(s.gapQty, 1) +
        " 题 / +" +
        fmt(s.gapPts, 1) +
        " 分</td>" +
        (hasPractice ? practiceCell(s.name, s) : "") +
        "</tr>"
    )
    .join("");
  const practiceHead = hasPractice ? '<th class="num">练习</th><th class="num">判定</th>' : "";
  return (
    '<section class="card">' +
    head +
    '<table class="table diag-table"><thead><tr><th>板块</th><th class="num">末次</th><th class="num">区间均</th><th class="num">差距</th><th class="num">补到均线</th>' +
    practiceHead +
    "</tr></thead><tbody>" +
    body +
    "</tbody></table>" +
    '<p class="muted tiny" style="margin:8px 0 0">合计可回收 <b>' +
    fmt(totalQty, 1) +
    " 题 / " +
    fmt(totalPts, 1) +
    " 分</b>（只算低于区间平均的板块，不预测难度变化）</p>" +
    (hasPractice
      ? '<p class="muted tiny" style="margin:4px 0 0">判定：练习也低于模考均线 → 真薄弱；练习达标但模考掉 → 多为临场问题。</p>'
      : "") +
    "</section>"
  );
}

function bullet(s) {
  return s.qty + " 题 / " + s.full + " 分";
}

function paperTypeLabel() {
  const t = meta?.paperTypes?.find((x) => x.id === currentType);
  return t ? t.examType + " " + t.paperName : "第 " + currentType + " 套";
}

function fileStamp(rows, range) {
  const date = todayISO().replace(/-/g, "");
  return (
    "行测复盘-" +
    paperTypeLabel().replace(/\s+/g, "") +
    "-" +
    range.from +
    "至" +
    range.to +
    "-" +
    date
  );
}

async function exportReview(kind) {
  if (!currentData) return;
  const all = currentData.rows;
  const range = rangeOf(all);
  const rows = all.filter((r) => r.seq >= range.from && r.seq <= range.to);
  if (rows.length === 0) return;
  const stats = moduleStats(currentData.modules, rows);
  const name = fileStamp(rows, range);
  if (kind === "csv") {
    const how = await downloadText(name + ".csv", buildCsv(rows), "text/csv");
    exportedToast(how);
    return;
  }
  const how = await downloadText(
    name + ".md",
    buildMarkdown({
      typeLabel: paperTypeLabel(),
      rows,
      range,
      stats,
      total: all.length,
      generatedAt: todayISO(),
    }),
    "text/markdown"
  );
  exportedToast(how);
}

function rangeOf(rows) {
  const saved = ranges.get(currentType);
  if (saved && rows.some((r) => r.seq === saved.from) && rows.some((r) => r.seq === saved.to)) {
    return saved;
  }
  const start = Math.max(0, rows.length - DEFAULT_WINDOW);
  const range = { from: rows[start].seq, to: rows[rows.length - 1].seq };
  ranges.set(currentType, range);
  return range;
}

function rangeHtml(rows, range) {
  const opts = (selected) =>
    rows
      .map(
        (r) =>
          '<option value="' +
          r.seq +
          '"' +
          (r.seq === selected ? " selected" : "") +
          ">" +
          escapeHtml("第 " + r.seq + " 次" + (r.name ? " · " + r.name : "")) +
          "</option>"
      )
      .join("");
  return (
    '<div class="range-bar"><span class="muted tiny">显示</span>' +
    '<select id="range-from" aria-label="起始次数">' +
    opts(range.from) +
    "</select>" +
    '<span class="muted tiny">至</span>' +
    '<select id="range-to" aria-label="结束次数">' +
    opts(range.to) +
    "</select>" +
    '<span class="spacer"></span>' +
    '<button class="btn sm" id="range-recent" type="button">最近 ' +
    Math.min(DEFAULT_WINDOW, rows.length) +
    " 次</button>" +
    '<button class="btn sm" id="range-all" type="button">全部</button></div>'
  );
}

function bindRange(rows) {
  const from = $("#range-from");
  const to = $("#range-to");

  const commit = (next) => {
    const lo = Math.min(next.from, next.to);
    const hi = Math.max(next.from, next.to);
    ranges.set(currentType, { from: lo, to: hi });
    renderAll();
  };

  from?.addEventListener("change", () => commit({ from: Number(from.value), to: Number(to.value) }));
  to?.addEventListener("change", () => commit({ from: Number(from.value), to: Number(to.value) }));

  $("#range-recent")?.addEventListener("click", () => {
    const start = Math.max(0, rows.length - DEFAULT_WINDOW);
    commit({ from: rows[start].seq, to: rows[rows.length - 1].seq });
  });

  $("#range-all")?.addEventListener("click", () =>
    commit({ from: rows[0].seq, to: rows[rows.length - 1].seq })
  );
}

function renderAll() {
  if (!currentData) return;
  const all = currentData.rows;
  const modules = currentData.modules;
  const range = rangeOf(all);
  const rows = all.filter((r) => r.seq >= range.from && r.seq <= range.to);

  disposeCharts();
  const rangeBox = $("#range");
  if (rangeBox) rangeBox.innerHTML = rangeHtml(all, range);
  bindRange(all);

  const modulesBox = $("#modules");
  if (modulesBox) modulesBox.innerHTML = modules.map((m, i) => moduleCard(m, i, rows)).join("");

  const diagBox = $("#diagnosis");
  if (diagBox) diagBox.innerHTML = diagnosisHtml(moduleStats(modules, rows));

  renderOverview(rows, currentData.totals?.full ?? 100);
  modules.forEach((m, i) => renderModuleCharts(m, i, rows));
  renderKpis(rows, all.length);
}

function tabsHtml() {
  return meta.paperTypes
    .map(
      (t) =>
        '<button class="tab' +
        (t.id === currentType ? " active" : "") +
        '" data-type="' +
        t.id +
        '" type="button">' +
        escapeHtml(t.examType + " " + t.paperName) +
        "</button>"
    )
    .join("");
}

async function load(typeId) {
  currentType = Number(typeId);
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.type) === currentType);
  });

  disposeCharts();
  const content = $("#content");
  content.innerHTML = '<div class="card muted">正在加载…</div>';

  let data;
  try {
    data = await store.stats(currentType);
  } catch (err) {
    showFatal(content, err.message, "请通过 启动.bat 打开页面。");
    return;
  }

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const modules = Array.isArray(data?.modules) ? data.modules : [];

  if (rows.length === 0) {
    currentData = null;
    content.innerHTML =
      '<div class="empty"><h3>这套试卷还没有记录</h3><p>换一个试卷标签，或去录入一次。</p><a class="btn primary" href="index.html">去录入</a></div>';
    return;
  }

  currentData = { rows, modules, totals: data.totals };

  practiceByModule = new Map();
  try {
    const ps = await store.practiceSummary(30);
    for (const m of ps?.modules ?? []) {
      if (m.pct !== null && m.pct !== undefined) practiceByModule.set(m.module, m.pct / 100);
    }
  } catch {
    void 0;
  }

  content.innerHTML =
    '<div class="toolbar"><span class="muted tiny">复盘</span><span class="spacer"></span>' +
    '<button class="btn sm" id="export-md" type="button">导出复盘 MD</button>' +
    '<button class="btn sm" id="export-csv" type="button">导出 CSV</button></div>' +
    '<div id="range"></div>' +
    '<div class="kpis" id="kpis"></div>' +
    '<div id="verdict"></div>' +
    '<div id="diagnosis"></div>' +
    '<section class="card"><div class="card-head"><h2>AI 复盘</h2><span class="muted">用上面的统计生成诊断与计划</span><span class="spacer"></span>' +
    '<button class="btn sm primary" id="aiReview" type="button">生成</button></div>' +
    '<div id="aiOut" class="ai-out muted tiny">还没生成。需要先在「设置 → AI 复盘」填 base_url / model / api_key。</div></section>' +
    '<section class="card"><div class="card-head"><h2>得分与用时走势</h2><span class="muted">总用时（左轴，分钟）· 得分（右轴，分）</span></div><div class="chart big" id="c-overview"></div></section>' +
'<div id="modules"></div>' +
    '<p class="muted tiny" style="margin-top:14px">横轴为该试卷的第几次；悬停（手机上点按）可看具体数值与卷名。默认显示最近 ' +
    DEFAULT_WINDOW +
    " 次，可用上方下拉框改成任意区间。</p>";

  $("#verdict").innerHTML = verdictHtml(rows[rows.length - 1]);
  $("#export-md")?.addEventListener("click", () => exportReview("md"));
  $("#export-csv")?.addEventListener("click", () => exportReview("csv"));
  $("#aiReview")?.addEventListener("click", () => generateAiReview());
  renderAll();
}

async function generateAiReview() {
  const btn = $("#aiReview");
  const out = $("#aiOut");
  if (!btn || !out) return;
  btn.disabled = true;
  out.className = "ai-out";
  out.innerHTML = '<span class="muted tiny">正在生成，通常 10–30 秒…</span>';
  try {
    const res = await store.aiReview({ paperTypeId: currentType, window: DEFAULT_WINDOW });
    const meta = '<p class="muted tiny" style="margin:0 0 6px">' + escapeHtml(res.model || "") + "</p>";
    out.innerHTML = meta + markdownToHtml(res.content);
  } catch (err) {
    out.innerHTML = '<p class="muted tiny" style="margin:0">' + escapeHtml(err.message || "生成失败") + "</p>";
  } finally {
    btn.disabled = false;
  }
}

async function init() {
  markNav();
  if (!root) return;

  if (!hasEcharts()) {
    showFatal(root, "图表库未加载", "请确认 app/public/vendor/echarts.min.js 存在。");
    return;
  }

  try {
    store = await getStore();
    meta = await store.meta();
  } catch (err) {
    showFatal(root, err.message, "请通过 启动.bat 打开页面。");
    return;
  }

  if (!meta?.paperTypes?.length) {
    showFatal(root, "没有可用的试卷类型");
    return;
  }

  let exams = [];
  try {
    exams = await store.listExams();
  } catch {
    exams = [];
  }

  const param = Number(new URLSearchParams(location.search).get("paperTypeId"));
  let initial = meta.defaultPaperTypeId;
  if (meta.paperTypes.some((t) => t.id === param)) {
    initial = param;
  } else if (exams.length > 0) {
    initial = exams.reduce((a, b) => (a.id > b.id ? a : b)).paperTypeId;
  }

  root.innerHTML =
    '<div class="tabs">' + tabsHtml() + "</div>" + '<div id="content"></div>';

  root.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (tab) load(Number(tab.dataset.type));
  });

  await load(initial);
}

window.addEventListener("resize", () => {
  for (const chart of charts) {
    try {
      chart.resize();
    } catch {
      void 0;
    }
  }
});

window.addEventListener("pagehide", disposeCharts);

init().catch((err) => {
  console.error(err);
  if (root) showFatal(root, err.message || "未知错误");
  toast("页面渲染失败", "err");
});
