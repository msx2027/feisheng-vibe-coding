# 目标运行时模板「承诺—实物」对齐登记（2026-09-17）

## 背景与裁决

check-hotspots 事件（模板承诺 `check-hotspots.mjs` 而实物从未随包）暴露了一类病：
模板以强制语气向每个目标项目承诺不存在的机器门禁。第一性原理裁决（owner 会话拍板「做」）：
**不实物化旧代文档治理脚本**（昂贵核已由各项目本地门禁覆盖——实证为 fs-agent 自建
`check-doc-index` 三查；移植会制造第二 owner 必然分叉；且绑定项目已裁决不迁移的旧契约），
**改承诺文本与实物对齐**。`check-ui-reuse.mjs` 维持待生效设计，激活条件出现时再议；
触发实物化的重评信号：第三个项目再次自建同类文档检查时。

## 变更（LOCAL-PATCHES 登记 id: vibe-target-runtime-promise-reality-fix）

`sources/vibe-coding-skills/tools/init-target-runtime.mjs`（快照树补丁，4 行）：
1. 真源入口：`resolve-target-doc-context.mjs` 从「必须运行」改为「旧代 resolver 未随包；
   自备按其执行，未自备人工同口径（rg 定位 → 门面 → 单份）」；
2. 受管文档同步：`setup-target-hooks.mjs` PostToolUse 与 `check-target-doc-precommit.mjs`
   同上条件化（自备等价工具如本地文档索引门禁时按其执行）；
3. Markdown 治理：`check-markdown-governance.mjs` 同上条件化；
4. `TARGET_RUNTIME_BLOCK_VERSION` 21→22（契约文本变更信号）。
全部语义约束保留：metadata/index 只再生不改正文、`sourceRevision` 保护、
结构性整理须用户确认、读取先门面后单份。

## 下游刷新

fs-agent AGENTS.md / CLAUDE.md 由生成器升级通道刷新（--write，v21→v22），
不手改受管块——遵循 fs-agent 宪法第 91 行「改本包生成器并重跑 init-target-runtime.mjs」。

## 验证

- 生成器 fs-agent `--dry-run`/`--write` 实测；diff 仅 3 句话与版本标记变化；
- feisheng `verify.ps1` 全绿（快照完整性按补丁后状态重录）；
- fs-agent 提交前全链（文档三查/依赖边界/结构棘轮）绿。
