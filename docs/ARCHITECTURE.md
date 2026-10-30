# 架构说明

## 总览

```
┌───────────────────────────── 浏览器 / WebView ─────────────────────────────┐
│ 页面（entry / curves / records / settings）                                │
│   └─ store.js  探测 api/health → store-http.js 或 store-local.js          │
│        └─ shared/domain.js · metrics.js · validate.js（纯函数）            │
└────────────────────────────────────────────────────────────────────────────┘
                     │ HTTP（桌面版）                 │ IndexedDB（网页/APK）
                     ▼                                ▼
┌────────────────────────── Node 服务（仅桌面版） ──────────────────────────┐
│ server.mjs                                                                │
│  ├─ lib/http.mjs     静态文件、JSON、错误、路径防护                        │
│  ├─ lib/api.mjs      路由与编排                                           │
│  ├─ lib/repo.mjs     SQL 访问、事务、顺序调整、导入导出                    │
│  └─ lib/db.mjs       建表、迁移、种子                                      │
│         └─ data/app.db（SQLite，WAL）                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

关键原则：

1. **计算只有一份**：`app/public/shared/` 同时被服务端与浏览器引用，避免口径漂移。
2. **存储可替换**：页面只依赖 store 的方法签名，桌面走 HTTP，网页/APK 走 IndexedDB。
3. **运行时可零依赖**：Node 只使用内置模块（`http`、`node:sqlite`）。

## 请求流（桌面版）

1. 页面加载 → `store.js` 请求 `api/health`
2. 成功 → 使用 `store-http.js`；失败 → 使用 `store-local.js`
3. 写操作 → `POST/PUT /api/exams` → `api.mjs` 校验（`validate.js`）→ `repo.mjs` 事务写库
4. 读统计 → `GET /api/stats?paperTypeId=N` → `repo.listExams` → `metrics.compactRows`

## 数据模型

```
paper_type(id, exam_type, paper_name, sort)
subtype(id, paper_type_id, module, name, qty, pts, sort)
exam(id, paper_type_id, seq, name, date, note, created_at, updated_at)
     UNIQUE(paper_type_id, seq)
exam_item(exam_id, subtype_id, correct, minutes)
```

- `seq` 在**同一试卷内**唯一，所以江苏第 1 次与国考第 1 次可以共存
- 迁移使用 `PRAGMA user_version`：1→2 加 `name`，2→3 加 `paper_type_id` 并重建 exam 表
- 重建 exam 表时先关闭外键、复制数据、改名，再打开外键，最后做 `foreign_key_check`

## 计算口径

- 得分：`correct × pts`，以「十分位整数」计算，避免浮点误差
- 期望分：`E = Σ(qty × p × pts)`，`p` 取该子题型最近 5 次**同试卷**正确率
- 噪声：`SE = √(Σ pts² × qty × p × (1−p))`
- 判定：`|实际 − E| ≤ SE` 为正常波动

## 前端性能

- 曲线页按试卷类型加载，只有当前试卷的结构
- 手机（≤900px）使用 `IntersectionObserver` 懒加载图表
- ECharts 使用本地文件，版本固定，避免 CDN 不可用

## 打包

### Windows exe（Node SEA）

1. `tools/build-exe.mjs`：esbuild 打包 `server.mjs` 为 CJS（必须 `await`）
2. `node --experimental-sea-config` 生成 blob，注入 node.exe
3. 把 PE 子系统从 Console 改为 GUI（无控制台）
4. 静态资源与 `seed.json` 作为 SEA 资源内嵌；首次运行时解压到临时目录
5. 数据目录取 exe 所在目录的 `data/`

### 安卓 APK（Capacitor）

1. `tools/build-www.mjs` 复制 `app/public` → `www/`
2. `npx cap sync android` 把资源放进 `android/app/src/main/assets/public`
3. GitHub Actions 构建 debug APK；`~/.android/debug.keystore` 由 `actions/cache` 固定，保证可覆盖安装

### PWA

- `manifest.webmanifest` + Service Worker
- Service Worker 采用网络优先、缓存兜底；在线时总是取最新文件
- 只有本地模式（无 `/api`）才注册

## 已知限制

- 纯前端代码无法真正保密：exe/APK 内的 JS 可被解包查看
- 网页/APK 的备份只能通过下载、分享或剪贴板，无法静默写任意目录
- 国考副省级满分按原始截图实现为 100.5 分
