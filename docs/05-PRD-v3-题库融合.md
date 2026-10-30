# PRD v3 · 题库融合需求分析（2026-10-30）

> 状态：M1、M2、M3 均已落地（2026-10-30）；决策点 D1-D4 已确认，见 §6。
> 范围：只做本地个人使用，不发布，数据不出本机。

## 1. 需求整理（现状 + 生态）

### 1.1 我们已有（v0.3.0，A 档已交付）

| 能力 | 说明 |
|---|---|
| 模考录入 | 4 套试卷结构（江苏 A/B、江苏 C、国考副省级、国考地市级），每套独立编号 |
| 算分与曲线 | 得分/正确率/用时；区间选择（默认最近 15 次）；得分轴一位小数 |
| 波动诊断 | 期望分 E + 标准误 SE，\|δ\|≤SE 判正常 |
| 薄弱板块定量 | 末次 vs 区间平均，折算「补到均线多拿几题/几分」 |
| 复盘导出 | Markdown / CSV（`shared/report.js` 纯函数） |
| 记录管理 | 月份筛选、试卷筛选、区间平均分、备份导入导出 |

### 1.2 开源生态需求映射（按 star 与适配度）

| 项目 | ★ | 核心价值 | 结论 |
|---|---|---|---|
| `ERRRC/xingcezhenti` | 2069 | 真题语料：515 卷 / 58,890 题，`tiku.db` | **采纳为数据源**（B 档） |
| `ERRRC/kaogong-shuati` | 140 | 模块树刷题 + 错题本 + 做题统计；技术栈与我们一致（Node + `node:sqlite` + Capacitor） | **采纳刷题模式**，参考其查询层设计 |
| `jangviktor-web/GongkaoNaoku` | 56 | SM-2 间隔重复排程（27,506 题去重标注） | **采纳 SM-2** 做错题复习 |
| `KeWang0622/kaogong-skill` | 212 | AI 备考技能：错题复盘、薄弱诊断 | **采纳思路**（C 档：用统计数字喂 AI） |
| `xiao-jie520/xingce-helper` | 1 | 薄弱诊断 + 定量估算 | 已实现（A 档） |
| `Lee-hyun-R/analysis_tracker` | 1 | MD 复盘导出 | 已实现（A 档） |
| `Lucas-2687/xingce-tracker` | 0 | 跨设备同步（Vercel + Turso） | **不采纳**：个人本地使用，引入云依赖违背「数据不出本机」 |
| `YSMull/fenbi-helper` | 90 | 粉笔平台刷题辅助 | **不采纳**：依赖第三方平台账号 |

## 2. 需求分析：闭环缺口

现状只有备考闭环的左半环：

```
模考录入 → 算分 → 曲线 → 波动诊断 → 薄弱板块
                                      │
                                      ▼  (断)
                              针对性练习 → 错题复习 → 再模考验证
```

- 诊断结论（如「资料分析补到均线 +8.4 分」）目前**没有出口**：用户只能去纸质题册或粉笔 App 练，练习结果回不到本系统
- 这正是题库项目（2069★ 刷题库、140★ 刷题 App）火的根本原因：练习是备考的主战场
- 融合后的闭环：**诊断出薄弱模块 → 一键去刷该模块真题 → 错题进间隔重复队列 → 下次模考验证该模块是否提升**

## 3. 需求拆解（工作包）

### WP1 题库接入层（P0）

`tiku.db` 实测表结构（源码 `lib/local-queries.mjs` 摘录）：

```
papers(id, subjectName, category, name, questionCount, difficulty, chapters)
questions(id, questionId, paperId, chapter, type,
          content, contentHtml, options, answer, answerIndex, difficulty, analysis)
question_categories(question_id, ...)   -- 粉笔树
materials / q_materials / q_material_map -- 申论材料（暂不用）
```

- 只读挂载 `app/data/tiku.db`（gitignore，不进 git 不进 exe）
- `questions.chapter` → 我们的 `subtype.module` 映射（见 §4.1）
- 按 `papers.name/category` 过滤国考卷、江苏省考卷
- 缺库时给出「如何获取」的引导文案，不报错崩溃

