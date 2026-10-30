import { getStore } from "./store.js";
import { APP_VERSION } from "../shared/version.js";
import { $, escapeHtml, markNav, showFatal, toast, downloadText, exportedToast, markBackup, showBusy } from "./ui.js";

const root = $("#app");

function typeTable(type) {
  const rows = [];
  for (const mod of type.modules) {
    mod.subtypes.forEach((s, i) => {
      rows.push(
        "<tr>" +
          (i === 0 ? '<td rowspan="' + mod.subtypes.length + '">' + escapeHtml(mod.name) + "</td>" : "") +
          "<td>" +
          escapeHtml(s.name) +
          '</td><td class="num">' +
          s.qty +
          '</td><td class="num">' +
          s.pts +
          '</td><td class="num">' +
          Math.round(s.qty * s.pts * 10) / 10 +
          "</td></tr>"
      );
    });
  }
  return (
    '<div class="card"><div class="card-head"><h2>' +
    escapeHtml(type.examType + " · " + type.paperName) +
    "</h2><span class=\"muted\">" +
    type.totals.qty +
    " 题 / " +
    type.totals.full +
    ' 分</span></div>' +
    '<table class="table structure-table"><thead><tr><th>模块</th><th>子题型</th><th class="num">题量</th><th class="num">每题分值</th><th class="num">小计</th></tr></thead><tbody>' +
    rows.join("") +
    '</tbody><tfoot><tr><td colspan="2"><b>合计</b></td><td class="num"><b>' +
    type.totals.qty +
    '</b></td><td></td><td class="num"><b>' +
    type.totals.full +
    "</b></td></tr></tfoot></table></div>"
  );
}

function dataCard(store) {
  const local = store.kind === "local";
  const where = local
    ? "数据保存在这个浏览器的本地存储里，不上传。清理浏览器数据会删除记录，建议定期导出备份。"
    : "所有数据保存在程序同目录的 <code>data</code> 文件夹（<code>app.db</code>）。换电脑时拷走整个 <code>data</code> 目录即可。";
  const importBtn =
    '<input type="file" id="importFile" accept=".json,application/json" hidden>' +
    '<button class="btn" id="import" type="button">导入 JSON 备份</button>';
  const revealBtn =
    store.kind === "http" ? '<button class="btn" id="reveal" type="button">打开备份文件夹</button>' : "";
  return (
    '<div class="card"><div class="card-head"><h2>数据</h2></div>' +
    '<p class="muted">' +
    where +
    "</p><div class=\"hr\"></div>" +
    '<p class="muted">导出为 JSON 备份，包含全部模考记录与题型结构，可用于存档或迁移。</p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn" id="export" type="button">导出 JSON 备份</button>' +
    importBtn +
    revealBtn +
    "</div></div>"
  );
}

function programCard(store) {
  if (store.kind !== "http") return "";
  return (
    '<div class="card"><div class="card-head"><h2>程序</h2></div>' +
    '<p class="muted">程序在后台运行，没有窗口。关闭浏览器不会退出程序。</p>' +
    '<button class="btn danger" id="shutdown" type="button">退出程序</button>' +
    "</div>"
  );
}

async function exportBackup(store, btn) {
  btn.disabled = true;
  try {
    if (typeof store.backupFile === "function") {
      const res = await store.backupFile();
      markBackup();
      toast("已保存到 data\\backups\\" + res.file, "ok", 4600);
      return;
    }
    const data = await store.exportAll();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const how = await downloadText("行测模考备份-" + stamp + ".json", JSON.stringify(data, null, 2));
    exportedToast(how);
    if (how !== "cancelled") markBackup();
  } catch (err) {
    toast(err.message || "导出失败", "err");
  } finally {
    btn.disabled = false;
  }
}

function aiCard(store) {
  if (store.kind !== "http") {
    return (
      '<div class="card"><div class="card-head"><h2>AI 复盘</h2><span class="muted">仅桌面版</span></div>' +
      '<p class="muted tiny">网页/手机版没有本地服务，key 无处安全存放，AI 复盘只在桌面版可用。</p></div>'
    );
  }
  return (
    '<div class="card"><div class="card-head"><h2>AI 复盘</h2><span class="muted">OpenAI 兼容接口 · key 只存本机 data/app.db</span></div>' +
    '<div class="form-grid">' +
    '<label>base_url<input type="text" id="aiBaseUrl" placeholder="https://api.deepseek.com/v1" autocomplete="off"></label>' +
    '<label>model<input type="text" id="aiModel" placeholder="deepseek-chat" autocomplete="off"></label>' +
    '<label>api_key<input type="password" id="aiKey" placeholder="留空表示不修改已保存的 key" autocomplete="off"></label>' +
    "</div>" +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
    '<button class="btn primary" id="aiSave" type="button">保存</button>' +
    '<button class="btn" id="aiTest" type="button">测试连接</button>' +
    '<button class="btn ghost" id="aiClear" type="button">清除 key</button>' +
    '<span class="muted tiny" id="aiStatus" style="align-self:center"></span>' +
    "</div>" +
    '<p class="muted tiny" style="margin:8px 0 0">请求由本机服务代发，浏览器不接触 key；关掉程序即不再联网。' +
    '生成入口在「曲线」页底部。</p></div>'
  );
}

