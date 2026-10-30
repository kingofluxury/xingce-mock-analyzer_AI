import { getStore } from "./store.js";
import { fmt, fmtPct, isNum } from "./fmt.js";
import {
  $,
  escapeHtml,
  markNav,
  showFatal,
  toast,
  downloadText,
  exportedToast,
  markBackup,
  backupAgeText,
  showBusy,
} from "./ui.js";

const root = $("#app");
let meta = null;
let store = null;
let allExams = [];
let filterType = "";
let filterMonth = "";

function typeLabel(id) {
  const type = meta?.paperTypes?.find((t) => t.id === Number(id));
  return type ? type.examType + " " + type.paperName : "";
}

function rowHtml(e) {
  const score = isNum(e.totals?.score) ? fmt(e.totals.score, 1) : "—";
  const pct = isNum(e.totals?.pct) ? fmtPct(e.totals.pct, 0) : "—";
  const mins = isNum(e.totals?.minutes) ? fmt(e.totals.minutes, 0) + " 分钟" : "—";
  const sub = [typeLabel(e.paperTypeId), e.name].filter(Boolean).map(escapeHtml).join(" · ");
  return (
    '<tr data-id="' +
    e.id +
    '" data-seq="' +
    e.seq +
    '" data-type="' +
    e.paperTypeId +
    '">' +
    "<td>第 " +
    e.seq +
    " 次" +
    (sub ? '<div class="tiny muted">' + sub + "</div>" : "") +
    "</td>" +
    "<td>" +
    (e.date ? escapeHtml(e.date) : '<span class="muted">—</span>') +
    "</td>" +
    '<td class="num"><b>' +
    score +
    "</b></td>" +
    '<td class="num">' +
    pct +
    "</td>" +
    '<td class="num">' +
    mins +
    "</td>" +
    '<td class="muted">' +
    (e.note ? escapeHtml(e.note) : "—") +
    "</td>" +
    '<td><div class="row-actions">' +
    '<button class="btn sm" data-action="move" type="button">移动</button>' +
    '<a class="btn sm" href="index.html?id=' +
    e.id +
    '">编辑</a>' +
    '<button class="btn sm danger" data-action="delete" type="button">删除</button>' +
    "</div></td></tr>"
  );
}

function backupCard() {
  const age = backupAgeText();
  return (
    '<div class="card"><div class="card-head"><h2>备份</h2>' +
    '<span class="muted">清理浏览器数据会丢失记录</span>' +
    '<span class="spacer"></span>' +
    '<span class="tiny" id="backupAge" style="color:' +
    (age.stale ? "var(--warn)" : "var(--muted)") +
    '">' +
    escapeHtml(age.text) +
    "</span></div>" +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn" id="backupExport" type="button">导出备份</button>' +
    '<button class="btn" id="backupImport" type="button">导入备份</button>' +
    '<input type="file" id="backupFile" accept=".json,application/json" hidden>' +
    "</div>" +
    '<p class="muted tiny" style="margin:8px 0 0">' +
    (store?.kind === "http"
      ? "导出会直接保存到程序目录的 data\\backups，不需要下载。建议每周一次。"
      : "建议每周导出一次；换手机、清缓存、卸载前务必先导出。") +
    "</p>" +
    "</div>"
  );
}

function filterOptions() {
  const options = ['<option value="">全部试卷</option>'];
  for (const type of meta.paperTypes) {
    options.push(
      '<option value="' +
        type.id +
        '"' +
        (String(type.id) === filterType ? " selected" : "") +
        ">" +
        escapeHtml(type.examType + " " + type.paperName) +
        "</option>"
    );
  }
  return options.join("");
}

