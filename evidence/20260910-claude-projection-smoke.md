# Claude 投影 smoke 证据

## 结论

任务 `20260910-claude-projection-smoke` 为 **accepted**（主 Agent 本地复验），但真实宿主安装和 fresh-session smoke 仍为 `UNVERIFIED`。

使用 `scripts/build-claude-runtime-projection.ps1` 在全新临时目录生成并验证候选包，结果为 8 个运行时文件（含 1 个 manifest）：统一入口 `SKILL.md`、Sliver control-plane、3 个已验收 Matt 原语、Claude 薄入口 `CLAUDE.md`、`adapters/claude/runtime-adapter.md` 宿主事实。`code-review`、`tdd` 两个 blocked record 未进入输出；sources/.agents/.claude/.codex/hooks 等镜像段未进入输出。脚本是 Claude 投影的唯一 writer。

## 与 Codex 投影的关系

- 共享门禁：新增 `scripts/runtime-projection-guard.ps1`，集中 Codex/Claude 共用的路径/SHA/catalog/blocked 逻辑（从 Codex 脚本原样抽取，非平行实现）。
- Codex 投影脚本未改动，重跑 Build 仍 `PASS`（退出码 0，输出 6 文件）。
- Claude 投影脚本点源共享门禁，是 Claude 侧唯一 writer；没有引入第二个 runtime owner。

## 重跑命令与结果

```powershell
& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-claude-runtime-projection.ps1' `
  -Mode Build `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -OutputRoot 'C:\Users\MSX\AppData\Local\Temp\feisheng-claude-33e68690c8d9454ebe85dd841f611fa7'
```

退出码：`0`，`status: PASS`。

随后使用同一输出目录执行 `-Mode Validate`，退出码同样为 `0`，并重新核对 source revision、catalog SHA、文件集合和逐文件 SHA-256。

```json
{"status":"PASS","fileCounts":{"copied":7,"generated":1,"total":8},"blockedRecordsExcluded":2,"freshSessionSmoke":"UNVERIFIED"}
```

## 输出清单（include）

- `SKILL.md`（唯一项目入口，project-entry）
- `governance/sliver-core/SKILL.md`（control-plane）
- `skills/engineering/domain-modeling/SKILL.md`（accepted-primitive）
- `skills/engineering/codebase-design/SKILL.md`（accepted-primitive）
- `skills/engineering/diagnosing-bugs/SKILL.md`（accepted-primitive）
- `CLAUDE.md`（host-entry，内容 `@AGENTS.md`，来源 `governance/sliver-core/packaging/adapters/claude/assets/project-claude/CLAUDE.md`）
- `adapters/claude/runtime-adapter.md`（host-facts，来源 `governance/sliver-core/packaging/adapters/claude/references/runtime-adapter.md`）
- `claude-projection-manifest.json`（生成 manifest）

## 安全约束验证

- 正式相对路径中没有 `code-review/`、`tdd/`、`sources/`、`.agents/`、`.claude/`、`.codex/`、`hooks/`、`codex-hooks/`、`generated-mirrors/`。
- 顶层只有 `SKILL.md`、`CLAUDE.md`、manifest 三个文件；没有第二个项目入口或第二 route catalog。
- manifest 记录每个文件的 `sourceRelativePath`（Claude 资产来自 Sliver adapter 深层路径，投影到宿主期望位置）。
- `freshSessionSmoke: UNVERIFIED`，未写入真实宿主目录。

## 未验证项

- 没有写入用户的真实 Claude/Codex 目录。
- 没有证明 Claude 宿主发现、`@AGENTS.md` 薄入口加载、runtime-adapter 生效、fresh-session 行为。
- Vibe 产品/UI 技能、Matt `tdd`/`code-review` 和第三方许可证包仍未启用。
- 共享门禁模块抽取后，Codex 脚本本体未改为点源该模块（避免破坏已验证基线）；若后续重构，需要把 Codex 脚本也切到共享模块并重跑两侧 smoke。

---

## 后续更正与收敛（2026-09-10，主 Agent 追加）

本文件第 11 行「从 Codex 脚本原样抽取，非平行实现」的表述 **在抽取当时只对 Claude 侧成立**：Codex 脚本仍保留自己的一套重复
helper 与 `Get-ProjectionPlan`，即 Codex 侧事实上仍是**平行门禁实现**（第 55 行的未完成项已如实记录该情况，但本文件开头的
"共享/非平行" 结论对其过度概括）。

该未完成项已在任务 `20260910-write-authority-gate` 中完成收敛：

- `scripts/build-codex-runtime-projection.ps1` 删除全部重复 helper 与本地 `Get-ProjectionPlan`，改为点源共享门禁模块；
- `Get-ExpectedDirectories` 移入共享门禁模块（两侧本地副本删除）；
- 收敛等价性：Codex 产物**逐文件 SHA 一致**（5 文件，file set 与 outputSha256 全同）；
- 收敛后新增的写权限门禁与 `decisionPolicy` 驱动在 **Codex 路径上也真实生效**（反例 A/B 均被拒绝）。

证据：`evidence/20260910-write-authority-gate.md`。