async function bindAi(store) {
  if (store.kind !== "http") return;
  const status = $("#aiStatus");
  const setStatus = (text, ok) => {
    if (!status) return;
    status.textContent = text;
    status.style.color = ok ? "var(--ok)" : "var(--muted)";
  };
  try {
    const cfg = await store.aiConfig();
    if ($("#aiBaseUrl")) $("#aiBaseUrl").value = cfg.baseUrl || "";
    if ($("#aiModel")) $("#aiModel").value = cfg.model || "";
    setStatus(cfg.hasKey ? "已保存 key：" + cfg.keyMasked : "未配置 key", cfg.hasKey);
  } catch (err) {
    setStatus(err.message || "读取配置失败", false);
  }

  $("#aiSave")?.addEventListener("click", async () => {
    const btn = $("#aiSave");
    btn.disabled = true;
    try {
      const cfg = await store.saveAiConfig({
        baseUrl: $("#aiBaseUrl").value.trim(),
        model: $("#aiModel").value.trim(),
        apiKey: $("#aiKey").value.trim(),
      });
      if ($("#aiKey")) $("#aiKey").value = "";
      setStatus(cfg.hasKey ? "已保存 key：" + cfg.keyMasked : "未配置 key", cfg.hasKey);
      toast("AI 配置已保存", "ok");
    } catch (err) {
      setStatus(err.message || "保存失败", false);
      toast(err.message || "保存失败", "err", 4200);
    } finally {
      btn.disabled = false;
    }
  });

  $("#aiTest")?.addEventListener("click", async () => {
    const btn = $("#aiTest");
    btn.disabled = true;
    setStatus("正在测试…", true);
    try {
      const res = await store.aiTest();
      setStatus("连接正常（" + (res.model || "") + "）：" + (res.reply || "ok"), true);
      toast("AI 连接正常", "ok");
    } catch (err) {
      setStatus(err.message || "测试失败", false);
      toast(err.message || "测试失败", "err", 4600);
    } finally {
      btn.disabled = false;
    }
  });

  $("#aiClear")?.addEventListener("click", async () => {
    if (!confirm("清除已保存的 API key？")) return;
    try {
      const cfg = await store.saveAiConfig({
        baseUrl: $("#aiBaseUrl").value.trim() || "https://api.deepseek.com/v1",
        model: $("#aiModel").value.trim() || "deepseek-chat",
        apiKey: null,
      });
      setStatus(cfg.hasKey ? "已保存 key：" + cfg.keyMasked : "未配置 key", cfg.hasKey);
      toast("已清除 key", "ok");
    } catch (err) {
      toast(err.message || "清除失败", "err", 4200);
    }
  });
}

async function init() {
  markNav();
  if (!root) return;

  let store;
  let meta;
  try {
    store = await getStore();
    meta = await store.meta();
  } catch (err) {
    showFatal(root, err.message, "请通过 启动.bat 打开页面。");
    return;
  }

  root.innerHTML =
    aiCard(store) +
    meta.paperTypes.map(typeTable).join("") +
    dataCard(store) +
    programCard(store) +
    '<div class="card"><div class="card-head"><h2>关于</h2></div>' +
    '<p class="muted tiny">行测模考分析器 v' +
    APP_VERSION +
    " · " +
    (store.kind === "local" ? "本地存储，数据不出设备。" : "本地运行，不联网，不上传任何数据。") +
    "</p>" +
    '<p class="muted tiny">录入口径：每个子题型只需填「答对数」与「用时（分钟）」；得分 = 答对数 × 每题分值。</p>' +
    "</div>";

  await bindAi(store);

  const exportBtn = $("#export");
  if (exportBtn) exportBtn.addEventListener("click", () => exportBackup(store, exportBtn));

  const importBtn = $("#import");
  const importFile = $("#importFile");
  if (importBtn && importFile && typeof store.importExams === "function") {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async () => {
      const file = importFile.files?.[0];
      if (!file) return;
      importBtn.disabled = true;
      let busy = null;
      try {
        const text = await file.text();
        let payload;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error("不是有效的 JSON 文件");
        }
        const total = Array.isArray(payload?.exams) ? payload.exams.length : 0;
        busy = showBusy("正在导入", "共 " + total + " 条记录，请稍候…");
        const res = await store.importExams(payload);
        busy.update("导入完成", "导入 " + res.imported + " 条，跳过 " + res.skipped + " 条");
        await new Promise((r) => setTimeout(r, 350));
        busy.close();
        busy = null;
        toast(`导入 ${res.imported} 条，跳过 ${res.skipped} 条`, res.imported > 0 ? "ok" : "", 3600);
      } catch (err) {
        toast(err.message || "导入失败", "err", 3600);
      } finally {
        if (busy) busy.close();
        importBtn.disabled = false;
        importFile.value = "";
      }
    });
  }

  const reveal = $("#reveal");
  if (reveal && typeof store.revealBackups === "function") {
    reveal.addEventListener("click", async () => {
      try {
        await store.revealBackups();
        toast("已打开备份文件夹", "ok");
      } catch (err) {
        toast(err.message || "打开失败", "err");
      }
    });
  }

  const quit = $("#shutdown");  if (quit) {
    quit.addEventListener("click", async () => {
      if (!confirm("确定退出程序？页面随后会断开连接。")) return;
      quit.disabled = true;
      try {
        await fetch("/api/shutdown", { method: "POST" });
        document.body.innerHTML =
          '<div class="container"><div class="empty"><h3>程序已退出</h3><p>可以关闭这个标签页了。下次双击 exe 重新启动。</p></div></div>';
      } catch {
        quit.disabled = false;
        toast("退出失败，请用任务管理器结束进程", "err", 4000);
      }
    });
  }
}

init().catch((err) => {
  console.error(err);
  if (root) showFatal(root, err.message || "未知错误");
});
