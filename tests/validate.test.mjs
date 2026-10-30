import test from "node:test";
import assert from "node:assert/strict";
import { subtypesOf } from "../app/public/shared/domain.js";
import { normalizeExam, parseId } from "../app/public/shared/validate.js";

const S1 = subtypesOf(1);
const fullItems = () => S1.map((s) => ({ subtypeId: s.id, correct: s.qty, minutes: 3 }));

test("合法数据通过并标准化", () => {
  const out = normalizeExam(
    { seq: 3, name: "如风3", date: "2026-10-20", note: "  状态好  ", items: fullItems() },
    S1
  );
  assert.equal(out.seq, 3);
  assert.equal(out.name, "如风3");
  assert.equal(out.paperTypeId, 1);
  assert.equal(out.date, "2026-10-20");
  assert.equal(out.note, "状态好");
  assert.equal(out.items.length, 12);
  assert.equal(out.items[0].correct, 10);
});

test("可以指定试卷类型", () => {
  const out = normalizeExam({ paperTypeId: 3, items: fullItems() }, S1);
  assert.equal(out.paperTypeId, 3);
});

test("非法试卷类型被拒绝", () => {
  assert.throws(() => normalizeExam({ paperTypeId: 0, items: fullItems() }, S1), /考试类型/);
  assert.throws(() => normalizeExam({ paperTypeId: "x", items: fullItems() }, S1), /考试类型/);
});

test("卷名超长自动截断", () => {
  const out = normalizeExam({ name: "卷".repeat(80), items: fullItems() }, S1);
  assert.equal(out.name.length, 60);
});

test("缺少题型会报错并列出", () => {
  const items = fullItems().slice(0, 5);
  assert.throws(
    () => normalizeExam({ items }, S1),
    (err) => /缺少题型/.test(err.message) && err.details.some((d) => /缺少题型/.test(d))
  );
});

test("答对数越界被拒绝", () => {
  const items = fullItems();
  items[0].correct = 11;
  assert.throws(() => normalizeExam({ items }, S1), /答对数/);
});

test("答对数必须是整数", () => {
  const items = fullItems();
  items[0].correct = 3.5;
  assert.throws(() => normalizeExam({ items }, S1), /整数/);
});

test("重复题型被拒绝", () => {
  const items = fullItems();
  items[1] = { ...items[0] };
  assert.throws(() => normalizeExam({ items }, S1), /重复/);
});

test("用时可以为空，也可以是小数；负数被拒绝", () => {
  const items = fullItems();
  items[0].minutes = "";
  items[1].minutes = 2.5;
  const out = normalizeExam({ items }, S1);
  assert.equal(out.items[0].minutes, null);
  assert.equal(out.items[1].minutes, 2.5);

  const bad = fullItems();
  bad[0].minutes = -1;
  assert.throws(() => normalizeExam({ items: bad }, S1), /用时/);
});

test("非法日期被拒绝", () => {
  assert.throws(() => normalizeExam({ date: "2026/10/20", items: fullItems() }, S1), /日期/);
  assert.throws(() => normalizeExam({ date: "2026-02-30", items: fullItems() }, S1), /日期不存在/);
});

test("备注超长自动截断", () => {
  const out = normalizeExam({ note: "x".repeat(500), items: fullItems() }, S1);
  assert.equal(out.note.length, 200);
});

test("请求体必须是对象", () => {
  assert.throws(() => normalizeExam(null, S1), /JSON 对象/);
  assert.throws(() => normalizeExam([], S1), /JSON 对象/);
  assert.throws(() => normalizeExam({}, S1), /items/);
});

test("parseId 拒绝非法值", () => {
  assert.equal(parseId("12"), 12);
  assert.throws(() => parseId("abc"), /ID/);
  assert.throws(() => parseId("0"), /ID/);
  assert.throws(() => parseId("-3"), /ID/);
});
