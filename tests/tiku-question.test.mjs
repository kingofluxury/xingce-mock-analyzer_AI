import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseOptions,
  optionLetter,
  isJudgeable,
  normalizeQuestion,
  scoreAnswers,
  sanitizeHtml,
} from "../app/public/shared/tiku-question.js";

test("parseOptions 容错：数组 / JSON 串 / 坏数据", () => {
  assert.deepEqual(parseOptions('["A","B"]'), ["A", "B"]);
  assert.deepEqual(parseOptions(["A", 1]), ["A", "1"]);
  assert.deepEqual(parseOptions("[object Object]"), []);
  assert.deepEqual(parseOptions(""), []);
  assert.deepEqual(parseOptions(null), []);
});

test("optionLetter 用 A-H，越界给 ?", () => {
  assert.equal(optionLetter(0), "A");
  assert.equal(optionLetter(3), "D");
  assert.equal(optionLetter(8), "?");
  assert.equal(optionLetter(-1), "?");
});

test("isJudgeable 只认单选 + 2-6 选项 + 索引在范围内", () => {
  const base = { type: 1, options: '["1","2","3","4"]', answerIndex: 2 };
  assert.equal(isJudgeable(base), true);
  assert.equal(isJudgeable({ ...base, type: 2 }), false);
  assert.equal(isJudgeable({ ...base, answerIndex: 4 }), false);
  assert.equal(isJudgeable({ ...base, answerIndex: -1 }), false);
  assert.equal(isJudgeable({ ...base, options: '["1"]' }), false);
  assert.equal(isJudgeable({ ...base, options: '["",""]' }), false);
});

test("normalizeQuestion 输出字母、HTML 与解析字段", () => {
  const q = normalizeQuestion(
    {
      questionId: 123,
      type: 1,
      chapter: "资料分析",
      paperId: 9,
      contentHtml: "<p>题干</p>",
      options: '["甲","乙","丙","丁"]',
      answerIndex: 1,
      analysisHtml: "<p>解析</p>",
    },
    { module: "资料分析", paperName: "2024国考" }
  );
  assert.equal(q.questionId, "123");
  assert.equal(q.options.length, 4);
  assert.equal(q.options[1].letter, "B");
  assert.equal(q.answerLetter, "B");
  assert.equal(q.module, "资料分析");
  assert.equal(q.paperName, "2024国考");
});

test("scoreAnswers 统计答对、百分比并生成记账行", () => {
  const r = scoreAnswers([
    { questionId: 1, module: "资料分析", pickedIndex: 0, answerIndex: 0, seconds: 20 },
    { questionId: 2, module: "资料分析", pickedIndex: 3, answerIndex: 1, seconds: 30 },
    { questionId: 3, module: "资料分析", pickedIndex: null, answerIndex: 2, seconds: 5 },
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.answered, 2);
  assert.equal(r.correct, 1);
  assert.equal(r.pct, 50);
  assert.deepEqual(
    r.results.map((x) => x.correct),
    [1, 0, 0]
  );
});

test("scoreAnswers 空输入不抛错", () => {
  const r = scoreAnswers([]);
  assert.equal(r.total, 0);
  assert.equal(r.pct, null);
});

test("sanitizeHtml 去掉脚本/事件/伪协议，协议相对图片补 https", () => {
  const raw = [
    '<p onclick="steal()">题干</p>',
    "<script>alert(1)</script>",
    '<img src="//fb.fbstatic.cn/a.png">',
    '<a href="javascript:bad()">x</a>',
  ].join("");
  const out = sanitizeHtml(raw);
  assert.ok(!out.includes("onclick"));
  assert.ok(!out.includes("<script"));
  assert.ok(out.includes('src="https://fb.fbstatic.cn/a.png"'));
  assert.ok(!out.includes("javascript:bad"));
  assert.ok(out.includes("<p>题干</p>"));
});