function monthOptions() {
  const months = [...new Set(allExams.map((e) => (e.date || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const options = ['<option value="">全部月份</option>'];
  for (const m of months) {
    options.push('<option value="' + m + '"' + (m === filterMonth ? " selected" : "") + ">" + m + "</option>");
  }
  return options.join("");
}

function listSummary(list) {
  const scores = list.map((e) => e.totals?.score).filter(isNum);
  const pcts = list.map((e) => e.totals?.pct).filter(isNum);
  if (scores.length === 0) return "";
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  return (
    "共 " +
    list.length +
    " 次 · 平均 " +
    fmt(avgScore, 1) +
    " 分" +
    (avgPct !== null ? " / " + fmtPct(avgPct, 0) : "")
  );
}

function render() {
  const list = allExams
    .filter((e) => !filterType || String(e.paperTypeId) === filterType)
    .filter((e) => !filterMonth || (e.date || "").slice(0, 7) === filterMonth)
    .sort((a, b) => a.paperTypeId - b.paperTypeId || b.seq - a.seq);

  const body =
    allExams.length === 0
      ? '<div class="empty"><h3>还没有记录</h3><p>每次模考后录入一次，曲线就会自动长出来。</p>' +
        '<a class="btn primary" href="index.html">录入第一次</a></div>'
      : '<div class="card"><div class="card-head"><h2>全部记录</h2><span class="muted">' +
        escapeHtml(listSummary(list) || "共 0 次") +
        '</span><span class="spacer"></span>' +
        '<select id="typeFilter" aria-label="按试卷筛选">' +
        filterOptions() +
        "</select>" +
        '<select id="monthFilter" aria-label="按月份筛选" style="margin-left:6px">' +
        monthOptions() +
        "</select>" +
        '<a class="btn sm" href="curves.html" style="margin-left:8px">看曲线</a></div>' +
        '<table class="table records-table"><thead><tr><th>次数</th><th>日期</th><th class="num">得分</th><th class="num">正确率</th><th class="num">总用时</th><th>备注</th><th></th></tr></thead><tbody>' +
        (list.length > 0
          ? list.map(rowHtml).join("")
          : '<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">这个试卷还没有记录</td></tr>') +
        "</tbody></table></div>";

  root.innerHTML = backupCard() + body;
}

function updateBackupAge() {
  const age = backupAgeText();
  const el = $("#backupAge");
  if (!el) return;
  el.textContent = age.text;
  el.style.color = age.stale ? "var(--warn)" : "var(--muted)";
}

async function exportBackup(btn) {
  btn.disabled = true;
  try {
    if (typeof store.backupFile === "function") {
      const res = await store.backupFile();
      markBackup();
      updateBackupAge();
      toast("已保存到 data\\backups\\" + res.file, "ok", 4600);
      return;
    }
    const data = await store.exportAll();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const how = await downloadText("行测模考备份-" + stamp + ".json", JSON.stringify(data, null, 2));
    exportedToast(how);
    if (how !== "cancelled") {
      markBackup();
      updateBackupAge();
    }
  } catch (err) {
    toast(err.message || "导出失败", "err", 3600);
  } finally {
    btn.disabled = false;
  }
}

async function importBackup(input, btn) {
  const file = input.files?.[0];
  if (!file) return;
  btn.disabled = true;
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
    if (res.imported > 0) setTimeout(() => location.reload(), 900);
  } catch (err) {
    toast(err.message || "导入失败", "err", 3600);
  } finally {
    if (busy) busy.close();
    btn.disabled = false;
    input.value = "";
  }
}

async function init() {
  markNav();
  if (!root) return;

  try {
    store = await getStore();
    meta = await store.meta();
    allExams = await store.listExams();
  } catch (err) {
    showFatal(root, err.message, "请通过 启动.bat 打开页面。");
    return;
  }

  render();

  root.addEventListener("change", (e) => {
    if (e.target.id === "typeFilter") {
      filterType = e.target.value;
      render();
    }
    if (e.target.id === "monthFilter") {
      filterMonth = e.target.value;
      render();
    }
  });

  root.addEventListener("click", async (e) => {
    if (e.target.id === "backupExport") return exportBackup(e.target);
    if (e.target.id === "backupImport") return $("#backupFile").click();

    const moveBtn = e.target.closest('[data-action="move"]');
    if (moveBtn) {
      const tr = moveBtn.closest("tr");
      const id = Number(tr?.dataset.id);
      const seq = Number(tr?.dataset.seq);
      const type = typeLabel(tr?.dataset.type);
      if (!Number.isInteger(id)) return;
      const input = prompt("在「" + type + "」内，把第 " + seq + " 次移动到第几次？", String(seq));
      if (input === null) return;
      const target = Number(input);
      if (!Number.isInteger(target) || target < 1) {
        toast("请输入正整数", "err");
        return;
      }
      moveBtn.disabled = true;
      try {
        await store.moveExam(id, target);
        toast("已调整顺序", "ok");
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        moveBtn.disabled = false;
        toast(err.message || "调整失败", "err", 3600);
      }
      return;
    }

    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = Number(tr?.dataset.id);
    const label = tr?.querySelector("td")?.textContent || "这条记录";
    if (!Number.isInteger(id)) return;
    if (!confirm("确定删除" + label + "？删除后不可恢复。")) return;

    btn.disabled = true;
    try {
      await store.deleteExam(id);
      allExams = allExams.filter((x) => x.id !== id);
      render();
      toast("已删除", "ok");
    } catch (err) {
      btn.disabled = false;
      toast(err.message || "删除失败", "err");
    }
  });

  $("#backupFile").addEventListener("change", () => importBackup($("#backupFile"), $("#backupImport")));
}

init().catch((err) => {
  console.error(err);
  if (root) showFatal(root, err.message || "未知错误");
});

