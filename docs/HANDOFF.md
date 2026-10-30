# 交接 / 上下文压缩（2026-10-28）

## 1. 项目一句话

本地运行的行测模考记录与分析工具：录入各题型答对数与用时，自动算分、画正确率/得分/用时曲线、判断成绩波动。支持 4 套试卷结构。

## 2. 代码位置

```
E:\项目\国考
├─ app/                  桌面版（Node + SQLite + 原生前端）
│  ├─ server.mjs
│  ├─ lib/               config/bootstrap/http/api/repo/db
│  └─ public/            shared（domain/metrics/validate）+ 四个页面 + store
├─ android/              Capacitor 安卓工程（固定 release 签名）
├─ miniprogram/          独立微信小程序工程（CJS，复用 shared）
├─ tools/                构建、图标、版本、exe、小程序 core
├─ tests/                node:test（33 项）
├─ docs/                 调研、PRD、架构、分享说明、截图
└─ dist/ release/        本地打包产物（已 gitignore）
```

## 3. 当前状态

- 远端 `main` = `4c1d63a`（用户已在合规环境推送）
- 本地 = `ec5c584`（交接文档提交）+ 本轮未提交改动（`tools/verify-apk.mjs`、`package.json`、本文件）
- 本机 DLP 仍会拦截 git 外发，后续推送请在合规环境执行
- **本机无法查 CI、也无法本地打 APK**（2026-10-29 实测）：
  - `https://api.github.com` 经代理返回 **403**（不是 401，是拦截）；无 `gh` CLI；无 token
  - 无 JDK、无 Android SDK → 不能 `gradlew assembleRelease`
  - 结论：`android-apk` 是否绿色、Artifacts 下载，只能在合规环境完成
- 最近提交：
  - `1f7757d` 修复 build.gradle 的 UTF-8 BOM
  - `ff0f660` CI 自动查找并校验 APK；release 强制固定 keystore
  - `7657f30` 固定 release 签名（Secret 注入）；android-apk 仅 main 触发
  - `400d592` 记录按次数排序；用时单位统一为分钟
  - `d1e605b` 总览加得分线；模块平均；手机端录入标题分行
- 单测：`npm test` → 33/33
- 最新版本：`0.3.0.20261029184633`（exe / release / 小程序已同步）

## 3.1 跨端一致性（2026-10-28）

| 问题 | web / exe | 微信小程序 |
|---|---|---|
| 导入后按 id 排序错乱 | 已改按「试卷 + 次数」 | 已改（store.listExams） |
| 用时单位「分」 | 已改「分钟」 | 已改（录入/记录/曲线） |
| 总览缺得分 | 已加得分线（右轴） | 已加得分线（同轴 0–120） |
| 模块标题是最近一次 | 已改平均 + 分钟 | 已加平均文案 |
| 手机端模块标题挤 | 题量/满分移到名称下方 | 已改 |

> 桌面导出仍直接写 `data/backups/`；网页/APK 走下载或分享；小程序走剪贴板，这是平台限制，不是未修复。

## 4. 已实现功能

- 4 套试卷：江苏 A/B、江苏 C、国考副省级（100.5 分）、国考地市级
- 每套试卷独立编号（`paper_type_id + seq` 唯一）
- 录入：模块正确率 / 模块总用时 / 得分，实时计算
- 曲线：总用时线（左轴，分钟）+ 得分线（右轴，分）；模块正确率/用时；点值标注
- 曲线区间选择：默认最近 15 次，可选取「第 X 次 至 第 Y 次」任意区间（选项带卷名），KPI 与模块平均随区间联动
- 模块正确率小图纵轴自适应：区间内最低值 ≥60% 时从 10 的倍数基线起画，避免高分时曲线被压平
- 手机端 KPI 固定 3 列 × 2 行（网格），不再随宽度变成 2 列
- 波动诊断：同试卷最近 5 次，期望分 + SE
- 卷名、备注、日期；记录筛选；移动顺序
- 备份：桌面端直接写 `data/backups/` + 打开文件夹；网页/APK 下载或剪贴板
- 导入进度遮罩（web/exe/小程序）：显示条数 + 进度条，导入中禁止重复点击
- 版本：0.3.0.20261029184633
- PWA 离线；APK；独立小程序工程

## 5. 待办（优先级）

1. **确认 `android-apk`（`4c1d63a`）是否绿色** —— 需在合规环境打开 Actions 页
   - 该提交只动 `app/**` + `miniprogram/**` + `docs/**`，未动 `android/**`、`gradle`、`capacitor.config.json`
   - 因此构建路径与已验证成功的 `1f7757d` 完全一致，风险极低
