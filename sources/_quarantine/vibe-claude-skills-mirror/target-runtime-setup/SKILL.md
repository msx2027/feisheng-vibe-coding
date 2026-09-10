---
name: target-runtime-setup
description: 仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `target-runtime-setup`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发。当目标项目已完成宪法设计层，或用户只要求刷新 / 检查 / 合并 AGENTS.md 与 CLAUDE.md managed block 时使用；首次完整接入先用 target-constitution-setup。
user-invocable: false
disable-model-invocation: true
---
[DocMap]
    层级：L3 / 关键 Skill
    模块：目标项目运行时接入
    依赖：
    - `tools/init-target-runtime.mjs`
    输出：
    - 目标项目 `AGENTS.md`
    - 目标项目 `CLAUDE.md`
    - 目标项目 `.vibe-runtime.json`
    - 接入检查或 dry-run 结果

[任务]
    刷新或检查目标项目 Codex / Claude 双运行时入口。
    这不是完整项目接入 Skill，也不生成项目画像；完整首次接入由 `target-constitution-setup` 负责，本 Skill 只负责安全写入 `AGENTS.md` 和 `CLAUDE.md` 中的短硬 managed block，并维护 `.vibe-runtime.json` 版本追踪。

[第一性原则]
    **目标项目上下文加载协议**：刷新 runtime 前先解析 `.vibe-docs.json` 的 schema v2、`documentIndex/documents/loadPolicy`，运行 `resolve-target-doc-context.mjs` 只请求 `documentIndex,projectProfile,constitutionDesign` 并按 selector 读取；never 被拒绝后立即停止，本 Skill 不得绕过。runtime block 必须写入同一 resolver 协议，不得重新引入“非快车道固定全文读取四份真源”的规则。

    **不覆盖用户规则**：已有 `AGENTS.md` / `CLAUDE.md` 只能追加或更新 managed block；用户原文必须保留。

    **入口必须短**：目标项目入口只写热路径规则：skills root、真源入口、项目画像 / 宪法设计引用、证据纪律、严格 TDD、visual-only T1 受控例外、review closeout（T2 Spec / Quality 双阶段、高影响独立 Reviewer、finding 复审、DONE 非证据、Phase 集成审查）、最小实现纪律、中文 Git 提交语言、停止条件、T0/T1 小任务快车道、非快车道最小加载和 `.vibe-docs.json` 不承载 runtime 入口。

    **T1 视觉例外边界**：visual-only T1 受控例外仅在没有既有测试 / visual regression seam 时使用改前基线与改后同路径定向视觉证据；已有 seam 或涉及用户路径、信息层级、响应式结构、全局 token / theme、UI 包契约、真实业务行为时，runtime 必须要求 `RED-GREEN-REFACTOR` 并重新分级。

    **脚本是唯一写入器**：使用 `tools/init-target-runtime.mjs`；不要手写或复制整份本包 `AGENTS.md` / `CLAUDE.md` 到目标项目。

    **L0 anchor 是独立前置门**：经验治理启用时，runtime 必须先读取 ledger v2 `l1RegistryAnchor`，再按 `L0 anchor → current L1 registry → expected L2 projections/runtime registry` 单向验证。anchor=null 只允许 current L1 不存在的 bootstrap；current L1 存在但 anchor 缺失/null，或 anchor 的 constitutionDesign 项目相对 path、固定 block identity/version、canonical sourceHash 任一不匹配时，`--check` / `--write` 都返回 `anchor-adoption-required` 或 conflict 且文件不变。runtime 不得写入、修复或反向刷新 anchor；adoption 只能由 governance/orchestrator 显式执行。

    **runtime registry 必须同步**：通过 L0 anchor 前置门后，写入或升级 managed block 时必须同时生成 / 更新 `.vibe-runtime.json`，记录 `AGENTS.md` / `CLAUDE.md` 的 managed block version、checksum、source、updatedAt；经验规则从当前 L1 registry 确定性重算并生成 L2 `target-experience-projection`，额外记录 `sourceHash` / `outputHash`。总 sourceHash、outputs 集合、每个 output sourceHash/outputHash、实际双投影块和重算结果必须全部一致，`experienceProjection stored/actual hash` 任一漂移都 fail closed；L1+双 L2+runtime registry 协同改写但 L0 未变时也必须 fail closed。威胁边界不含攻击者同时重写 L0 与全部派生文件；本方案不引入签名系统。

    **默认先预览**：除非用户明确授权写入，先运行 `--dry-run`；写入用 `--write`，复查用 `--check`。

    **路径可配置**：优先使用用户提供的 skills root；否则使用 `VIBE_CODING_SKILLS_HOME`；仍没有时使用当前本包根目录。写入前必须确认 skills root 有 `skills/INDEX.md` 和 `tools/init-target-runtime.mjs`。

    **生成前置条件**：首次完整接入必须先运行 `target-constitution-setup`，生成 `.vibe-docs.json.projectProfile` 与 `.vibe-docs.json.constitutionDesign`；如果只是修复或刷新 runtime block，可直接运行本 Skill，但缺失画像 / 设计文档时必须标记未验证。

