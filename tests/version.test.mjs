import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(ROOT, "app", "public", "shared", "version.js"), "utf8");

function appVersion() {
  const m = source.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function versionCode(stamp) {
  const d = new Date(
    Date.UTC(
      Number(stamp.slice(0, 4)),
      Number(stamp.slice(4, 6)) - 1,
      Number(stamp.slice(6, 8)),
      Number(stamp.slice(8, 10)),
      Number(stamp.slice(10, 12)),
      Number(stamp.slice(12, 14))
    )
  );
  return Math.floor(d.getTime() / 60000) - 26297280;
}

test("APP_VERSION 保留 bump 生成的时间戳格式（gradle 依赖它推导 versionCode）", () => {
  const version = appVersion();
  assert.ok(version, "version.js 缺少 APP_VERSION");
  assert.match(version, /^\d+\.\d+\.\d+\.\d{14}$/);
});

test("APP_VERSION 时间戳可解析，versionCode 落在 int32 内", () => {
  const stamp = appVersion().split(".").pop();
  const d = new Date(
    Date.UTC(
      Number(stamp.slice(0, 4)),
      Number(stamp.slice(4, 6)) - 1,
      Number(stamp.slice(6, 8)),
      Number(stamp.slice(8, 10)),
      Number(stamp.slice(10, 12)),
      Number(stamp.slice(12, 14))
    )
  );
  assert.ok(!Number.isNaN(d.getTime()), "时间戳无法解析");
  const code = versionCode(stamp);
  assert.ok(code > 0, "versionCode 必须为正");
  assert.ok(code < 2100000000, "versionCode 必须小于 2100000000");
});

test("versionCode 随时间单调递增", () => {
  assert.ok(versionCode("20261028212229") > versionCode("20261028145051"));
});
