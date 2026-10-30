# AGENTS.md（App 版）

给后续接手的 AI/开发者：先读这一页，再动代码。

## 1. 项目是什么

本仓库是「行测分析器」的**手机/App 版**（Capacitor APK），与桌面仓库同源代码，额外把真题以 JSON 子集内置，让手机也能刷题与复习错题。

用户每次模考后录入「每个题型的答对数 + 用时」，应用负责：
- 算分、算正确率、算模块/整卷用时
- 画正确率与用时曲线
- 用历史同试卷数据估算期望分与标准误，判断本次波动是否正常

App 版内置 pp/public/data/question-pack.json（3150 题 / ~2.4MB，来自 ERRRC/kaogong-shuati 的 tiku.db 抽样），只用于本机练习，不再依赖 Node 服务读 318MB 的 tiku.db。

## 2. 关键事实（容易踩坑，先记住）

- **4 套试卷结构**，定义在 `app/public/shared/domain.js`：
  - 1 江苏 A/B（135 题 / 100 分）
  - 2 江苏 C（130 题 / 100 分）
  - 3 国考副省级（130 题 / **100.5 分**，逻辑判断 10×0.85）
  - 4 国考地市级/行政执法类（135 题 / 100 分）
- **每种试卷各自编号**：`exam.seq` 在 `(paper_type_id, seq)` 上唯一，江苏第 3 次和国考第 3 次可以共存
- **数据只在本机**：桌面端 SQLite（`data/app.db`），网页/APK 用 IndexedDB。没有后端、没有上传
- **同一套前端代码**同时服务桌面与手机，靠 `js/store.js` 探测 `/api/health` 决定用 HTTP 还是 IndexedDB
- **exe 里没有控制台**（PE 子系统已改为 GUI），日志写 `data/app.log`，退出靠「设置 → 退出程序」
- **副省级满分 100.5** 是照原始截图实现的；改分值只改 `domain.js`，不要改计算逻辑
- **APK 的 versionCode/versionName 由 `APP_VERSION` 推导**（`android/app/build.gradle`）：`versionName` = 全串，`versionCode` = 距 2020-01-01 的分钟数。发版只跑 `npm run bump`，不要手改 Gradle 里的数字

## 3. 快速开始

```bash
npm install
npm start                 # http://127.0.0.1:3210
npm test                  # 55 个单元测试
npm run serve             # 静态预览 8080（无 API，自动走本地存储）
npm run bump              # 生成 0.3.0.YYYYMMDDHHmmss 版本号
npm run build:mp          # 生成小程序用的 utils/core.js
npm run verify:apk -- <apk> --version <版本> --cert android/keystore/cert.pem
npm run pack:tiku            # 重新导出台式 tiku.db 的题库子集（需 app/data/tiku.db）

```

打包：

```bash
npm run build:exe         # dist/行测模考分析器.exe（含 seed 数据）
npm run build:exe -- --no-seed   # 空白版
npm run build:release     # release/电脑版 + release/手机版
npm run build:www         # www/（给 Capacitor / 静态托管）
```

安卓：

```bash
npm run build:www
npx cap sync android
# GitHub Actions 的 android-apk 会自动构建；本地需 Android Studio
```

## 4. 架构与分层

```
app/server.mjs
  └─ lib/bootstrap.mjs      SEA 检测：解压内嵌资源、设置 APP_HOME / APP_PUBLIC_DIR
  └─ lib/http.mjs           静态服务、JSON 读写、错误响应、路径穿越防护
  └─ lib/api.mjs            路由：meta / exams CRUD / move / stats / export / import
  └─ lib/repo.mjs           SQL 访问：按试卷取列表、事务建改删、顺序调整、导入导出
  └─ lib/db.mjs             建表、迁移（v3）、种子（4 类 42 题型）、事务封装
  └─ lib/config.mjs         路径、端口、版本
  └─ lib/tiku.mjs           tiku.db 只读访问（状态/随机出题/按 id 取题）
  └─ lib/repo-practice.mjs  练习记录与错题本 SQL（含 SM-2 落库）
  └─ lib/ai.mjs             AI 配置读写 + OpenAI 兼容调用（服务端代发，key 不出本机）
  └─ public/shared/         浏览器与服务端共用（纯函数，勿引入 Node API）
       domain.js            试卷类型、题型、题量、分值、模块聚合、满分
       metrics.js           得分/汇总/期望分/SE/波动判定
       report.js            薄弱板块定量、复盘 Markdown/CSV 生成（纯函数）
       sm2.js               SM-2 错题排程（纯函数）
       tiku-map.js          tiku 章节 → 六大模块映射（纯函数）
       practice-stats.js    练习模块正确率、真薄弱/临场判定（纯函数）
       tiku-question.js     题目归一化、选项解析、计分、HTML 净化（纯函数）
       markdown-lite.js     AI 复盘 Markdown → HTML（纯函数）
       validate.js          入参校验（含 paperTypeId / name / seq / items）
       errors.js            AppError / ValidationError / NotFound / Conflict
  └─ public/js/
       store.js             http / local 适配器选择
       store-http.js        调 /api/*
       store-local.js       IndexedDB 实现（同一套方法签名）
       entry/curves/records/settings.js   四个页面
       ui.js / fmt.js       通用 UI、格式化、备份提醒

miniprogram/                独立的微信小程序工程（CommonJS）
  utils/core.js             由 app/public/shared/index.js 打包生成，勿手改
  utils/store.js            wx 本地存储 CRUD
  utils/chart.js            Canvas 2D 绘图
  pages/{index,records,curves,settings}
```

