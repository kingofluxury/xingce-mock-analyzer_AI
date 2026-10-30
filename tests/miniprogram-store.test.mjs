import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const memory = {};
globalThis.wx = {
  getStorageSync: (key) => (key in memory ? memory[key] : ""),
  setStorageSync: (key, value) => {
    memory[key] = value;
  },
};

const require = createRequire(import.meta.url);
const core = require("../miniprogram/utils/core.js");
const store = require("../miniprogram/utils/store.js");

function itemsFor(paperTypeId, fn = (s) => s.qty) {
  return core.subtypesOf(paperTypeId).map((s) => ({ subtypeId: s.id, correct: fn(s), minutes: 2 }));
}

beforeEach(() => {
  delete memory["xingce:exams"];
});

test("小程序版元数据包含 4 套试卷", () => {
  const meta = store.meta();
  assert.equal(meta.paperTypes.length, 4);
  assert.equal(meta.paperTypes.find((t) => t.id === 1).totals.qty, 135);
  assert.equal(meta.paperTypes.find((t) => t.id === 3).totals.full, 100.5);
});

test("每种试卷各自编号", () => {
  const a = store.createExam({ paperTypeId: 1, items: itemsFor(1) });
  const b = store.createExam({ paperTypeId: 3, items: itemsFor(3) });
  assert.equal(a.seq, 1);
  assert.equal(b.seq, 1);
  assert.equal(store.listExams().length, 2);
});

test("统计按试卷过滤，副省级满分 100.5", () => {
  store.createExam({ paperTypeId: 3, items: itemsFor(3) });
  const stats3 = store.stats(3);
  assert.equal(stats3.rows.length, 1);
  assert.equal(stats3.rows[0].totals.score, 100.5);
  assert.equal(store.stats(1).rows.length, 0);
});

test("移动只影响同一试卷内的顺序", () => {
  const a = store.createExam({ paperTypeId: 1, name: "A", items: itemsFor(1) });
  const b = store.createExam({ paperTypeId: 1, name: "B", items: itemsFor(1) });
  store.createExam({ paperTypeId: 3, name: "C", items: itemsFor(3) });
  store.moveExam(b.id, 1);
  const type1 = store.listExams().filter((e) => e.paperTypeId === 1).sort((x, y) => x.seq - y.seq);
  assert.deepEqual(type1.map((e) => e.name), ["B", "A"]);
  assert.equal(store.listExams().filter((e) => e.paperTypeId === 3).length, 1);
});

test("导出为 version 2 且包含试卷类型", () => {
  store.createExam({ paperTypeId: 4, name: "国考地市1", items: itemsFor(4) });
  const data = store.exportAll();
  assert.equal(data.version, 2);
  assert.equal(data.exams[0].paperTypeId, 4);
  assert.ok(Array.isArray(data.subtypes));
});

test("导入按试卷 + 次数去重", () => {
  const payload = {
    exams: [
      { paperTypeId: 1, seq: 1, items: itemsFor(1) },
      { paperTypeId: 1, seq: 1, items: itemsFor(1) },
      { paperTypeId: 2, seq: 1, items: itemsFor(2) },
    ],
  };
  const result = store.importExams(payload);
  assert.equal(result.imported, 2);
  assert.equal(result.skipped, 1);
  assert.equal(store.listExams().length, 2);
});

test("清空全部", () => {
  store.createExam({ paperTypeId: 1, items: itemsFor(1) });
  store.clearAll();
  assert.equal(store.listExams().length, 0);
});
