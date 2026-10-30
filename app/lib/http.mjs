import fs from "node:fs";
import path from "node:path";
import { ValidationError } from "../public/shared/errors.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const MAX_BODY = 1024 * 1024;

export function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload === undefined ? null : payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

export function sendError(res, err) {
  const status = Number(err?.status) || 500;
  const expose = err?.expose === true || status < 500;
  const message = expose ? err?.message || "请求失败" : "服务器内部错误";
  if (status >= 500) console.error("[api]", err);
  if (res.headersSent) {
    res.end();
    return;
  }
  sendJSON(res, status, {
    error: message,
    details: Array.isArray(err?.details) ? err.details : [],
  });
}

export async function readJSON(req) {
  const type = String(req.headers["content-type"] || "");
  if (type && !type.includes("application/json")) {
    throw new ValidationError("Content-Type 必须是 application/json");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      throw new ValidationError("请求体过大");
    }
    chunks.push(chunk);
  }

  if (size === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("JSON 格式错误");
  }
}

export function serveStatic(req, res, root, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJSON(res, 405, { error: "Method Not Allowed" });
    return;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendJSON(res, 400, { error: "路径编码错误" });
    return;
  }

  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const target = path.resolve(root, rel);
  const rootResolved = path.resolve(root);

  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) {
    sendJSON(res, 403, { error: "Forbidden" });
    return;
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      sendJSON(res, 404, { error: "Not Found" });
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const live = [".html", ".css", ".js", ".mjs", ".json"].includes(ext) && !rel.startsWith("vendor/");
    const headers = {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": live ? "no-cache" : "public, max-age=604800",
    };
    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    const stream = fs.createReadStream(target);
    stream.on("error", () => {
      if (!res.headersSent) sendJSON(res, 500, { error: "读取文件失败" });
      else res.end();
    });
    stream.pipe(res);
  });
}