[工作流程]
    1. 确认目标项目根目录；如果用户没有给路径，用当前工作目录。
    2. 确认 skills root；默认当前 `vibe-coding-skills` 包根目录。
    3. 如目标项目缺少 `.vibe-docs.json.projectProfile` 或 `.vibe-docs.json.constitutionDesign`，提示应先运行 `target-constitution-setup`；用户只要求 runtime 刷新时继续，但输出标记 `未验证`。
    4. 运行 dry-run：
       `node "<skills-root>/tools/init-target-runtime.mjs" "<target-root>" --skills-root "<skills-root>" --dry-run`
    5. 如果 dry-run 报 checksum conflict，停止并让用户处理 managed block 内的手改内容；不要自动覆盖。
    6. 用户已同意写入或任务本身明确要求初始化时，运行：
       `node "<skills-root>/tools/init-target-runtime.mjs" "<target-root>" --skills-root "<skills-root>" --write`
    7. 写入后确认 `.vibe-runtime.json` 已生成，且经验投影记录 `sourceHash` / `outputHash`，再运行：
       `node "<skills-root>/tools/init-target-runtime.mjs" "<target-root>" --skills-root "<skills-root>" --check`
    8. 如目标项目已有 `.vibe-docs.json`，先运行 `node "<skills-root>/tools/build-target-doc-index.mjs" "<target-root>" --check`，再运行 `node "<skills-root>/tools/check-target-doc-names.mjs" "<target-root>" --require-existing`。
    9. 运行 `node "<skills-root>/tools/resolve-target-doc-context.mjs" "<target-root>" --roles documentIndex,projectProfile,constitutionDesign --budget 12000 --json`，确认 runtime 只引用 resolver 返回的 selector。
    10. 运行 `node "<skills-root>/tools/check-target-doc-drift.mjs" "<target-root>" --quick --strict` 与 `node "<skills-root>/tools/check-lifecycle-doc-budget.mjs" "<target-root>" --strict`；报告 always 角色数、合计 token、index token 和超限 role，任何失败都阻止声明 runtime 接入完成。

[禁止]
    - 不复制整份本包 `AGENTS.md` / `CLAUDE.md` 到目标项目。
    - 不把 `AGENTS.md` / `CLAUDE.md` 写进 `.vibe-docs.json`。
    - 不自动修改全局 `$CODEX_HOME`、目标项目 hooks、`.claude/`、`.codex/` 或 Git 配置。
    - 不把首次接入升级成 quick/full health，除非用户明确要求体检。

[输出]
    - 说明是 dry-run、write 还是 check。
    - 列出 `AGENTS.md` / `CLAUDE.md` 的动作：create / append / update / none / conflict。
    - 如写入，说明用户原文已保留，只更新 managed block，并说明 `.vibe-runtime.json` 已同步或为何阻塞。

[初始化]
    执行 [工作流程]。
