import test from "node:test";
import assert from "node:assert/strict";
import { subtypesOf, totalsOf, PAPER_TYPES } from "../app/public/shared/domain.js";
import {
  compactRows,
  diagnose,
  round1,
  scoreOf,
  summarize,
  verdictOf,
} from "../app/public/shared/metrics.js";

const S1 = subtypesOf(1);
const allItems = (correctFn = (s) => s.qty, minutes = 3) =>
  new Map(S1.map((s) => [s.id, { correct: correctFn(s), minutes }]));

test("四种试卷结构合计正确", () => {
  assert.deepEqual(
    PAPER_TYPES.map((t) => [t.id, totalsOf(t.id).qty, totalsOf(t.id).full]),
    [
      [1, 135, 100],
      [2, 130, 100],
      [3, 130, 100.5],
      [4, 135, 100],
    ]
  );
  assert.equal(S1.length, 12);
  assert.equal(subtypesOf(3).length, 9);
});

test("单题得分按分值的十分之一计算，不产生浮点误差", () => {
  const zhengzhi = S1.find((s) => s.id === 1);
  assert.equal(scoreOf(zhengzhi, 9), 6.3);
  assert.equal(scoreOf(zhengzhi, 10), 7);
});

test("满分汇总为 100，全错为 0", () => {
  assert.equal(summarize(allItems(), S1).totals.score, 100);
  assert.equal(summarize(allItems(), S1).totals.correct, 135);
  assert.equal(summarize(allItems(() => 0), S1).totals.score, 0);
});

test("用时缺失时总用时为 null，而不是 0", () => {
  const result = summarize(allItems((s) => s.qty, null), S1);
  assert.equal(result.totals.minutes, null);
  assert.equal(result.totals.missingMinutes, 12);
  assert.equal(result.totals.score, 100);
});

test("期望分与标准误：历史各题型正确率 50% 时期望 50 分，SE≈4.4", () => {
  const half = allItems((s) => s.qty / 2);
  const d = diagnose([half], S1, 5);
  assert.equal(d.expected, 50);
  assert.equal(d.se, 4.4);
  assert.equal(d.window, 5);
});

test("无历史记录时无法给出期望", () => {
  assert.equal(diagnose([], S1, 5), null);
});

test("波动判定以 SE 为阈值", () => {
  assert.equal(verdictOf(0, 4.4), "normal");
  assert.equal(verdictOf(-4, 4.4), "normal");
  assert.equal(verdictOf(-5, 4.4), "low");
  assert.equal(verdictOf(5, 4.4), "high");
  assert.equal(verdictOf(null, 4.4), null);
});

test("第一条记录没有诊断，第二条开始有", () => {
  const items = S1.map((s, i) => ({
    subtypeId: s.id,
    correct: Math.floor(s.qty / 2),
    minutes: 2 + i,
  }));
  const rows = compactRows([
    { id: 1, seq: 1, paperTypeId: 1, date: null, note: null, items },
    { id: 2, seq: 2, paperTypeId: 1, date: null, note: null, items },
  ]);
  assert.equal(rows[0].diagnosis, null);
  assert.ok(rows[1].diagnosis);
  assert.equal(rows[1].diagnosis.expected, 48.1);
  assert.equal(rows[1].diagnosis.verdict, "normal");
  assert.equal(rows[1].subs[1].avgSec, round1((2 * 60) / 10));
});

test("不同试卷类型各自诊断，不互相污染", () => {
  const s1 = S1.map((s) => ({ subtypeId: s.id, correct: Math.floor(s.qty / 2), minutes: 2 }));
  const s3 = subtypesOf(3).map((s) => ({ subtypeId: s.id, correct: s.qty, minutes: 2 }));
  const rows = compactRows([
    { id: 1, seq: 1, paperTypeId: 1, date: null, note: null, items: s1 },
    { id: 2, seq: 1, paperTypeId: 3, date: null, note: null, items: s3 },
  ]);
  assert.equal(rows[1].paperTypeId, 3);
  assert.equal(rows[1].diagnosis, null);
  assert.equal(rows[1].totals.score, 100.5);
});

test("缺项时总分为 null，但子项仍可计算", () => {
  const items = allItems();
  items.delete(1);
  const result = summarize(items, S1);
  assert.equal(result.totals.score, null);
  assert.equal(result.totals.missingCorrect, 1);
  assert.equal(result.subs[1].correct, null);
  assert.equal(result.subs[2].score, 6);
});

