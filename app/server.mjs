import "./lib/bootstrap.mjs";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { PORT, PUBLIC_DIR, DB_PATH, DATA_DIR, VERSION } from "./lib/config.mjs";
import { IS_SEA } from "./lib/bootstrap.mjs";
import { openDatabase } from "./lib/db.mjs";
import { handleApi } from "./lib/api.mjs";
import { sendError, sendJSON, serveStatic } from "./lib/http.mjs";

if (IS_SEA) setupFileLogging();

function setupFileLogging() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    void 0;
  }
  const logPath = path.join(DATA_DIR, "app.log");
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 1024 * 1024) fs.rmSync(logPath);
  } catch {
    void 0;
  }
  const write = (level, args) => {
    try {
      const text = args
        .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === "string" ? a : JSON.stringify(a)))
        .join(" ");
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${level} ${text}\n`);
    } catch {
      void 0;
    }
  };
  console.log = (...a) => write("info", a);
  console.warn = (...a) => write("warn", a);
  console.error = (...a) => write("error", a);
  process.stdout?.on?.("error", () => {});
  process.stderr?.on?.("error", () => {});
}

let db;
try {
  db = openDatabase();
} catch (err) {
  console.error("[启动失败] 无法打开数据库：", err.message);
  console.error("数据库路径：", DB_PATH);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const remote = String(req.socket.remoteAddress || "");
  const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  if (!loopback) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  let url;
  try {
    url = new URL(req.url || "/", "http://localhost");
  } catch {
    sendJSON(res, 400, { error: "非法请求地址" });
    return;
  }

  if (url.pathname === "/api/shutdown" && req.method === "POST") {
    sendJSON(res, 200, { ok: true });
    setTimeout(shutdown, 200);
    return;
  }

  const run = url.pathname.startsWith("/api/")
    ? handleApi(req, res, db, url)
    : Promise.resolve(serveStatic(req, res, PUBLIC_DIR, url.pathname));

  Promise.resolve(run).catch((err) => sendError(res, err));
});
server.on("clientError", (err, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

function listen(port, remaining = 10) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && remaining > 0) {
      listen(port + 1, remaining - 1);
      return;
    }
    console.error("[启动失败] 无法监听端口：", err.message);
    process.exit(1);
  });
  server.listen(port, () => {
    const actual = server.address().port;
    const url = "http://127.0.0.1:" + actual;
    console.log("");
    console.log("  行测模考分析器 v" + VERSION);
    console.log("  地址：" + url);
    console.log("  数据：" + DB_PATH);
    console.log(IS_SEA ? "  退出：设置页 → 退出程序" : "  关闭此窗口即可退出");
    console.log("");
    if (process.env.OPEN_BROWSER !== "0") openBrowser(url);
  });
}

function openBrowser(url) {
  try {
    const child = spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch (err) {
    console.warn("[提示] 未能自动打开浏览器，请手动访问 " + url);
  }
}

listen(PORT);

process.on("uncaughtException", (err) => {
  console.error("[未捕获异常]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[未处理的 Promise 拒绝]", reason);
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    try {
      db.close();
    } catch {
      void 0;
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
