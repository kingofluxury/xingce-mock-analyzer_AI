import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

let sea = null;
try {
  sea = require("node:sea");
} catch {
  sea = null;
}

export const IS_SEA = Boolean(sea && sea.isSea && sea.isSea());

function debug(payload) {
  if (process.env.XINGCE_DEBUG) console.log("[bootstrap]", JSON.stringify(payload));
}

if (IS_SEA) {
  const keys = sea
    .getAssetKeys()
    .filter((k) => k.startsWith("public/"))
    .sort();

  const hash = crypto.createHash("sha1");
  const files = [];
  for (const key of keys) {
    const buf = Buffer.from(sea.getAsset(key));
    hash.update(key);
    hash.update(buf);
    files.push([key.slice("public/".length), buf]);
  }

  const dir = path.join(os.tmpdir(), "xingce-web-" + hash.digest("hex").slice(0, 12));
  const marker = path.join(dir, ".ready");
  if (!fs.existsSync(marker)) {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const [rel, buf] of files) {
      const target = path.join(dir, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buf);
    }
    fs.writeFileSync(marker, "");
  }

  process.env.APP_HOME = path.dirname(process.execPath);
  process.env.APP_PUBLIC_DIR = dir;

  const allKeys = sea.getAssetKeys();
  const seedKey = "seed/seed.json";
  let seedWritten = false;
  if (allKeys.includes(seedKey)) {
    const seedPath = path.join(process.env.APP_HOME, "data", "seed.json");
    if (!fs.existsSync(seedPath)) {
      fs.mkdirSync(path.dirname(seedPath), { recursive: true });
      fs.writeFileSync(seedPath, Buffer.from(sea.getAsset(seedKey)));
      seedWritten = true;
    }
  }

  debug({
    execPath: process.execPath,
    webDir: dir,
    assets: allKeys.length,
    hasSeed: allKeys.includes(seedKey),
    seedWritten,
  });
}
