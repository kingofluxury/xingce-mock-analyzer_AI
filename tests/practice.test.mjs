import { test } from "node:test";
import assert from "node:assert/strict";
import { sm2Next } from "../app/public/shared/sm2.js";
import { chapterToModule, moduleList } from "../app/public/shared/tiku-map.js";
import { practiceModuleStats, withinDays, classifyModule, practiceSummaryRows } from "../app/public/shared/practice-stats.js";

test("SM-2 首答及格走 1 天，二连 6 天，之后按 ease 复利", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  const a = sm2Next({}, 4, now);
  assert.equal(a.intervalDays, 1);
  assert.equal(a.reps, 1);
  assert.equal(a.dueAt, "2026-10-31");

  const b = sm2Next(a, 4, now);
  assert.equal(b.intervalDays, 6);
  assert.equal(b.reps, 2);

  const c = sm2Next(b, 5, now);
  assert.equal(c.intervalDays, 15);
  assert.equal(c.reps, 3);
});

test("SM-2 不及格重置并记失误，ease 下限 1.3", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  const learned = { ease: 2.5, intervalDays: 15, reps: 3, lapses: 0 };
  const bad = sm2Next(learned, 1, now);
  assert.equal(bad.reps, 0);
  assert.equal(bad.intervalDays, 1);
  assert.equal(bad.lapses, 1);

  let ease = 1.32;
  for (let i = 0; i < 5; i += 1) ease = sm2Next({ ease, intervalDays: 6, reps: 2 }, 0).ease;
  assert.equal(ease, 1.3);
});

test("SM-2 非法质量分报错", () => {
  assert.throws(() => sm2Next({}, 6));
  assert.throws(() => sm2Next({}, -1));
  assert.throws(() => sm2Next({}, 2.5));
});

test("章节映射对齐我们六模块，别名与混合章节都能归位", () => {
  const modules = moduleList();
  assert.deepEqual(modules, ["政治理论", "常识判断", "言语理解", "数量关系", "判断推理", "资料分析"]);

  assert.equal(chapterToModule("言语理解与表达"), "言语理解");
  assert.equal(chapterToModule("选词填空"), "言语理解");
  assert.equal(chapterToModule("逻辑判断"), "判断推理");
  assert.equal(chapterToModule("数量关系与资料分析"), "数量关系");
  assert.equal(chapterToModule("资料分斩"), "资料分析");
  assert.equal(chapterToModule("公共基础知识-单项选择题"), "常识判断");
  assert.equal(chapterToModule("政治理论"), "政治理论");
  assert.equal(chapterToModule(""), null);
  assert.equal(chapterToModule("未知章节xyz"), null);
});

test("练习统计与模考同口径：Σ答对 / Σ题量", () => {
  const records = [
    { module: "资料分析", correct: 1, doneAt: "2026-10-29T08:00:00Z" },
    { module: "资料分析", correct: 0, doneAt: "2026-10-29T08:01:00Z" },
    { module: "资料分析", correct: 1, doneAt: "2026-10-29T08:02:00Z" },
    { module: "判断推理", correct: 1, doneAt: "2026-10-28T08:00:00Z" },
    { module: "资料分析", correct: 2, doneAt: "2026-10-29T08:03:00Z" },
  ];
  const stats = practiceModuleStats(records);
  const data = stats.find((m) => m.module === "资料分析");
  assert.equal(data.qty, 3);
  assert.equal(data.correct, 2);
  assert.ok(Math.abs(data.pct - 2 / 3) < 1e-9);
  assert.equal(stats.find((m) => m.module === "判断推理").pct, 1);
  assert.equal(stats.find((m) => m.module === "言语理解").pct, null);
});

test("withinDays 只保留窗口内记录", () => {
  const now = new Date("2026-10-30T00:00:00Z");
  const rows = withinDays(
    [
      { module: "常识判断", correct: 1, doneAt: "2026-10-29T00:00:00Z" },
      { module: "常识判断", correct: 1, doneAt: "2026-09-01T00:00:00Z" },
      { module: "常识判断", correct: 1, doneAt: "oops" },
    ],
    30,
    now
  );
  assert.equal(rows.length, 1);
});

test("classifyModule：真薄弱 / 临场问题 / 练习偏弱 三态", () => {
  assert.equal(
    classifyModule({ examGapPts: 8.4, examAvgPct: 0.91, practicePct: 0.6 }),
    "真薄弱"
  );
  assert.equal(
    classifyModule({ examGapPts: 8.4, examAvgPct: 0.91, practicePct: 0.95 }),
    "临场问题"
  );
  assert.equal(
    classifyModule({ examGapPts: -1, examAvgPct: 0.9, practicePct: 0.7 }),
    "练习偏弱"
  );
  assert.equal(
    classifyModule({ examGapPts: -1, examAvgPct: 0.9, practicePct: 0.92 }),
    null
  );
  assert.equal(classifyModule({ examGapPts: 8, examAvgPct: 0.9, practicePct: null }), null);
});

test("practiceSummaryRows 输出百分数一位小数", () => {
  const rows = practiceSummaryRows([
    { module: "资料分析", correct: 1 },
    { module: "资料分析", correct: 0 },
  ]);
  const data = rows.find((r) => r.module === "资料分析");
  assert.equal(data.qty, 2);
  assert.equal(data.pct, 50);
});