**依赖方向**：页面 → store → (http | local) → shared；服务端 api → repo → db，api 也用 shared。
`shared/` 里**禁止**出现 `node:` 导入，否则浏览器加载失败。

## 5. 数据模型（SQLite / IndexedDB 对应）

```
paper_type(id, exam_type, paper_name, sort)
subtype(id, paper_type_id, module, name, qty, pts, sort)
exam(id, paper_type_id, seq, name, date, note, created_at, updated_at)
     UNIQUE(paper_type_id, seq)
exam_item(exam_id, subtype_id, correct, minutes)   -- 每次 = 该试卷的子题型数
setting(key, value)
```

IndexedDB 把 `exam` 和 `items` 存成一条记录：`{id, paperTypeId, seq, name, date, note, items:[{subtypeId,correct,minutes}]}`。

迁移：`PRAGMA user_version` 1→2 加 `name`；2→3 加 `paper_type_id` 并重建 exam 表换取 `(paper_type_id, seq)` 唯一。
迁移前会备份到 `app/data/app.db.bak-v2`（仅本地，不入库）。

## 6. 计算口径（别改错）

- 得分 = 答对 × 每题分值，分值为 0.1 的整数倍，用「十分位整数」计算避免浮点误差
- 模块正确率 = Σ答对 / Σ题量
- 期望分 E = Σ(题量 × 该子题型历史正确率 × 分值)，历史窗口默认最近 5 次**同试卷**记录
- 噪声 SE = √(Σ 分值² × 题量 × p × (1−p))
- 偏差 δ = 实际分 − E；`|δ| ≤ SE` 判正常波动
- 各试卷独立诊断，不跨试卷混算

## 7. 前端约定

- 原生 ES Modules，无构建步骤；不要引入需要打包的库
- 新页面：复用 `ui.js` 的 toast / `$` / `escapeHtml` / `downloadText`
- 数字输入框：滚动滚轮不应改值（已全局 `preventDefault + blur`，勿删）
- 曲线按试卷切换；手机（≤900px）懒加载图表（IntersectionObserver）
- 曲线页有区间选择（默认最近 15 次）；总览图只有「总用时（左轴）+ 得分（右轴）」两轴，不要再加正确率轴
- 模块正确率小图纵轴自适应（最低值 ≥60% 时抬高基线），不要写死 0–100；手机端 KPI 为 3 列 × 2 行
- 移动端表格隐藏「日期/备注」列；录入页在 ≤480px 时表单纵向排列

## 8. 常见坑

- **Service Worker 缓存**：`service-worker.js` 是网络优先 + 缓存兜底；改静态资源不必升版本，但改缓存策略时记得改 `CACHE` 常量
- **localhost 慢**：服务同时监听 IPv4/IPv6，页面用 `127.0.0.1` 打开；不要把监听改回 `127.0.0.1` only
- **exe 黑框**：打包后需把 PE 子系统改为 GUI（`tools/build-exe.mjs` 已做）
- **APK 覆盖安装失败**：必须保持同一签名；CI 从 Secret `ANDROID_KEYSTORE_BASE64` 解码 `android/app/xingce-release.p12`，不要替换密钥或删除该步骤
- **构建竞态**：`esbuild.build()` 必须 `await`，否则 SEA 可能打包上一版代码
- **SEA 资源**：`app/public/**` 会被打进 exe；`seed.json` 可选
- **个人数据不入库**：`.gitignore` 已排除 `app/data/`、原始 xlsx、截图
- **小程序的 core.js 是生成物**：改了 `shared/` 必须 `npm run build:mp`，不要手改 `miniprogram/utils/core.js`
- **miniprogram/package.json 固定 `type: commonjs`**：小程序用 CJS；不要删，否则 Node 跑测试会把 .js 当 ESM
- **桌面端备份**：`POST /api/backup` 直接写 `data/backups/`；网页/APK 仍走下载或分享

## 9. 验证清单（改完必跑）

```bash
npm test                                   # 55 项（含 report/practice/tiku-question/markdown）
node --test tests/metrics.test.mjs tests/validate.test.mjs tests/miniprogram-store.test.mjs
```

手工冒烟：
1. `npm start` → 录入页能选 4 套试卷，行数分别为 12/12/9/9
2. 保存一次 → 记录页出现，类型/卷名正确
3. 曲线页能切 4 个标签，有数据时出图
4. 设置页能看到 4 套结构、导出/导入
5. 打包后 exe 能启动、迁移旧库、退出

## 10. 文档索引

- `README.md`：功能、使用、开发命令
- `docs/04-PRD-v2.md`：需求、口径、数据模型、里程碑
- `docs/ARCHITECTURE.md`：架构与请求流
- `docs/01-调研-GitHub生态.md`：同类项目调研
- `docs/分享说明.md`：给使用者的说明
- `miniprogram/README.md`：小程序开发与发布准备
- `CONTRIBUTING.md` / `SECURITY.md` / `CHANGELOG.md`

## 11. 代码风格

- 2 空格缩进、双引号、分号；文件名小写短横线
- 不写无意义注释；命名要能自解释
- 新增依赖前先确认必要性（当前运行时零依赖，开发依赖仅 esbuild / postject / Capacitor）
- 改动涉及口径时，同步更新 `docs/04-PRD-v2.md` 与本文件



