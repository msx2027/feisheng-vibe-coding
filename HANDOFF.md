# Feisheng Vibe Coding 交接文档

更新时间：2026-09-10

## 总目标

把以下三个来源重构为一个可维护、可审计的统一仓库 `F:\skiils工具\feisheng-vibe-coding`：

- `F:\skiils工具\sliver-vibe-coding`
- `F:\skiils工具\vibe-coding-skills`
- `F:\skiils工具\mattpocock-skills`

统一仓库必须以 Sliver 为唯一项目级控制面，按来源追溯（provenance）、许可证、调用类型和运行时边界逐项处理 Vibe 与 Matt 技能；不能只是把三包并排复制。三个来源仓库必须保持不被修改；证据不足时保持 source-only、blocked 或回滚，不能因为“看起来可用”就接入。

## 已确认的架构决策

1. **Sliver 是唯一项目级控制面和主路由。** 不能出现第二个项目入口、第二个 route catalog、第二个 target truth 或第二个 runtime writer。
2. **Matt 仅提供工程原语。** 已接入的原语不能拥有项目路由、target truth 或 Hook 写入权。
3. **Vibe 是产品/UI/checker/宿主适配候选。** 其内容不是自动运行时依赖；许可证或宿主行为没有逐项证明前，保持 source-only。
4. **运行时只读取 canonical catalog。** `provenance/CANONICAL-CATALOG.json` 是唯一技能决策真源；`provenance/SKILL-INVENTORY.json` 只是来源事实快照。
5. **Hook 必须只有一个 runner。** 当前 Vibe Hook 适配器是默认禁用的合约，不得执行来源 Hook，也不得安装到真实 Codex/Claude 目录。
6. **不能伪称真实新 Codex 对话/归档。** 当前宿主只证明了逻辑隔离的子 Agent、任务包和证据回写；没有可验证的“创建并归档真实新会话”API。

## 当前基线

- 仓库：`F:\skiils工具\feisheng-vibe-coding`
- 分支：`main`
- 最新提交：`caec2e2b767b0b265928d54fe7f6169f06b408f3`（`feat: define disabled vibe hook adapter contract`）
- 工作树：交接文档写入前干净。
- 当前 Goal：尚未完成，必须继续保持 active。

## 已完成且有证据的事项

| 范围 | 结论 | 证据/入口 |
|---|---|---|
| 三项目盘点 | 共 82 项：Sliver 1、Vibe 46、Matt 35 | `provenance/SKILL-INVENTORY.json`、`provenance/CANONICAL-CATALOG.json` |
| 来源快照 | Sliver 223/223、Vibe 550/550 文件 SHA 一致 | `provenance/`、已有 snapshot evidence |
| 唯一控制面 | Sliver 已作为 control-plane 接入 | `governance/sliver-core/`、`SKILL.md` |
| Matt 工程原语 | `diagnosing-bugs`、`codebase-design`、`domain-modeling` 已接入 | `skills/engineering/`、`evidence/20260910-matt-primitive-adoption.md` |
| Codex 静态投影 | Build/Validate 通过，只输出入口、Sliver 和 3 个 Matt 原语，加 1 个 manifest | `scripts/build-codex-runtime-projection.ps1`、`evidence/20260910-codex-projection-smoke.md` |
| Vibe 基础四项 | `architecture-foundation`、`target-constitution-setup`、`target-runtime-setup`、`doc-sync-guardian` 已审计，仍是 source-only | `evidence/20260910-vibe-foundation-audit.md` |
| Vibe Hook 边界 | Hook 来源审计完成；最小 adapter 合约已定义并默认禁用 | `evidence/20260910-vibe-hook-audit.md`、`adapters/vibe-hooks/contract.json` |
| Hook 合约 smoke | Validate 成功；Invoke 被拒绝且返回码 3；Codex 投影复跑 Build/Validate 成功 | `tests/test-vibe-hook-adapter.ps1`、`evidence/20260910-vibe-hook-adapter-contract.md` |
| Matt 阻塞复核 | `tdd`、`code-review` 及其联动 `implement`、`ask-matt` 的未提交改名未解锁 | `evidence/20260910-matt-blocked-followup.md` |

## 当前技能状态

`CANONICAL-CATALOG.json` 当前汇总：

- `control-plane`：1
- `accepted-primitive`：3
- `adapter-candidate`：7
- `blocked-unclassified-working-tree`：2
- Vibe 其余大多为 `source-only-*`、`event-only-source-only` 或 `excluded-in-progress`。

这里的关键含义是：**只有 3 个 Matt 原语进入候选 Codex 静态投影。所有 Vibe 技能、Vibe Hook、Matt `tdd`/`code-review` 都没有进入运行时。**

## 仍未完成的工作

