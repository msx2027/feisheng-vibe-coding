# 证据：包基础设施补装＋anchor 套件复活（布局校验存量断裂第一批修复）

- 日期：2026-09-29
- 输入 revision：起点 main @ `5a7af20`
- owner 授权：fs-agent 会话 2026-09-29，owner 令「从第一性原理做最优决策」处置两笔挂账（anchor/closure 存量断裂＋陈旧环境变量）
- 第一性原理裁定：**修法＝把搬家丢失的包基础设施补回实物，而不是放宽任何 fail-closed 校验**。validateSkillsRoot 要求的 skills/INDEX.md 与 tools/init-target-runtime.mjs 是「真包根」的存在性凭证；工具本体迁移后这两件实物消失，导致 ①宪法承诺的刷新指令（`node <skills-root>/tools/init-target-runtime.mjs`）无处可执行 ②anchor 套件（21 用例，覆盖升档确认凭据管线——整个体系里最不允许静默出错的部分）自迁移起 0/21 不可运行 ③VIBE_CODING_SKILLS_HOME 用户级环境变量指向已删除路径成纯地雷。守卫语义一字未改。

## 改动面（5 文件）

| 文件 | 改动 |
|---|---|
| `skills/INDEX.md`（新） | 真实导航索引：5 域 51 技能按目录实况清单＋运行时工具入口说明 |
| `tools/init-target-runtime.mjs`（新） | 发布布局启动器：realpath 定位本体（skills/event/experience-elevator/tools/）后 spawnSync 转发、stdio inherit、退出码透传；本体 isMain 守卫要求 argv[1] 为真实路径故不可 re-export（EXP-216） |
| `skills/event/experience-elevator/tools/test-experience-governance-anchor.mjs` | harness 补 packageRoot（向上找 provenance/CANONICAL-CATALOG.json 定位真包根），runRuntime 的 --skills-root 从经验电梯目录改为真包根；runtimeTool 与 governance 导入路径不动（本就指向迁移后真实位置） |
| `provenance/CANONICAL-CATALOG.json` | 重生成 |
| `evidence/20260929-package-infra-restore-anchor-suite.md` | 本文件 |

## 验证证据（2026-09-29 实测）

- `test-experience-governance-anchor.mjs`：**21 passed, 0 failed**（迁移以来首次可运行；经真实 init-target-runtime 子进程覆盖 bootstrap/adoption/fail-closed 全流，连带实覆盖 5a7af20 的 swept 绑定参数）
- `test-experience-ledger-core.mjs`：48 passed（回归无损）
- `scripts/verify.ps1`：21/21 all gates passed（新增根 tools 文件未扰 catalog）
- 启动器冒烟：`node tools/init-target-runtime.mjs <target> --skills-root <包根> --check --json` 经启动器→本体链路返回 `"ok": true`——宪法承诺的刷新指令自此真实可执行
- 顺手处置：用户级环境变量 `VIBE_CODING_SKILLS_HOME=F:\skiils工具\vibe-coding-skills`（指向已删除路径，PowerShell [Environment]::GetEnvironmentVariable(…,"User") 查实）已删除——指向虚无的指针是纯地雷；所有现行调用方均显式传 --skills-root，不依赖该变量

## 仍挂账（非本批，如实登记）

- `test-experience-governance-closure.mjs`（14 passed/52 failed）：其头部常量指向旧架构实物（`hooks/detect-feedback-signal.sh`、`codex-hooks/`、`.claude/hooks/` 镜像等 bash 世代文件，现行 adapters/ 架构已无对应物），须先做「旧世界套件重映射 vs 退役」的 owner 裁决才能修复，布局修复救不了它
- init-target-runtime 裸调用（不带 --skills-root）的 DEFAULT 根在迁移后仍指向工具所在目录而非包根——文档化用法均显式传参故不受影响；如需裸调用可用，另行小批加祖先上溯（未纳入本批，避免扩散改动面）

## closure 处置决策登记（2026-09-29 owner 拍板：分层复活）

owner 在大白话体感讲解后三选一拍板「留金题修好」。决策内容与批次范围（下一批独立 Goal 执行，本节只登记）：

- **退役组**（约 10 用例）：信号采集 wrapper/双镜像组——被测实物（`hooks/detect-feedback-signal.sh`、`codex-hooks/`、`.claude/hooks/`、`.codex/hooks/` 镜像、`tools/check-experience-ledger.mjs`）经实测全部不存在；其现行等价覆盖（采集/autoRecord/消化标记/幂等/凭据硬门禁）已由全绿的 `tests/test-vibe-hook-adapter.ps1` 承担。退役即删除这些用例与死路径常量。
- **复活组**（约 40 用例）：升档确认凭据管线组——orchestrator replay/collision、畸形 confirmation/Unicode 伪装 transition 拒绝、canonical 档位冲突、L2→L3 checker 证据、L2 双投影、台账自定义路径越界、退役逆序 tombstone 等。重映射到迁移后真实位置（experience-governance/managed-blocks/ledger-core 在 `skills/event/experience-elevator/tools/`，recorder 在 `adapters/vibe-hooks/`；checker CLI 等价物须先核实是否迁移，缺失则该子组单独挂账）。
- **预期与纪律**：重映射后会暴露迁移期沉淀的真语义漂移，当场修并逐条留痕；不动 orchestrator 本体语义；`tools/check-experience-ledger.mjs` 等缺失实物先查证再定，不凭记忆假设。
- 入口：新会话独立 Goal，包仓库 main 直提（沿本日三批惯例），证据另立卷。
