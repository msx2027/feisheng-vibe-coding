# 兼容与安装

本文件是 Skill 平台支持、源码验证、runtime bundle、安装、升级和排障的唯一用户文档。README 只保留快速入口；Codex 会话连续性插件的安装、信任、留存和清理生命周期由 `plugins/sliver-session-continuity/README.md` 单独拥有。

## 三层证据

任何平台支持声明都必须分开说明：

1. **格式与文档声明**：源码是否提供该 target 和安装路径。
2. **静态与打包验证**：source contract、runtime allowlist、adapter 和 guardrail 是否通过。
3. **fresh-session 行为**：目标宿主的新会话是否真实发现并执行，代表性任务是否符合预期。

前两层通过不能冒充第三层。真实命中率、路由正确率、小任务过度治理率和高风险门禁遗漏率仍需要 live behavior harness。

runtime validator 已提供 Task Decision、UI shape、formal materialization、truth resolution 和 release verdict 的失败关闭接口。它们被模型实际调用只能算行为证据；只有宿主在目标动作前通过 Hook 或受控 wrapper 强制检查退出码，才算 Host 强制。当前没有该宿主证据的 target 必须保持 `UNVERIFIED`，发布说明不得宣称“所有写入或发布都会被硬拦截”。

UI shape 当前只接受 `sliver-delivery-shape-lock/v3`：前置阶段绑定用户任务、用户心智、成熟交互模式、系统概念投影、完整旅程边界、信息架构、source schema 投影和可信 stable reference，验收阶段绑定前置 digest、源码 revision、成对视觉证据、DOM/无障碍和适用交互轨迹；不存在 v1/v2 兼容旁路。该合同只适用于新增或实质变化的 UI surface，D0/D1 局部颜色、间距、裁切或状态修正不因此升级为原型或阶段工程。

## v1.0.0 候选边界

`1.0.0` 候选包含按风险缩放的测试决策、讨论结论落盘、三轮审计与独立报告、工作室调度和处置规则，以及对应的六项冲突修复。三端运行包与规则检查独立验证；本机安装试用不等于自然发现、真实工作室或公开发布验收通过。

能力测试基线已按维护者确认的规则更新到 `tests/governance/baseline-1.0.0.json`，绑定提交 `fff6209`；旧治理基线保留用于历史完整性检查。发布仍须通过静态聚合检查；完整 fresh-session 行为保持 `UNVERIFIED`。

## v0.9.0 发布边界

`0.9.0` 是 `0.8.0` 之后的功能与公开合同升级，包含 Delivery Shape v3、Studio Director Continuity、按拓扑加载的 D0/bounded D1、54,962-byte bounded `项目体检` 候选，以及 portable pending-operation execution-liveness 合同。正式标签只表示该提交通过本仓库声明的源码与三端 runtime package 门禁；它不自动证明目标宿主已强制执行 Hook，也不把安装后自然命中率、完整 release-grade fresh-session 行为或 Host/service continuation 从 `UNVERIFIED` 提升为 `PASS`。

`项目体检` 的 54,962 bytes 包含当前 `SKILL.md`、runtime adapter、深度/风险/效果 owner、route catalog、选中 route projection、lens catalog、选中 frontend lens projection 和紧凑审计 owner，未通过漏算 registry/lens 维持预算。详细阶段 owner 和测试背板仍按证据条件加载；发现截断时只补取缺失边界，不能原样重放已截断的大批次。

## 源码、runtime 与 adapter

- 源码仓保留 `SKILL.md`、references、模板、测试、CI、README、CHANGELOG、兼容文档、海报和二维码。
- `packaging/runtime-manifest.json` 是具体 runtime allowlist 和 source-to-destination overlay 映射的唯一 owner；`scripts/runtime_manifest_contract.py` 只拥有发布 target 的角色与拓扑门禁。
- runtime 只包含模型执行必需的核心，不包含 `.git`、`.github`、tests、源码 validator、README、CHANGELOG、兼容文档、海报或二维码。
- Codex adapter 将 `packaging/adapters/codex/agents/openai.yaml` 注入 bundle 的 `agents/openai.yaml`。
- Claude Code = portable core + adapter：用宿主细则覆盖固定 `references/runtime-adapter.md`，并只额外注入一行 `assets/project-claude/CLAUDE.md` 入口；共享项目宪法保持唯一 owner。
- Gemini CLI = portable core only：当前不带任何平台 overlay。
- Trae 仍为实验目标，不生成可发布 bundle，也不声明一等支持。

