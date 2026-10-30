import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleStats, weakModules, buildMarkdown, buildCsv } from "../app/public/shared/report.js";

const modules = [
  {
    name: "资料分析",
    qty: 20,
    full: 18,
    subtypes: [{ id: 1, qty: 20 }],
  },
  {
    name: "言语理解",
    qty: 30,
    full: 19,
    subtypes: [{ id: 2, qty: 30 }],
  },
];

function row(seq, a, b) {
  return {
    seq,
    name: "卷" + seq,
    date: "2026-10-0" + seq,
    note: seq === 1 ? '含"引号",逗号' : null,
    totals: { score: 60 + seq, pct: (a + b) / 50, minutes: 120 },
    subs: { 1: { correct: a, pct: a / 20 }, 2: { correct: b, pct: b / 30 } },
  };
}

const rows = [row(1, 10, 20), row(2, 18, 15)];

test("moduleStats 用区间累计正确率算均线，差值按题量与满分折算", () => {
  const stats = moduleStats(modules, rows);
  const data = stats[0];
  assert.equal(data.name, "资料分析");
  assert.equal(data.avgPct, (10 + 18) / 40);
  assert.equal(data.lastPct, 18 / 20);
  assert.ok(Math.abs(data.gap - (0.7 - 0.9)) < 1e-9);
  assert.ok(Math.abs(data.gapQty - -4) < 1e-9);
  assert.ok(Math.abs(data.gapPts - -3.6) < 1e-9);
});

test("weakModules 只保留末次低于均线的板块，按可回收分排序", () => {
  const stats = moduleStats(modules, rows);
  const weak = weakModules(stats);
  assert.equal(weak.length, 1);
  assert.equal(weak[0].name, "言语理解");
  assert.ok(weak[0].gapPts > 0);
});

test("buildMarkdown 覆盖区间、成绩表、板块表与薄弱结论", () => {
  const stats = moduleStats(modules, rows);
  const md = buildMarkdown({
    typeLabel: "江苏 A/B类",
    rows,
    range: { from: 1, to: 2 },
    stats,
    total: 5,
    generatedAt: "2026-10-30",
  });
  assert.ok(md.startsWith("# 行测复盘 · 江苏 A/B类"));
  assert.ok(md.includes("第 1 次 → 第 2 次（2 条 / 共 5 条）"));
  assert.ok(md.includes("| 卷2 | 62.0 |"));
  assert.ok(md.includes("## 薄弱板块"));
  assert.ok(md.includes("言语理解："));
  assert.ok(md.includes("合计可回收："));
});

test("buildCsv 带 BOM、表头与转义", () => {
  const csv = buildCsv(rows);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("次数,日期,卷名,得分,正确率,用时分钟,备注"));
  assert.ok(csv.includes('"含""引号"",逗号"'));
  assert.ok(csv.split("\n").length >= 3);
});
