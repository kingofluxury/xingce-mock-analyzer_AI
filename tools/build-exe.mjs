import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { inject } from "postject";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "build");
const DIST = path.join(ROOT, "dist");
const NO_SEED = process.argv.includes("--no-seed");
const EXE = path.join(DIST, NO_SEED ? "行测模考分析器-空白版.exe" : "行测模考分析器.exe");
const FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push([path.relative(base, full).split(path.sep).join("/"), full]);
  }
  return out;
}

function setGuiSubsystem(exePath) {
  const fd = fs.openSync(exePath, "r+");
  try {
    const head = Buffer.alloc(4);
    fs.readSync(fd, head, 0, 4, 0x3c);
    const pe = head.readUInt32LE(0);
    const sig = Buffer.alloc(4);
    fs.readSync(fd, sig, 0, 4, pe);
    if (sig.toString("latin1") !== "PE\u0000\u0000") throw new Error("不是有效的 PE 文件");
    const offset = pe + 0x5c;
    const cur = Buffer.alloc(2);
    fs.readSync(fd, cur, 0, 2, offset);
    if (cur.readUInt16LE(0) === 2) return false;
    cur.writeUInt16LE(2, 0);
    fs.writeSync(fd, cur, 0, 2, offset);
    return true;
  } finally {
    fs.closeSync(fd);
  }
}

async function main() {
  fs.mkdirSync(BUILD, { recursive: true });
  fs.mkdirSync(DIST, { recursive: true });

  const bundle = path.join(BUILD, "server.cjs");
  await build({
    entryPoints: [path.join(ROOT, "app", "server.mjs")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    outfile: bundle,
    logLevel: "error",
  });

  const assets = {};
  for (const [rel, full] of walk(path.join(ROOT, "app", "public"))) {
    assets["public/" + rel] = full;
  }
  if (!NO_SEED) {
    const seedPath = path.join(ROOT, "app", "data", "seed.json");
    if (fs.existsSync(seedPath)) assets["seed/seed.json"] = seedPath;
    else console.warn("未找到 app/data/seed.json，将生成不含历史数据的 exe");
  }

  const configPath = path.join(BUILD, "sea-config.json");
  const blob = path.join(BUILD, "sea-prep.blob");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        main: bundle,
        output: blob,
        disableExperimentalSEAWarning: true,
        assets,
      },
      null,
      2
    ),
    "utf8"
  );

  execFileSync(process.execPath, ["--experimental-sea-config", configPath], { stdio: "inherit" });

  if (fs.existsSync(EXE)) fs.rmSync(EXE, { force: true });
  fs.copyFileSync(process.execPath, EXE);
  inject(EXE, "NODE_SEA_BLOB", fs.readFileSync(blob), { sentinelFuse: FUSE });
  setGuiSubsystem(EXE);

  const size = (fs.statSync(EXE).size / 1024 / 1024).toFixed(1);
  console.log(`已生成 ${EXE}（${size} MB，含 ${Object.keys(assets).length} 个资源，无控制台窗口${NO_SEED ? "，空白数据" : ""}）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