`plugins/sliver-session-continuity` 是独立的 Codex 插件源码，不是 portable Skill runtime 的一部分。它只把有限、脱敏的会话证据写入 Codex 提供的 `PLUGIN_DATA`，运行时不读取或回写项目真源文档，也不会被复制进 Codex、Claude Code 或 Gemini CLI 的 Skill bundle。

内部 route 名不是命令，`$sliver-vibe-coding` 只是 Codex 的显式 skill 引用。自然语言发现仍是主入口。

## 当前平台矩阵

| 宿主 | 发布 target | 平台 adapter | 静态 bundle | fresh-session |
| --- | --- | --- | --- | --- |
| Codex | `codex` | `agents/openai.yaml` | build/validate 覆盖 | 安装或升级后必须重新验证 |
| Claude Code | `claude-code` | `references/runtime-adapter.md` + `assets/project-claude/CLAUDE.md` | build/validate 覆盖 | 新 adapter 结构仍需在目标版本做 fresh-session 验证 |
| Gemini CLI | `gemini-cli` | 当前无额外 overlay | portable core build/validate 覆盖 | 未在目标版本验证前不声称通过 |
| Trae | 无 | 实验状态说明 | 不发布 | `未验证` |

表中的状态只反映当前仓库合同，不代表未来宿主版本永远兼容。每次发布必须记录实测宿主、版本、日期和证据。

### Codex 会话连续性插件

插件源码位于 `plugins/sliver-session-continuity`，版本和安装生命周期独立于根 Skill 的 `VERSION`。安装或启用插件不会自动获得 Hook 信任；每次安装或修改后都必须复核 Hook 定义。

插件版本切换是会话边界。已经运行的任务可能继续持有旧的版本化 cache 路径，即使 Codex 已准备好新 cache，匹配 Hook 仍可能因旧路径消失而失败。安装或升级后必须重启 Codex Desktop、创建新任务并重新检查/信任当前 Hook；发生版本切换的旧任务不能作为 fresh-session 证据。

安装确认必须用普通中文明确列出：会保存最近四条用户请求、最新计划和上一条助手消息；数据只写 Codex 管理的 `PLUGIN_DATA`；脱敏不能保证识别未知秘密；正常会话结束立即清理，异常退出后的 24 小时规则是下一次 Hook 触发时惰性清理；不联网、不读项目真源。没有展示这些内容的泛化“安装插件”确认，不应当作用户已经理解本地消息留存。

当前源码测试覆盖主线程的请求证据、`update_plan`、手动/自动压缩检查点、失败降级、惰性 TTL、容量上限、私有权限、会话结束清理和受限手动清除边界。它不解析不稳定的 `transcript_path`，不保存通用工具输入/输出，不发起网络请求，也不把历史原文直接提升为 developer context。脱敏只能 best effort 识别常见凭据形态，不能保证覆盖未知秘密；仅靠 Hook 也不能保证推断出唯一语义目标、恢复模型内部推理、精确处理并发子 Agent，或拦截所有写入路径。24 小时是不活动状态在下一次 Hook 事件上的惰性清理阈值，不是后台定时器；异常退出、停用或卸载且不再触发 Hook 时，源码不能承诺恰好 24 小时删除。

当前证据状态：

- 确定性源码行为：由 `scripts/test_session_continuity.py` 覆盖。
- Codex 手动压缩 Hook 生命周期：`PASS`。2026-07-24 在 macOS arm64、Codex Desktop bundled CLI `0.146.0-alpha.3.1` 的新任务中，真实观察到 `PreCompact(trigger=manual)`、`PostCompact`、`SessionStart(source=compact)`、恢复上下文及正常结束清理。
- Codex 自动压缩 Hook 生命周期：`PASS`。同一目标宿主的新任务真实生成 `trigger=auto` 的 capsule，并依次产生 compacted 与 recovery-requested 标记；`recovery-requested` 仅在 `SessionStart` 返回 `additionalContext` 时写入。
- 语义恢复质量边界：Hook 生命周期通过不代表模型可以恢复内部推理或推断唯一语义目标；恢复后仍必须以当前用户消息和项目真源为准。
- 并发子 Agent 压缩恢复：不支持，明确降级。
- 用户从 Codex UI 发起手动清除：`UNVERIFIED`；源码 `--purge` 的删除边界已测试，但宿主是否暴露可用的插件命令环境仍需 live 验收。