2. 下载 Artifacts `xingce-analyzer-release` → `app-release.apk`，**先本地校验再动手机**：
   ```bash
   node tools/verify-apk.mjs app-release.apk --version 0.3.0.20261029184633 --cert android/keystore/cert.pem
   ```
   期望：`签名方案 v2`、`证书SHA256 28c4235c…3f8a`、`结论 MATCH`、版本 = `0.3.0.20261029184633`
   - 版本对不上 → 拿到的是旧包（当前 Downloads 里的 `xingce-analyzer-release.zip` 就是 `0.3.0.20261028145051`，即 `1f7757d` 的包）
3. 一次性迁移：旧 App「设置 → 导出备份」（存到手机 Download）→ 卸载 → 安装新 APK → 「设置 → 导入备份」
4. 备份 `android/keystore/xingce-release.p12` 与密码 `xingce123456`
5. ~~versionCode 递增~~ **已完成（2026-10-29）**：`android/app/build.gradle` 从 `app/public/shared/version.js` 的
   `APP_VERSION = 0.3.0.YYYYMMDDHHmmss` 推导 —— `versionName` 用全串，`versionCode` = 距 2020-01-01 的分钟数
   （每分钟 +1，约 359 万，远小于 2100000000）。发版只需 `npm run bump`，不再手改 Gradle；`npm run bump` 会打印对应 versionCode
   - 首个带新 versionCode 的包必须**先卸载旧包**（签名不同，与 versionCode 无关）

### 5.1 已验证事实（2026-10-29）

- 手上那份 `1f7757d` 的 APK：`v2` 签名，证书 SHA256 `28c4235c8be36e5cfd6b0d6c4a6c956a66d64f611f702c353076697535823f8a`，与 `android/keystore/cert.pem` **一致**
- 说明：CI 的 `ANDROID_KEYSTORE_BASE64` 注入、`build.gradle` 固定签名、`apksigner verify` 三步都是通的
- 也说明：**新包与旧手机上的 debug 包不同签名**，所以第一次必须卸载一次；此后同 key 覆盖安装即可

## 6. 签名与密钥（关键）

- keystore：`android/keystore/xingce-release.p12`（本地，gitignore）
- alias：`xingce`；store/key 密码：`xingce123456`
- CI：从仓库 Secret `ANDROID_KEYSTORE_BASE64` 解码到 `android/app/xingce-release.p12`
- `android/app/build.gradle` 的 release 强制使用该 keystore
- 仓库历史已用 force-push 清除曾经提交过 keystore 的 commit；当前代码库无密钥
- 旧 APK（2026-10-27 及之前）用的是临时 debug key，已丢失 → **必须卸载一次**；之后同 key 可直接覆盖

## 7. 安全约束（重要）

- 本机 DLP 已拦截 `git.exe` 向 GitHub 发送数据（2026-10-28 20:00，HEAD 请求）
- **不要再在本机执行 `git push` / `git fetch` / `git ls-remote` 等联网操作**
- 需要上传时由用户在公司允许的环境手动执行；不要代推
- 仓库为私有：`github.com/kingofluxury/1256`

## 8. 常用命令（本地）

```bash
npm install
npm start            # http://127.0.0.1:3210
npm test             # 33 项
npm run bump         # 生成 0.3.0.YYYYMMDDHHmmss 版本号
npm run build:mp     # 生成小程序 utils/core.js
npm run build:exe    # dist/行测模考分析器.exe
npm run build:release
npm run verify:apk -- <apk> --version <版本> --cert android/keystore/cert.pem
```

> 本机 `npm` 会因执行策略被拦（`npm.ps1` 禁止运行）；用 `npm.cmd test` 或直接 `node --test tests/*.test.mjs`。

## 9. 容易踩的坑

- `shared/` 禁止 `node:` 导入；改完要 `npm run build:mp`
- 写 Gradle/JS 文件不要带 BOM（PowerShell `Set-Content -Encoding UTF8` 会加）
- 数字输入禁用滚轮；曲线手机端懒加载
- 页面用 `127.0.0.1`，服务双栈监听
- 副省级满分 100.5 是照截图实现，不是笔误修正
- `miniprogram/package.json` 固定 `type: commonjs`

## 10. 文档索引

- `README.md`、`AGENTS.md`、`CONTRIBUTING.md`、`SECURITY.md`、`CHANGELOG.md`
- `docs/04-PRD-v2.md`、`docs/ARCHITECTURE.md`、`docs/分享说明.md`
- `miniprogram/README.md`（发布前的备案/类目清单）




