# 宪法体检 / 生成前证据包

> 读取时机：目标项目首次接入 `vibe-coding-skills`、生成或合并 `AGENTS.md` / `CLAUDE.md` 前。

## 目的

目标项目 runtime 入口只能写已经有证据支撑的规则。没有证据的能力必须标记为 `未验证`，不能把模板愿望写成项目事实。

## 证据包

运行 `node <skills-root>/tools/check-target-constitution.mjs <target-root> --skills-root <skills-root> --json`，收集：

- 真实文件：`package.json`、`.vibe-docs.json`、生命周期文档、源码目录、配置文件、部署文件。
- 真实命令：`package.json.scripts` 中的 `dev`、`build`、`test`、`smoke`、`check:health`。
- 真实目录：`src/`、`app/`、`pages/`、`tests/`、`prisma/`、`migrations/`。
- 用户已有入口：目标项目已有 `AGENTS.md` / `CLAUDE.md` 时保留原文，只分析 managed block 外的项目规则。

## Owner Map

必须给以下 owner 一个状态：

| Owner | 证据来源 | 状态规则 |
| --- | --- | --- |
| 产品 | `.vibe-docs.json`、`需求文档.md`、README | 有映射或说明为 `verified`，否则 `unverified` |
| 前端 | `src/`、`app/`、`pages/`、前端依赖 | 有页面或前端依赖为 `verified` |
| 后端/API | `app/api`、server route、Express/Fastify 依赖 | 有真实入口为 `verified`，否则 `unverified` |
| 数据/schema | `prisma/schema.prisma`、migrations、schema 文件 | 有真实 schema 为 `verified`，否则 `unverified` |
| 权限/auth | auth 文件、auth 依赖、权限说明 | 有真实证据为 `verified`，否则 `unverified` |
| 配置 | `package.json`、tsconfig、vite/next config、`.env.example` | 有配置文件为 `verified` |
| 测试 | test/smoke 脚本、tests 目录 | 有脚本或目录为 `verified` |
| 部署 | Dockerfile、vercel/netlify 配置、deploy 脚本 | 有部署证据为 `verified`，否则 `unverified` |

## 条款映射

对目标项目已有规则或模板规则逐条判断：

- `keep`：规则绑定真实文件、命令或用户已确认事实。
- `rewrite`：规则方向正确，但必须改成项目里真实存在的路径、命令或状态。
- `delete`：规则只来自模板，没有当前项目证据。
- `ask`：缺少产品意图或人工确认，不能靠扫描判断。

## 反浅改检查

以下情况必须在体检结果中报警：

- 入口只把项目名替换了，但仍写“遵守架构”“保证质量”“按最佳实践”等空话。
- 入口声明已有 API、schema、auth、部署能力，但没有对应文件、命令或文档证据。
- 缺失 `.vibe-docs.json` 时却把生命周期文档映射写成已完成。
- 把 `.env`、secret、private key 或数据库 dump 当成可提交资产。

## 使用结果

- `blockers` 存在：停止 runtime 入口写入，先解决路径、skills root 或 JSON 解析问题。
- `warnings` 存在：可继续 dry-run，但输出中必须标注风险；`--strict` 下作为失败处理。
- `gaps` 中的 API、schema、auth、deploy 只允许写成 `未验证`。
- 写入 `AGENTS.md` / `CLAUDE.md` 时不得把 `unverified` owner 描述成已落地能力。
