# 贡献指南

感谢你愿意改进这个项目。请先阅读 [AGENTS.md](AGENTS.md) 了解架构与口径，再按下面的流程提交改动。

## 开发环境

- Node.js ≥ 22.5（项目使用内置 `node:sqlite`）
- Windows 10/11（仅打包 exe 需要）
- Android Studio / JDK 21（仅本地构建 APK 需要）

```bash
npm install
npm start        # http://127.0.0.1:3210
npm test
```

## 目录约定

- `app/public/shared/`：浏览器与服务端共用，**禁止**引入 `node:` 模块
- `app/lib/`：仅服务端
- `app/public/js/`：前端页面与存储适配器
- `tests/`：`node:test` 单元测试

## 代码风格

- 2 空格缩进、双引号、分号
- 原生 ES Modules，不引入需要构建的运行时库
- 命名自解释，不写无意义注释
- 计算口径改动必须同步 `docs/04-PRD-v2.md` 与 `AGENTS.md`

## 提交信息

使用 Conventional Commits：

```
feat: 支持按试卷类型筛选曲线
fix: 修复滚轮修改数字输入的问题
docs: 补充架构说明
chore: 升级 setup-android 到 v4
```

## 提交前检查

```bash
npm test
```

手工冒烟（至少）：

1. 录入页 4 套试卷都能切换，题型行数 12/12/9/9
2. 新增、编辑、删除、移动顺序正常
3. 曲线页 4 个标签都能切换
4. 设置页结构表、导出/导入正常

## Pull Request

- 一个 PR 只做一件事
- 说明背景、改动点、验证方式
- 涉及 UI 变更请附截图
- 不要提交 `dist/`、`release/`、`www/`、`node_modules/`、`app/data/`

## 数据与隐私

- 仓库不包含任何真实做题数据
- 测试请使用自己构造的样例
- 不要提交 token、密钥、个人备份

## 许可证

提交的代码默认按 [MIT](LICENSE) 许可发布。
