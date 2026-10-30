import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";

const MAGIC = Buffer.from("APK Sig Block 42", "binary");
const V2_ID = 0x7109871a;
const V3_ID = 0xf05368c0;

function u32(buf, off) {
  return buf.readUInt32LE(off);
}

function u64(buf, off) {
  return Number(buf.readBigUInt64LE(off));
}

function readLenPrefixed(buf, off) {
  const len = u32(buf, off);
  return { data: buf.subarray(off + 4, off + 4 + len), next: off + 4 + len };
}

export function zipEntry(apk, name) {
  const eocd = apk.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("不是有效的 zip/apk：找不到 EOCD");
  const count = apk.readUInt16LE(eocd + 10);
  let off = u32(apk, eocd + 16);
  for (let i = 0; i < count; i += 1) {
    const nameLen = apk.readUInt16LE(off + 28);
    const extraLen = apk.readUInt16LE(off + 30);
    const commentLen = apk.readUInt16LE(off + 32);
    const localOff = u32(apk, off + 42);
    const entryName = apk.subarray(off + 46, off + 46 + nameLen).toString("utf8");
    if (entryName === name) {
      const localNameLen = apk.readUInt16LE(localOff + 26);
      const localExtraLen = apk.readUInt16LE(localOff + 28);
      const start = localOff + 30 + localNameLen + localExtraLen;
      const size = u32(apk, off + 20);
      const method = apk.readUInt16LE(off + 10);
      const raw = apk.subarray(start, start + size);
      return method === 0 ? raw : inflateRawSync(raw);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

export function signingCerts(apk) {
  const eocd = apk.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cdOff = u32(apk, eocd + 16);
  const footer = cdOff - 24;
  if (footer < 0 || !apk.subarray(footer + 8, footer + 24).equals(MAGIC)) {
    return { schemes: {}, certs: [] };
  }
  const size = u64(apk, footer);
  const start = cdOff - size;
  const schemes = {};
  const certs = [];
  let off = start;
  while (off < footer) {
    const pairLen = u64(apk, off);
    const id = u32(apk, off + 8);
    const value = apk.subarray(off + 12, off + 8 + pairLen);
    if (id === V2_ID) schemes.v2 = true;
    if (id === V3_ID) schemes.v3 = true;
    if (id === V2_ID || id === V3_ID) {
      const signers = readLenPrefixed(value, 0).data;
      let p = 0;
      while (p < signers.length) {
        const signer = readLenPrefixed(signers, p);
        p = signer.next;
        const signedData = readLenPrefixed(signer.data, 0).data;
        const certSeq = readLenPrefixed(signedData, readLenPrefixed(signedData, 0).next).data;
        let q = 0;
        while (q < certSeq.length) {
          const cert = readLenPrefixed(certSeq, q);
          q = cert.next;
          certs.push(cert.data);
        }
      }
    }
    off += 8 + pairLen;
  }
  return { schemes, certs };
}

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Buffer.from(body, "base64");
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : null;
}

if (process.argv[1] && process.argv[1].endsWith("verify-apk.mjs")) {
  const apkPath = process.argv[2];
  if (!apkPath) {
    console.error("用法: node tools/verify-apk.mjs <apk> [--version <v>] [--sha256 <hex>] [--cert <pem>]");
    process.exit(2);
  }
  const apk = readFileSync(apkPath);
  const versionFile = zipEntry(apk, "assets/public/shared/version.js");
  const version = versionFile
    ? (versionFile.toString("utf8").match(/APP_VERSION\s*=\s*"([^"]+)"/) || [])[1]
    : null;
  const { schemes, certs } = signingCerts(apk);
  const hasV1 = Boolean(
    (() => {
      const eocd = apk.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
      const count = apk.readUInt16LE(eocd + 10);
      let off = u32(apk, eocd + 16);
      for (let i = 0; i < count; i += 1) {
        const nameLen = apk.readUInt16LE(off + 28);
        const name = apk.subarray(off + 46, off + 46 + nameLen).toString("utf8");
        if (/^META-INF\/.*\.(SF|RSA|DSA|EC)$/i.test(name)) return true;
        off += 46 + nameLen + apk.readUInt16LE(off + 30) + apk.readUInt16LE(off + 32);
      }
      return false;
    })(),
  );

  const fingerprints = [...new Set(certs.map(sha256))];
  console.log(`apk      : ${apkPath}`);
  console.log(`版本     : ${version || "未找到 assets/public/shared/version.js"}`);
  console.log(`签名方案 : ${[hasV1 && "v1", schemes.v2 && "v2", schemes.v3 && "v3"].filter(Boolean).join("+") || "未签名"}`);
  for (const fp of fingerprints) console.log(`证书SHA256: ${fp}`);

  const expectVersion = arg("--version");
  if (expectVersion) {
    const same = version === expectVersion;
    console.log(`期望版本 : ${expectVersion}`);
    if (!same) console.log("结论     : 版本不符（不是这个提交构建的 APK）");
    if (!same) process.exit(1);
  }

  let expected = arg("--sha256");
  if (!expected) {
    const certPath = arg("--cert");
    if (certPath) expected = sha256(pemToDer(readFileSync(certPath, "utf8")));
  }
  if (expected) {
    const ok = fingerprints.includes(expected.toLowerCase());
    console.log(`期望SHA256: ${expected.toLowerCase()}`);
    console.log(ok ? "结论     : MATCH（签名一致，可直接覆盖安装）" : "结论     : MISMATCH（签名不一致，需先卸载旧版）");
    process.exit(ok ? 0 : 1);
  }
  process.exit(fingerprints.length ? 0 : 1);
}
