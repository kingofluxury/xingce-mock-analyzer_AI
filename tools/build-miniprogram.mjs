import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [path.join(ROOT, "app", "public", "shared", "index.js")],
  bundle: true,
  platform: "neutral",
  format: "cjs",
  target: "es2017",
  outfile: path.join(ROOT, "miniprogram", "utils", "core.js"),
  logLevel: "error",
});

const versionSource = fs.readFileSync(path.join(ROOT, "app", "public", "shared", "version.js"), "utf8");
const match = versionSource.match(/APP_VERSION = "([^"]+)"/);
const version = match ? match[1] : "0.0.0";
fs.writeFileSync(
  path.join(ROOT, "miniprogram", "utils", "version.js"),
  `module.exports = { APP_VERSION: "${version}" };\n`,
  "utf8"
);

console.log("miniprogram/utils/core.js 已生成（" + version + "）");
