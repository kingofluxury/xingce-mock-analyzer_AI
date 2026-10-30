# -*- coding: utf-8 -*-
"""从「如风刷题.xlsx」生成单页交互曲线图。

用法：
    python tools/build_charts.py
    python tools/build_charts.py --src docs/如风刷题.xlsx --out docs/如风-题型曲线.html

数据口径（已与用户确认）：
- 每个子题型：奇数行 = 答对数，偶数行 = 用时（分钟，文本形如 "3min"）
- 每题分值取第 3 行，第 2 行为题量
- 合计一律由子类明细相加，不读表内合计栏
"""
import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import openpyxl

# (列, 模块, 子题型, 题量, 每题分值)  —— 题量/分值会与表内第2、3行交叉校验
SPEC = [
    ("B", "政治理论", "政治理论", 10, 0.7),
    ("D", "常识判断", "常识判断", 10, 0.6),
    ("F", "言语理解", "片段阅读", 15, 0.7),
    ("G", "言语理解", "选词填空", 10, 0.5),
    ("H", "言语理解", "文章阅读", 5, 0.7),
    ("K", "数量关系", "数字推理", 5, 0.7),
    ("L", "数量关系", "数字运算", 15, 0.9),
    ("O", "判断推理", "类比推理", 10, 0.5),
    ("P", "判断推理", "图形推理", 10, 0.8),
    ("Q", "判断推理", "逻辑判断", 15, 0.8),
    ("R", "判断推理", "定义判断", 10, 0.8),
    ("U", "资料分析", "资料分析", 20, 0.9),
]

TIME_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(?:min|分钟)?\s*$", re.I)


def parse_minutes(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = TIME_RE.match(str(v))
    return float(m.group(1)) if m else None


def load(src: Path):
    wb = openpyxl.load_workbook(src, data_only=False)
    ws = wb["Sheet1"]

    issues = []
    for col, mod, sub, qty, pts in SPEC:
        q = ws[f"{col}2"].value
        p = ws[f"{col}3"].value
        if q != qty:
            issues.append(f"{col}2 题量为 {q!r}，与脚本内置 {qty} 不一致")
        if p is None or abs(float(p) - pts) > 1e-9:
            issues.append(f"{col}3 分值为 {p!r}，与脚本内置 {pts} 不一致")

    attempts = []
    for r in range(4, ws.max_row + 1, 2):
        a = ws[f"A{r}"].value
        if not isinstance(a, (int, float)):
            continue
        # 只有序号、没有数据的行视为空白模板，跳过
        if all(ws[f"{col}{r}"].value is None for col, *_ in SPEC):
            continue
        row = {"attempt": int(a), "subs": {}, "agg_time": {}}
        for col, mod, sub, qty, pts in SPEC:
            c = ws[f"{col}{r}"].value
            t = parse_minutes(ws[f"{col}{r + 1}"].value)
            if c is None:
                issues.append(f"第 {int(a)} 次「{sub}」答对数缺失")
                c = 0
            if t is None:
                issues.append(f"第 {int(a)} 次「{sub}」用时缺失/无法解析")
                t = 0.0
            row["subs"][sub] = {"module": mod, "qty": qty, "pts": pts,
                                "correct": float(c), "time": float(t)}
        for col, name, members in [
            ("I", "言语理解", ["片段阅读", "选词填空", "文章阅读"]),
            ("M", "数量关系", ["数字推理", "数字运算"]),
            ("S", "判断推理", ["类比推理", "图形推理", "逻辑判断", "定义判断"]),
        ]:
            agg = parse_minutes(ws[f"{col}{r + 1}"].value)
            got = sum(row["subs"][m]["time"] for m in members)
            if agg is not None and abs(got - agg) > 0.01:
                issues.append(
                    f"第 {int(a)} 次「{name}」合计 {agg:g}min ≠ 子类相加 {got:g}min（以子类为准）"
                )
        attempts.append(row)

    if not attempts:
        raise SystemExit("没有解析到任何模考记录")

    modules = []
    order = []
    for _, mod, sub, qty, pts in SPEC:
        if mod not in order:
            order.append(mod)
    for mod in order:
        subs = [s for s in SPEC if s[1] == mod]
        modules.append({
            "name": mod,
            "qty": sum(s[3] for s in subs),
            "full": round(sum(s[3] * s[4] for s in subs), 2),
            "subs": [{"name": s[2], "qty": s[3], "pts": s[4]} for s in subs],
        })

    data = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": src.name,
        "attempts": [a["attempt"] for a in attempts],
        "modules": modules,
        "rows": {
            a["attempt"]: {
                "subs": a["subs"],
                "score": round(sum(v["correct"] * v["pts"] for v in a["subs"].values()), 1),
                "correct": int(sum(v["correct"] for v in a["subs"].values())),
                "time": round(sum(v["time"] for v in a["subs"].values()), 1),
            } for a in attempts
        },
        "issues": issues,
    }
    return data


HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>行测题型曲线 · 如风刷题</title>
<script src="vendor/echarts.min.js"></script>
<style>
  :root{
    --bg:#f6f7f9; --card:#fff; --ink:#1c2024; --sub:#6b7280;
    --line:#e6e8eb; --accent:#3b6fd4;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:14px/1.6 "Microsoft YaHei","PingFang SC","Hiragino Sans GB",system-ui,sans-serif}
  header{max-width:1180px;margin:0 auto;padding:28px 20px 10px}
  h1{margin:0;font-size:22px;letter-spacing:.5px}
  .meta{color:var(--sub);font-size:13px;margin-top:6px}
  .kpis{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px;min-width:118px}
  .kpi b{display:block;font-size:19px;letter-spacing:.3px}
  .kpi span{color:var(--sub);font-size:12px}
  main{max-width:1180px;margin:0 auto;padding:10px 20px 48px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;
    padding:16px 18px 8px;margin-top:16px}
  .card-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px}
  .card-h h2{margin:0;font-size:16px}
  .card-h .tag{color:var(--sub);font-size:12px}
  .card-h .now{margin-left:auto;color:var(--sub);font-size:12px}
  .grid4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px}
  .panel .t{font-size:12px;color:var(--sub);margin:2px 0 0 6px}
  .chart{width:100%;height:172px}
  .chart.big{height:250px}
  @media(max-width:860px){.grid4{grid-template-columns:1fr}.chart{height:190px}}
  details{margin-top:22px;color:var(--sub);font-size:13px}
  details summary{cursor:pointer}
  details ul{margin:8px 0 0;padding-left:18px}
</style>
</head>
<body>
<header>
  <h1>行测题型曲线</h1>
  <div class="meta" id="meta"></div>
  <div class="kpis" id="kpis"></div>
</header>
<main>
  <section class="card">
    <div class="card-h"><h2>总分走势</h2><span class="tag">得分（柱）· 总用时（线，右轴）</span></div>
    <div class="chart big" id="c-overview"></div>
  </section>
  <div id="modules"></div>
  <details><summary>数据口径与异常</summary><ul id="issues"></ul></details>
</main>
<script>
const DATA = /*__DATA__*/ null;

const FONT = '"Microsoft YaHei","PingFang SC",system-ui,sans-serif';
const PALETTE = ['#3b6fd4','#e8833a','#c94f4f','#4b9b8a','#8b6bb1','#b08a2e'];
const X = DATA.attempts.map(a => '第' + a + '次');

function fmtNum(v, d = 1) { return Number(v).toFixed(d); }