### 工作室模式

`工作室模式` 是 `开发执行` 内部的可选执行形态：当前用户可见任务调度同一项目下其他完整、用户可见任务。它与子 Agent、会话连续性 Hook 和项目真源分别属于不同边界；宿主不具备完整任务创建、标识、等待、追问和环境控制能力时，只能明确报告不可用并回到当前任务串行执行，不能用子 Agent 冒充。

工作室资格只由任务图不变量决定，不维护游戏、前端、数据或其他行业白名单。领域名词替换但 owner、依赖、合同、环境和验收关系不变时，推荐结果必须保持不变；领域专属检查由当前项目真源和节点验收合同提供。

当前仓库已经包含 portable 推荐合同、Codex 专属任务工具映射，以及 Studio live evaluator。Codex 真实创建、等待、追问、返工和集成仍必须绑定当前 runtime digest 与源码 revision，并保留 `case_id`、用户确认事件、真实任务/工具事件与原始结果路径；未提供当前结果前状态为 `UNVERIFIED`。Claude Code、Gemini CLI 和 Trae 未声明该能力可用。静态合同或工具存在不能冒充真实多任务调度已经完成。

安全环境合同不允许写房间共享导演任务的本地 checkout。所有 writer 必须使用独立 worktree；默认分支只有在它确实是当前干净真源时才能作为隐式起点，当前未提交修改或现有非默认分支必须先用普通中文向用户说明并取得对应起点确认。每个 writer 创建前还必须确定 reviewed patch、reviewed artifact manifest 或另行授权 Git commit 之一作为成果回收合同。Studio live 结果必须保存并校验真实创建参数、有效起点 revision、写入模式和回收合同，不能仅依赖 runner 摘要或 judge 自述。

曾在当前 Codex Desktop 做过一次源码指向、只读的手工 smoke，完成 `create → wait → REWORK → 原 producer 返工 → 原 reviewer 复验` 并得到 `PASS`，相关测试任务随后归档。公开文档不保留真实任务标识或对话内容。该证据只证明当时宿主的只读任务链可用；它不是本次源码的 fresh-session 结果，写入型房间、worktree 隔离、服务/端口和 Git/发布动作仍为 `UNVERIFIED`。

## 环境要求

- Python 3.9 或更高版本。
- 只使用 Python 标准库，不需要安装 PyYAML 或其他依赖。
- 源码目录与最终 skill 安装目录必须分开。
- 本页命令和安装路径已按 macOS/Linux 的 POSIX 环境定义。Windows 尚未完成同等级安装、路径和 fresh-session 验收，本版不声明一等支持。

## 获取源码

```bash
git clone https://gitee.com/sliver-ring_admin/sliver-vibe-coding.git ~/sliver-vibe-coding-source
cd ~/sliver-vibe-coding-source
```

已有源码仓时直接进入该目录，不要再 clone 第二份。

## 生成并安装 runtime

`--output` 的最后一级目录必须严格是 `sliver-vibe-coding`。`--force` 只允许替换空的标准目录或已验证的旧 Sliver bundle；symlink、宽目录、错误 leaf 和含其他内容的目录都会在删除前被拒绝。构建器先在同父目录完成 staging，再原子替换；替换失败时恢复旧 bundle。

### Codex

```bash
python3 scripts/build_runtime_bundle.py --target codex --output ~/.codex/skills/sliver-vibe-coding --force
python3 scripts/validate_runtime_bundle.py ~/.codex/skills/sliver-vibe-coding --target codex --source-root .
```

### Claude Code

```bash
python3 scripts/build_runtime_bundle.py --target claude-code --output ~/.claude/skills/sliver-vibe-coding --force
python3 scripts/validate_runtime_bundle.py ~/.claude/skills/sliver-vibe-coding --target claude-code --source-root .
```

