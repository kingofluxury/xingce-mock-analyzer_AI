import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { moduleList } from "../app/public/shared/tiku-map.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK = path.join(ROOT, "app", "public", "data", "question-pack.json");

test("App 内置题库存在且结构完整", () => {
  assert.ok(existsSync(PACK), "缺少 app/public/data/question-pack.json，先跑 npm run pack:tiku");
  const pack = JSON.parse(readFileSync(PACK, "utf8"));
  assert.equal(pack.format, 1);
  assert.ok(Array.isArray(pack.questions) && pack.questions.length > 0);

  const modules = new Set(moduleList());
  let sum = 0;
  for (const [name, n] of Object.entries(pack.counts ?? {})) {
    assert.ok(modules.has(name), "未知模块：" + name);
    sum += Number(n);
  }
  assert.equal(sum, pack.questions.length, "counts 与题目数不一致");

  for (const q of pack.questions) {
    assert.ok(q.id, "题目缺 id");
    assert.ok(modules.has(q.m), "题目模块无效：" + q.m);
    assert.ok(typeof q.s === "string" && q.s.trim().length > 0, "题干为空：" + q.id);
    assert.ok(Array.isArray(q.o) && q.o.length >= 2 && q.o.length <= 6, "选项数异常：" + q.id);
    assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length, "答案索引越界：" + q.id);
  }
});

test("内置题库只允许单模块可选（每个模块都有题）", () => {
  const pack = JSON.parse(readFileSync(PACK, "utf8"));
  for (const mod of moduleList()) {
    const n = Number(pack.counts?.[mod] ?? 0);
    assert.ok(n > 0, "模块没有题目：" + mod);
  }
});