function seriesOf(key, unit, digits, type) {
  // key(attempt, sub) => number
  return (subs, metric) => subs.map((s, i) => ({
    name: s.name,
    type: type || 'line',
    smooth: false,
    symbol: 'circle',
    symbolSize: 5,
    lineStyle: { width: 2 },
    itemStyle: { color: PALETTE[i % PALETTE.length] },
    emphasis: { focus: 'series' },
    labelLayout: { moveOverlap: 'shiftY' },
    endLabel: {
      show: subs.length > 0,
      formatter: p => fmtNum(p.value, digits) + unit,
      fontSize: 10,
      color: PALETTE[i % PALETTE.length],
      distance: 4
    },
    data: DATA.attempts.map(a => metric(DATA.rows[a], s))
  }));
}

function baseOption(subs, title, unit, digits, yMax) {
  const rich = subs.length > 1;
  return {
    animationDuration: 500,
    textStyle: { fontFamily: FONT },
    grid: { left: 46, right: rich ? 68 : 30, top: rich ? 34 : 14, bottom: 26 },
    legend: rich ? {
      top: 0, right: 0, itemWidth: 10, itemHeight: 6,
      textStyle: { fontSize: 10, color: '#6b7280' }
    } : { show: false },
    tooltip: {
      trigger: 'axis',
      confine: true,
      textStyle: { fontSize: 12, fontFamily: FONT },
      valueFormatter: v => fmtNum(v, digits) + unit
    },
    xAxis: {
      type: 'category',
      data: X,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#d7dade' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: '#8a9099', hideOverlap: true }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yMax,
      splitNumber: unit === '%' ? 4 : 3,
      axisLabel: { fontSize: 10, color: '#8a9099', formatter: v => fmtNum(v, digits) + unit },
      splitLine: { lineStyle: { color: '#eef0f3' } }
    },
    series: []
  };
}

function chart(id) {
  const el = document.getElementById(id);
  const ins = echarts.init(el, null, { renderer: 'canvas' });
  return ins;
}