### P0：Vibe 的逐项许可证与能力归类

1. 按有界分组审计剩余 Vibe 技能，至少写清：来源 revision、许可证/NOTICE、调用类型、会写什么、是否试图拥有路由/truth/runtime/Hook 权限。
2. 先处理不含第三方 UI 许可证的产品/checker/user-tool 分组；UI 组必须逐项检查 `impeccable`、`ui-styling`、`ui-ux-pro-max` 等的 bundled LICENSE/NOTICE。
3. 只有许可证映射完整、写入边界明确且独立逻辑审查完成，才能把单项从 source-only 改为 `adapter-candidate`。这不等于直接投影到运行时。
4. 每一批使用 `tasks/<id>.md` + `evidence/<id>.md`，主 Agent 必须重跑关键命令验收。

### P0：Matt 四项阻塞技能

`F:\skiils工具\mattpocock-skills` 当前有 4 个未提交文件：

- `skills/engineering/ask-matt/SKILL.md`
- `skills/engineering/code-review/SKILL.md`
- `skills/engineering/implement/SKILL.md`
- `skills/engineering/tdd/SKILL.md`

其中 `code-review` frontmatter 改为 `mattpocock-code-review`，但 plugin manifest、marketplace、README 等仍显示旧名。没有新提交、PR 或维护者确认前：

- `tdd`、`code-review` 必须维持 `blocked-unclassified-working-tree`；
- `implement`、`ask-matt` 不得因工作树内容而解锁或改写；
- 不修改来源仓库，不把这 4 个工作树版本复制到目标仓库。

### P1：宿主投影与发布能力

1. Claude projection 尚未实现和验证。
2. Codex projection 只是静态临时输出，真实宿主 discovery、trust、fresh-session smoke 未验证；不得写入真实宿主目录，除非另有明确授权和回滚方案。
3. 完成一套发布/回滚/NOTICE 包验证，确保 mixed-license 内容不会被根许可证错误覆盖。
4. Hook 只有在 per-skill license、host discovery、事件顺序/并发、写白名单/回滚和独立逻辑审查全部通过后才能由禁用态改为启用候选。

## 本轮子 Agent 状态

用户要求主 Agent 居中调度、尽量让 5.6 Luna 使用独立上下文执行。

- 已完成的低成本调研结果已回写到仓库证据。
- `luna_vibe_hook_audit`：服务过载中断，不能算独立审计通过。
- `luna_matt_blocked_followup`、`luna_matt_retry`：流中断，不能算独立审计通过；Matt 阻塞证据由主 Agent 本地复验。
- `luna_product_audit_v2`、`luna_ui_audit_v2`：用户中断对话时被中止，没有产出可验收结果。

重新派发时应使用新的任务标识和新的 Luna 上下文；旧任务没有回执，不得补标 accepted。

## 建议的接手顺序

1. 读取本文件、`AGENTS.md`、`docs/AGENT-ORCHESTRATION.md`、`provenance/CANONICAL-CATALOG.json`、`provenance/LICENSE-MAP.json`。
2. `git status --short` 和 `git log -1 --oneline` 确认基线；不要重置或回退任何已有提交。
3. 新建两个有界 Luna 任务：一个审计 Vibe 产品/checker/user-tool，另一个审计 Vibe UI/第三方 LICENSE/NOTICE；各自只写授权的 task/evidence 文件。
4. 主 Agent 重跑证据中的关键命令，检查是否引入第二个 owner、第二入口或无授权写入；仅接受证据充分的结果。
5. 许可证台账完整后再决定哪些 Vibe 能转为 adapter-candidate；先不进入 runtime。
6. 继续处理 Claude projection、真实宿主 smoke 和发布/回滚/NOTICE 门禁。

## 常用验证命令

```powershell
# 目标仓库状态
git -C 'F:\skiils工具\feisheng-vibe-coding' status --short
git -C 'F:\skiils工具\feisheng-vibe-coding' log -1 --oneline

# Hook 默认禁用行为
& 'F:\skiils工具\feisheng-vibe-coding\tests\test-vibe-hook-adapter.ps1' `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'

# 运行时静态投影。OutputRoot 必须是一个不存在的新目录，且不能在仓库内。
& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-codex-runtime-projection.ps1' `
  -Mode Build `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -OutputRoot 'C:\Users\MSX\Documents\Codex\<新临时目录>'
```

## 不可突破的边界

- 不安装新依赖，除非先证明现有能力不够并取得用户明确同意。
- 不修改三个来源项目。
- 不把 Vibe `.claude/`、`.agents/`、`.codex/` 镜像当成正式来源或运行时内容。
- 不把混合第三方许可证合并成一个根许可证。
- 不把 static smoke 写成真实宿主可用，也不把中断的子 Agent 回执写成独立审计通过。
