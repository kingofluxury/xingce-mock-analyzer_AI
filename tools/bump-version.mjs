import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(ROOT, "package.json");
const outPath = path.join(ROOT, "app", "public", "shared", "version.js");
const mpPath = path.join(ROOT, "miniprogram", "utils", "version.js");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const base = String(pkg.version || "0.0.0").split("-")[0].split(".").slice(0, 3).join(".");

const d = new Date();
const p = (n) => String(n).padStart(2, "0");
const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
const version = `${base}.${stamp}`;

fs.writeFileSync(
  outPath,
  `export const BASE_VERSION = "${base}";\nexport const APP_VERSION = "${version}";\n`,
  "utf8"
);
fs.writeFileSync(mpPath, `module.exports = { APP_VERSION: "${version}" };\n`, "utf8");
console.log("APP_VERSION = " + version);

const minutes =
  Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) / 60000) - 26297280;
console.log("android versionCode = " + minutes);