### Gemini CLI

```bash
python3 scripts/build_runtime_bundle.py --target gemini-cli --output ~/.gemini/skills/sliver-vibe-coding --force
python3 scripts/validate_runtime_bundle.py ~/.gemini/skills/sliver-vibe-coding --target gemini-cli --source-root .
```

安装后重启宿主，并使用 README 的“60 秒确认是否生效”在新会话验证。静态 bundle 通过不能代替这一步。

## 升级

```bash
cd ~/sliver-vibe-coding-source
git pull --ff-only
```

阅读 `CHANGELOG.md`，运行完整源码验证，再用对应 target 的 build 命令覆盖安装目录并运行 runtime validator。不要在 runtime 安装目录执行 `git pull`：runtime 不带 `.git`，源码仓才是更新 owner。

## 固定版本

在源码仓固定 commit 或正式 release tag，再生成 runtime：

```bash
cd ~/sliver-vibe-coding-source
git checkout <commit-or-release-tag>
python3 scripts/build_runtime_bundle.py --target codex --output ~/.codex/skills/sliver-vibe-coding --force
```

没有正式 tag 时，只能用确切 commit hash 保证可复现；不要把可变 `main` 描述成固定版本。

## 源码验证

```bash
python3 scripts/validate_skill.py
python3 scripts/evaluate_routes.py
python3 scripts/evaluate_task_decision_contract.py
python3 scripts/evaluate_task_decision_live_behavior.py --contract-only
python3 scripts/evaluate_selector_pressure.py
python3 scripts/evaluate_execution_backbone.py
python3 scripts/evaluate_ui_design_lifecycle.py
python3 scripts/evaluate_ui_design_live_behavior.py --contract-only
python3 scripts/evaluate_foundation_live_behavior.py --contract-only
python3 scripts/evaluate_studio_live_behavior.py --contract-only
python3 scripts/test_validation_contracts.py
python3 scripts/test_stage_v2_contracts.py
python3 scripts/test_foundation_guardrail_contracts.py
python3 scripts/test_task_decision_live_contracts.py
python3 scripts/test_ui_design_live_contracts.py
python3 scripts/test_studio_live_contracts.py
python3 scripts/test_runtime_bundle_safety.py
python3 scripts/test_session_continuity.py
python3 scripts/test_release_candidate_contracts.py
python3 scripts/validate_release_candidate.py --contract-only
python3 scripts/check_project_guardrails.py assets/project-bootstrap --mode bootstrap --foundation-gate contract --allow-template --skip-private-scan
python3 scripts/check_project_guardrails.py assets/project-adoption --mode adoption --foundation-gate contract --allow-template --skip-private-scan
python3 scripts/check_project_guardrails.py assets/project-bootstrap --mode constitution --foundation-gate contract --allow-template --skip-private-scan
python3 scripts/check_project_guardrails.py assets/project-adoption --mode constitution --foundation-gate contract --allow-template --skip-private-scan
```

这些命令验证源码合同，不应被复制进 runtime bundle。

`--contract-only` 只校验版本化 fixture、schema 和 rubric，不运行模型。没有 results 的默认 live 入口必须返回 `UNVERIFIED`。

本次 Delivery Shape v3 另以合成、非识别 fixture 做过源码指向的新任务 smoke，覆盖用户心智、完整旅程、字段减法、展示授权、成熟参考、无同角色参考和局部修正反例。测试任务显式读取当前工作树源码，不能证明未更新的本机安装会自然发现当前版本，也不满足受信 producer、干净候选和完整 artifact closure，因此只能记为 local source behavior；安装态与 release-grade fresh-session 均保持 `UNVERIFIED`。

## 正式发布证据门

`scripts/validate_release_candidate.py --contract-only` 是开发中可重复运行的跨平台静态门禁：它重新执行源码合同、会话连续性插件的确定性安全测试，并重建校验三个 runtime bundle，但不要求当前工作树干净。真正发布前还必须单独确认干净 Git 候选；插件测试通过不等于已安装、已信任或 live compaction 通过。目标宿主 fresh-session 应按本次变化选择最少的代表性 smoke，并分别记录通过项和 `UNVERIFIED` 边界。