// ---------- 总分走势 ----------
(function () {
  const opt = baseOption([], '', '', 0);
  opt.grid = { left: 44, right: 56, top: 34, bottom: 26 };
  opt.legend = { top: 2, right: 10, itemGap: 18, itemWidth: 12, itemHeight: 6, textStyle: { fontSize: 11, color: '#6b7280' } };
  opt.xAxis.boundaryGap = true;
  opt.yAxis = [
    { type: 'value', name: '分', nameTextStyle: { fontSize: 10, color: '#8a9099' }, min: 0, max: 100,
      axisLabel: { fontSize: 10, color: '#8a9099' }, splitLine: { lineStyle: { color: '#eef0f3' } } },
    { type: 'value', name: '分钟', nameTextStyle: { fontSize: 10, color: '#8a9099' },
      axisLabel: { fontSize: 10, color: '#8a9099' }, splitLine: { show: false } }
  ];
  opt.series = [
    { name: '得分', type: 'bar', barWidth: '46%', itemStyle: { color: '#c9d8f5', borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', fontSize: 10, color: '#3b6fd4', formatter: p => fmtNum(p.value, 1) },
      data: DATA.attempts.map(a => DATA.rows[a].score) },
    { name: '总用时', type: 'line', yAxisIndex: 1, symbol: 'circle', symbolSize: 5,
      lineStyle: { width: 2, color: '#e8833a' }, itemStyle: { color: '#e8833a' },
      data: DATA.attempts.map(a => DATA.rows[a].time) }
  ];
  chart('c-overview').setOption(opt);
})();

// ---------- 各模块 ----------
const wrap = document.getElementById('modules');

DATA.modules.forEach(mod => {
  const card = document.createElement('section');
  card.className = 'card';

  const list = DATA.attempts.map(a => DATA.rows[a]);
  const last = list[list.length - 1];
  const lastSubs = mod.subs.map(s => last.subs[s.name]);
  const lastScore = lastSubs.reduce((t, v) => t + v.correct * v.pts, 0);
  const lastCor = lastSubs.reduce((t, v) => t + v.correct, 0) / mod.qty * 100;
  const lastTime = lastSubs.reduce((t, v) => t + v.time, 0);

  card.innerHTML =
    '<div class="card-h"><h2>' + mod.name + '</h2>' +
    '<span class="tag">' + mod.subs.length + ' 个子题型 · ' + mod.qty + ' 题 / ' + mod.full + ' 分</span>' +
    '<span class="now">最近一次：得分 ' + fmtNum(lastScore, 1) + ' · 正确率 ' + fmtNum(lastCor, 0) + '% · 用时 ' + fmtNum(lastTime, 0) + 'min</span></div>' +
    '<div class="grid4">' +
      ['正确率','得分','总用时','平均每题用时'].map((t, i) =>
        '<div class="panel"><div class="t">' + t + '</div><div class="chart" id="m' + mod.name + '-' + i + '"></div></div>'
      ).join('') +
    '</div>';
  wrap.appendChild(card);

  const mk = (idx, unit, digits, getter, yMax) => {
    const opt = baseOption(mod.subs, '', unit, digits, yMax);
    opt.series = seriesOf('', unit, digits)(mod.subs, getter);
    chart('m' + mod.name + '-' + idx).setOption(opt);
  };

  mk(0, '%', 0, (row, s) => row.subs[s.name].correct / s.qty * 100, 100);
  mk(1, '分', 1, (row, s) => row.subs[s.name].correct * s.pts, mod.full);
  mk(2, 'min', 0, (row, s) => row.subs[s.name].time, null);
  mk(3, 's', 0, (row, s) => row.subs[s.name].time * 60 / s.qty, null);
});

// ---------- 头部 ----------
document.getElementById('meta').textContent =
  DATA.attempts.length + ' 次模考（第 ' + DATA.attempts[0] + '–' + DATA.attempts[DATA.attempts.length - 1] +
  ' 次） · 135 题 / 100 分 · 数据源 ' + DATA.source + ' · 生成于 ' + DATA.generated;

const scores = DATA.attempts.map(a => DATA.rows[a].score);
const times = DATA.attempts.map(a => DATA.rows[a].time);
const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
const sd = Math.sqrt(scores.reduce((t, v) => t + (v - avg) ** 2, 0) / scores.length);
document.getElementById('kpis').innerHTML = [
  ['最近得分', fmtNum(scores[scores.length - 1], 1) + ' 分'],
  ['平均得分', fmtNum(avg, 1) + ' 分'],
  ['得分波动 σ', fmtNum(sd, 1) + ' 分'],
  ['最高 / 最低', fmtNum(Math.max(...scores), 1) + ' / ' + fmtNum(Math.min(...scores), 1)],
  ['平均总用时', fmtNum(times.reduce((a, b) => a + b, 0) / times.length, 0) + ' min']
].map(([k, v]) => '<div class="kpi"><b>' + v + '</b><span>' + k + '</span></div>').join('');

const iss = document.getElementById('issues');
iss.innerHTML = (DATA.issues.length ? DATA.issues : ['无异常（子类明细与合计栏一致）'])
  .map(t => '<li>' + t + '</li>').join('');

window.addEventListener('resize', () => {
  document.querySelectorAll('.chart').forEach(el => {
    const inst = echarts.getInstanceByDom(el);
    if (inst) inst.resize();
  });
});
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    root = Path(__file__).resolve().parent.parent
    ap.add_argument("--src", default=str(root / "docs" / "如风刷题.xlsx"))
    ap.add_argument("--out", default=str(root / "docs" / "如风-题型曲线.html"))
    args = ap.parse_args()

    src = Path(args.src)
    data = load(src)
    html = HTML.replace("/*__DATA__*/ null", json.dumps(data, ensure_ascii=False))
    out = Path(args.out)
    out.write_text(html, encoding="utf-8")

    print(f"已生成 {out}")
    print(f"模考次数 {len(data['attempts'])}，模块 {len(data['modules'])}，异常 {len(data['issues'])} 条")
    for i in data["issues"]:
        print("  -", i)


if __name__ == "__main__":
    main()
