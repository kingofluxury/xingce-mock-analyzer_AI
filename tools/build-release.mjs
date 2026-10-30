import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "release");
const DESKTOP = path.join(OUT, "电脑版");
const MOBILE = path.join(OUT, "手机版");

const DESKTOP_README = `行测模考分析器（电脑版）

【怎么用】
1. 双击「行测模考分析器.exe」，浏览器会自动打开（没有黑窗口）。
2. 首次运行会在同目录生成 data\\ 文件夹（里面是 app.db），不要删除。
3. 退出：网页「设置 → 退出程序」。关掉浏览器不会退出程序。
4. 换电脑：把整个文件夹拷走即可，数据在 data\\ 里。
5. 给别人用：发「行测模考分析器-空白版.exe」，它不含你的历史记录。

【系统要求】
Windows 10 / 11，64 位。不需要安装 Node.js。

【常见提示】
exe 未签名，首次运行可能出现 SmartScreen 提示：点「更多信息 → 仍要运行」。
如果放在 C:\\Program Files 下无法写入数据，请放到普通文件夹（如桌面或 D 盘）。
`;

const MOBILE_README = `行测模考分析器（手机版 / PWA）

【怎么装到手机】
方式一（推荐）：把本文件夹里的全部文件上传到任意静态托管
（GitHub Pages / Cloudflare Pages / 自己的服务器），
用手机浏览器打开得到的网址 → 菜单 → 「添加到主屏幕」。

方式二（局域网预览）：在电脑上用任意静态服务器打开本文件夹，
手机与电脑连同一个 WiFi，访问电脑的 IP 地址。

方式三（本机预览）：在项目根目录执行 npm run serve，
打开 http://127.0.0.1:8080。

【数据说明】
- 数据保存在手机浏览器本地（IndexedDB），不上传服务器。
- 清理浏览器数据会删除记录，建议定期「设置 → 导出 JSON 备份」。
- 从电脑迁移：电脑「设置 → 导出 JSON」→ 手机「设置 → 导入 JSON」。

【注意】
不要直接双击 index.html（file:// 协议）使用，本地存储不可用；必须通过 http/https 打开。
不要在 Windows 上用 python -m http.server 预览（它可能把 .js 当成 text/plain，导致页面卡在「正在加载」）；
用项目根目录的 npm run serve，或直接上传到托管平台。
`;

function writeText(file, text) {
  fs.writeFileSync(file, "\uFEFF" + text, "utf8");
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(DESKTOP, { recursive: true });
  fs.mkdirSync(MOBILE, { recursive: true });

  const personal = path.join(ROOT, "dist", "行测模考分析器.exe");
  const blank = path.join(ROOT, "dist", "行测模考分析器-空白版.exe");
  if (!fs.existsSync(personal)) {
    throw new Error("找不到 dist\\行测模考分析器.exe，请先运行 npm run build:exe");
  }
  fs.copyFileSync(personal, path.join(DESKTOP, "行测模考分析器.exe"));
  if (fs.existsSync(blank)) {
    fs.copyFileSync(blank, path.join(DESKTOP, "行测模考分析器-空白版.exe"));
  }
  writeText(path.join(DESKTOP, "使用说明.txt"), DESKTOP_README);

  fs.cpSync(path.join(ROOT, "app", "public"), MOBILE, { recursive: true });
  writeText(path.join(MOBILE, "使用说明.txt"), MOBILE_README);

  const size = (p) => (fs.statSync(p).size / 1024 / 1024).toFixed(1) + " MB";
  console.log("已生成：");
  console.log("  电脑版：" + DESKTOP);
  if (fs.existsSync(path.join(DESKTOP, "行测模考分析器.exe"))) {
    console.log("    - 行测模考分析器.exe " + size(path.join(DESKTOP, "行测模考分析器.exe")));
  }
  console.log("  手机版：" + MOBILE + "（静态文件，上传即可）");
}

main();