不带 `--contract-only` 并同时提供 `task-decision-live-results.json`、`foundation-live-results.json`、`ui-design-live-results.json`、`studio-live-results.json` 的模式用于完整 live 行为验证。四组结果必须指向同一份干净源码候选；缺少任一组时该行为层为 `UNVERIFIED`，不否定已经通过的静态发包门，也不能声称模型行为已验证。

`.github/workflows/release-validate.yml` 只是完整 live 结果的 GitHub 消费端，不是 evidence producer。手工输入只允许选择受信 producer 的 `source_run_id`；producer repository、workflow path 与 workflow SHA-256 来自受保护 Environment 配置，不能由调用者填写。当前 workflow 只实现了这些静态绑定和内部 manifest 一致性，尚未实现受保护 policy digest、artifact attestation subject 验证或真实 producer trust root；`attestations: read` 权限本身不算验证。因此 full release 必须保持 `UNVERIFIED/BLOCKED`。本地直接运行 `scripts/validate_release_candidate.py` 只能提供静态/package 诊断，不能产生同等级的托管 producer binding。托管 workflow 不是产品 Owner，结果文件也只证明其中记录并可复核的行为范围。

候选仓库内运行的 baseline、capability、semantic 和 mutation validator 只能防止普通回退与已建模的协同误改，不能证明恶意候选无法同时修改 validator、tests 与 workflow。本 Skill 的规则与测试基线可在维护者明确确认变更后更新到固定源码提交，并继续执行完整防退化测试与运行包校验；基线更新本身不等于测试通过。公开发包由维护者授权，须通过静态发布门且明确未验证的行为边界。只有需要声明候选无法自我批准时，才需要候选外的 protected ref/reusable workflow 注入信任根；当前未建立该外部 verifier，不声明“不可自批”。

## runtime 验证

示例：

```bash
python3 scripts/build_runtime_bundle.py --target codex --output dist/codex/sliver-vibe-coding --force
python3 scripts/validate_runtime_bundle.py dist/codex/sliver-vibe-coding --target codex --source-root .
```

runtime validator 检查：

- 文件集合与 manifest 完全一致；
- 核心文件与源码 owner 的 SHA-256 一致；
- Codex metadata 只进入 Codex bundle；
- README、CHANGELOG、tests、CI、海报和二维码没有进入 runtime；
- `SKILL.md` 引用和项目模板/guardrail 可用。

它只提供 package/static proof，不冒充 fresh-session 行为证据。

## 项目宪法互操作

项目宪法约束目标项目，不负责发现 Sliver：

- Codex 读取 `AGENTS.md`。
- Claude Code 读取 `CLAUDE.md`；先把共享模板适配成根 `AGENTS.md`，再把 bundle 中严格为 `@AGENTS.md` 的薄入口放在旁边。已有 `CLAUDE.md` 时必须先检查并确认，不能静默覆盖。
- Gemini CLI 默认读取 `GEMINI.md`，也可以通过 `context.fileName` 指向 `AGENTS.md`。

只保留一个根宪法真源，平台入口不能复制第二套工程规则。

Claude Code 的宿主细则由固定 adapter slot `references/runtime-adapter.md` 拥有，包括宪法入口、安装位置和 auto memory 与项目真源的边界。Claude bundle 不覆盖 `assets/project-bootstrap/AGENTS.md` 或 `assets/project-adoption/AGENTS.md`，也不提供第二套 path-scoped 治理文件；所有宿主都消费同一份共享宪法 owner。

## 排障

如果新会话行为不符合 README 的 60 秒验证：

1. 检查宿主真正扫描的安装目录。
2. 检查是否存在旧的同名 skill、副本或旧 `sliver-engineering-workflow`。
3. 检查安装目录 `VERSION` 是否与源码一致。
4. 对安装目录运行对应 runtime validator。
5. 重启宿主并新开会话；不要用已经缓存 skill 的旧会话作为发现证据。

旧 `sliver-engineering-workflow` 只有在新 bundle 的 source、runtime 和 fresh-session 验证完成后才应退役。它的工程执行能力现在由 `references/engineering-execution.md` 与 `references/testing-strategy.md` 承担。