### WP2 刷题模块（P0）

- 新增「练习」页：选模块（6 大类，对齐模考结构）→ 选来源（按卷 / 随机抽 N 题）→ 答题 → 判分
- 单选/多选判分；显示官方 `analysis` 解析
- 新表 `practice(id, question_id, paper_id, module, correct, seconds, done_at)`
- 练习模块正确率 = Σ答对 / Σ题量（与模考同口径）

### WP3 错题本 + SM-2 间隔重复（P1）

- 新表 `wrong_book(question_id, ease, interval, reps, due_at, last_result)`
- 答错自动入本；「今日复习」队列 = `due_at ≤ today`
- SM-2：答对按质量 q(0-5) 更新 ease/interval；连续两次低于 3 分重置

### WP4 统计融合（P0，差异化核心）

- 曲线页薄弱板块卡增加练习侧对照：
  - 模考弱 + 练习弱 → **真薄弱**（方法/知识问题）
  - 模考弱 + 练习强 → **临场问题**（时间分配/心态）
- 复盘 MD 增加「练习数据」段（近 7/30 天各模块练习正确率）
- 模考的期望分/SE 口径**不变**，不与刷题混算

### WP5 AI 复盘助手（P1，C 档）

- 输入：模考统计 + 练习统计 + 错题分布（都是数字，不含题目文本）
- 输出：诊断 + 下一步计划（Markdown）
- 配置存 `setting` 表（base_url / api_key / model），OpenAI 兼容协议；不配置则功能隐藏
- 纯浏览器 fetch（本机 key 本机用）

### WP6 迁移与打包（P2）

- `PRAGMA user_version` 3→4：新增 `practice`、`wrong_book` 三表，旧数据不动
- exe/APK：`tiku.db` 不打进安装包；启动探测 `data/tiku.db`，有则启用练习页

## 4. 融合设计

### 4.1 模块映射表（tiku chapter → domain.js module）

| tiku 章节组 | 我们的 module | 备注 |
|---|---|---|
| 言语理解与表达 | 言语理解 | 选词填空/片段阅读/语句表达并入 |
| 判断推理 | 判断推理 | 图形/定义/类比/逻辑判断 |
| 数量关系 | 数量关系 | 数字推理并入数学运算 |
| 资料分析 | 资料分析 | |
| 常识判断 | 常识判断 | |
| 政治理论 | 政治理论 | tiku 用「综合分析能力」等别名需归常识 |

四套试卷共用同一映射（我们 4 套的 module 名完全一致）。

### 4.2 数据口径

- 练习正确率与模考模块正确率同公式：Σ答对 / Σ题量
- 期望分 E、SE 只用模考记录（考试场景），刷题不进 E
- 薄弱板块的「区间平均」基准仍是模考自身；练习数据只做旁证对照

### 4.3 架构约束（不变）

- `shared/` 禁止 `node:` 导入；练习统计纯函数进 `shared/`
- 页面 → store → (http | local) → shared 依赖方向不变
- 零运行时依赖（`node:sqlite` 只读挂 tiku.db）

## 5. 里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| M1 | WP1 + WP2 + WP4 | 能刷江苏/国考真题、练习正确率出现在薄弱板块对照 |
| M2 | WP3 | 错题自动入本、SM-2 排程、「今日复习」可用 |
| M3 | WP5 | AI 生成复盘诊断，未配 key 时不可见 |

## 6. 待确认决策点

- ~~D1 练习粒度~~ 已定：**按 6 大模块**（与模考对齐）
- ~~D2 错题复习算法~~ 已定：**SM-2**；新错题当天入队，复习后按 SM-2 排期
- ~~D3 刷题端~~ 已定：**桌面先行**（tiku.db 走服务端 node:sqlite）；APK 待题库随包方案，小程序不做刷题
- ~~D4 题库文件~~ 已完成：`kaogong-shuati` 分卷重组出 `tiku.db`（318 MB，MD5 校验通过），放 `app/data/`，实测 **2,455 卷 / 95,627 题**，可判分单选 88,384 道
