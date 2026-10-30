export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toast(message, kind = "", ms = 2600) {
  let wrap = $(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const node = document.createElement("div");
  node.className = "toast" + (kind ? " " + kind : "");
  node.textContent = message;
  wrap.appendChild(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transition = "opacity .2s";
    setTimeout(() => node.remove(), 220);
  }, ms);
}

export function markNav() {
  const current = location.pathname.split("/").pop() || "index.html";
  $$(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href === current) a.classList.add("active");
  });
}

export const BACKUP_KEY = "xingce.lastBackup";

export function markBackup() {
  try {
    localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  } catch {
    void 0;
  }
}

export function backupAgeText() {
  let raw = null;
  try {
    raw = localStorage.getItem(BACKUP_KEY);
  } catch {
    return { text: "无法读取备份状态", stale: true };
  }
  if (!raw) return { text: "从未备份", stale: true };
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return { text: "从未备份", stale: true };
  const days = Math.floor((Date.now() - at.getTime()) / 86400000);
  if (days <= 0) return { text: "今天已备份", stale: false };
  return { text: days + " 天前备份", stale: days >= 7 };
}

export async function downloadText(filename, text, type = "application/json") {
  const file = new File([text], filename, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "share";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
    }
  }
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    } catch {
      void 0;
    }
  }
  const blob = new Blob([text], { type: type + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "file";
}

export function showBusy(title, detail) {
  const wrap = document.createElement("div");
  wrap.className = "overlay";
  wrap.innerHTML =
    '<div class="overlay-card"><h3></h3><p></p><div class="progress"><i></i></div></div>';
  const heading = wrap.querySelector("h3");
  const text = wrap.querySelector("p");
  heading.textContent = title || "";
  text.textContent = detail || "";
  document.body.appendChild(wrap);
  return {
    update(nextTitle, nextDetail) {
      if (nextTitle !== undefined) heading.textContent = nextTitle;
      if (nextDetail !== undefined) text.textContent = nextDetail;
    },
    close() {
      wrap.remove();
    },
  };
}

export function exportedToast(how) {
  if (how === "cancelled") return;
  if (how === "share") toast("备份已发送", "ok");
  else if (how === "clipboard") toast("已复制到剪贴板，粘贴保存为 .json 文件", "ok", 3600);
  else toast("备份文件已下载", "ok");
}

export function showFatal(container, message, hint) {
  container.innerHTML =
    '<div class="empty"><h3>加载失败</h3><p>' +
    escapeHtml(message) +
    "</p>" +
    (hint ? '<p class="tiny">' + escapeHtml(hint) + "</p>" : "") +
    '<button class="btn" onclick="location.reload()">重试</button></div>';
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
