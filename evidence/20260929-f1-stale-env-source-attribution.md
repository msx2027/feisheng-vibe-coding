# F1 修复：陈旧环境变量触发的拒绝必须报出来源（env source attribution）

日期：2026-09-29 · 批次：E2E 同日修复批（owner 拍板「这个要修」）· 性质：错误信息可诊断性修复，**零语义变更、零放宽**——fail-closed 行为原样保留

## 缺陷回顾（登记于 20260929-e2e-target-project-full-chain.md F1）

裸调用 `init-target-runtime.mjs` 被陈旧 `VIBE_CODING_SKILLS_HOME`（指向已删除的 `F:\skiils工具\vibe-coding-skills`）阻断时，报错只说 `Invalid skills root: <坏路径>`，不提该值来自环境变量。注册表 Machine/User 实测已空，脏值活在长寿命宿主进程环境里——排查者（本批实测）会先怀疑硬编码，绕路三步。

## 修复内容

`skills/event/experience-elevator/tools/init-target-runtime.mjs`：

- `resolveRoots`：解析来源三分计数——`--skills-root 参数` / `环境变量 VIBE_CODING_SKILLS_HOME` / `默认根`，传入校验器。
- `validateSkillsRoot(skillsRoot, source)`：报错统一带 `来源: <source>`；env 来源追加处置提示（更正/清空环境变量、长寿命宿主进程需重启刷新、或 `--skills-root` 显式指定）。
- **否决项**：env 坏根静默回退默认根——那是新增 fallback 层，违反操作法，不做。

## TDD 与回归（全新鲜证据）

- RED：anchor 套件新增考题「陈旧 VIBE_CODING_SKILLS_HOME 触发的拒绝必须点名环境变量来源」（设坏 env → 裸调用 --check → 断言退出码 2 且输出含 `VIBE_CODING_SKILLS_HOME`），先红。
- GREEN：修复后 anchor **23/23**（含既有「裸调用默认根解析」考题无损）。
- 实弹复现：以 E2E 现场原值（`F:\skiils工具\vibe-coding-skills`）设 env 裸调用，报错现为「Invalid skills root (来源: 环境变量 VIBE_CODING_SKILLS_HOME) … 疑似陈旧残留：请更正或清空它（长寿命宿主进程需重启才刷新），或用 --skills-root 显式指定本包根」。
- 回归：ledger-core **48/48**、closure **65/65** 无损；catalog 重生成（82 records）；`verify.ps1` **21/21**。

## 边界说明

- 受管块文案「设置了 VIBE_CODING_SKILLS_HOME 就优先使用它」**未动**：降 env 优先级属行为变更，留给 owner 单独裁决；本批只修可诊断性。
- `sources/` 快照内同名文件按规则冻结不动；根 `tools/init-target-runtime.mjs` 启动器只转发参数、无校验逻辑，无需改动。
