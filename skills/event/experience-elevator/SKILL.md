---
name: experience-elevator
description: '仅由 UserPromptSubmit Hook 的结构化纠错信号 structured-event caller 调用，不接受普通用户自然语言或 `vibe-coding-skills` 总入口路由；只处理 target-project，自动判断并记录 L0，升档、删除、硬化必须有用户确认凭据'
user-invocable: false
disable-model-invocation: true
---
[结构化事件闸门]
    本 Skill 只接受 UserPromptSubmit Hook 提供的 structured-event caller。普通自然语言、总入口 routeHints 和直接 Skill ID 都必须停止，不执行经验记录或升级。

[定位]
    把目标项目里的重复错误沿四级阶梯逐步硬化：
    - L0：`docs/项目治理/经验治理.md`，唯一计数与状态真源；ledger v2 还保存独立 `l1RegistryAnchor`，只锚定 current L1 registry 的 constitutionDesign 项目相对路径、固定 block identity/version 与 canonical sourceHash。
    - L1：`docs/项目治理/宪法设计.md` 中独立 ownership 的 `target-experience-registry` 受管块。
    - L2：从 L1 确定性生成到 `AGENTS.md` / `CLAUDE.md` 的 `target-experience-projection` 第二受管块。
    - L3：已真实接入 test / CI / Hook 的可执行 checker。Skill 只是编排，不算硬门禁。

[单 scope 硬边界]
    - 每个显性纠错事件必须带宿主提供的稳定 occurrence identity、可验证 `occurredAt` 和唯一 scope：`global-codex / target-project / package-feedback`。支持常见 snake_case / camelCase host ID；缺身份返回 `identity-required`，缺失或非法 scope 返回 `scope-required`，不得按 prompt 猜 eventId 或默认 package feedback。
    - 本 Skill 只接受 `target-project`。命中全局 Codex 或本包 feedback 时，只给跨域提议，不自动写入；禁止自动双写。
    - 跨域采用新事件 + 用户确认，不复用同一 eventId 在两个台账计数。
    - 项目内不保存原始用户 prompt；只保存 eventId、promptHash、signalType、scope、occurredAt 和绑定的 experienceId 等最小事件字段。

[依赖与真源]
    - `.vibe-docs.json.experienceGovernance` 必须指向 `docs/项目治理/经验治理.md`，并与 `documents[]` role=`experienceGovernance` 一致。
    - 启用后缺台账必须 fail closed；只有未启用时 checker 才可显式 `SKIP`。
    - 读写统一调用 `tools/experience-governance.mjs`；算账复用 `experience-ledger-core.mjs`，受管块复用 `experience-managed-blocks.mjs`，落盘复用 `safe-target-fs.mjs` 与 `target-doc-transaction.mjs`。自 2026-09-23 起该工具族已随本技能 bundle 发行（`skills/event/experience-elevator/tools/`，含两处部署 delta，见 RUNTIME-NOTES.md）；hook 侧自动记录仍由目标项目安装的 `experience-recorder.mjs` 承担（record/classify），二者共用 ledger v2 形状与 revision CAS。
    - 不手写 ledger JSON、不直接改投影、不另造平行计数文件。

[自动 L0 入口]
    - Hook 提供 `disposition=record` 且 `scope=target-project` 时，会同时输出 `autoRecord={skill:experience-elevator, action:record, decision:ai}` 路由；这是 AI 的自动触发信号，主 Agent 不得等待用户再次说“记住”或再次确认，完成当前任务后立即执行本 Skill 的 L0 判断与记录。
    - `autoRecord` 只是 Hook→AI→Skill 的结构化路由，不是第二个写入器；Hook 不直接改目标文件，AI 判断为可复用后调用既有 `tools/experience-governance.mjs` 的 `action=record`，继续复用 revision、幂等和事务写入。
    - AI 只把可复用的纠错、重复失败或已验证的流程教训写入 L0；一次性偏好或证据不足时跳过；任务局部选择也不写入，并简短说明“无可沉淀 L0 经验”。
    - 自动入口只允许 `record`：命中已有经验则 +1，未命中则创建 L0；新建 L0 可携 `theme`（"疼的部位"固定枚举，见 references/ledger-and-elevation.md），存量条目用 `classify` 回填；主题热度满打包阈值只生成打包提议，不得自动升级 L1/L2/L3、退役或硬化。
    - 目标项目未启用 `experienceGovernance` 或缺少台账时 fail closed，不创建替代经验文件；不保存原始 prompt。

[记录流程]
    1. 从 Hook 信号确认 `disposition=record`、scope=`target-project`；多 scope、缺身份、缺时间或其他非 record 状态只生成提议/跳过，不写入。
    2. 读取 ledger 的 `revision`，构造最小 event：`eventId / signalType / scope / promptHash / occurredAt`；`expectedRevision` 必须是显式非负整数。
    3. 命中已有经验则 `record + experienceId`；未命中则 `record + summary`。
    4. `experience-governance.mjs` 使用 expectedRevision、eventId 幂等和事务 journal 原子落盘；重放 eventId 不重复计数。
    5. 新 `EXP-NNN` 同时扫描 active 与 archived；已退役 ID 永不复用。
    6. 未达阈值只回一句简短计数结果，不打断当前任务。

[用户确认凭据]
    升档、删除、退役、L3 硬化都必须携带用户确认凭据：
    canonical fields 固定为 `receiptId / eventId / experienceId / scope / action / tier / confirmedAt`，`confirmationHash` 必须由这些字段重算；`confirmedAt` 必须是 canonical ISO 时间。
    ledger v2 的 `processedEvents`、`consumedConfirmations` 与 `archived` 必须在 parse/check/orchestrator 入口使用同一核心 validator 完整校验。全局 consumedConfirmations 与内嵌 confirmationHistory 必须双向 exact 且顺序一致。只把 canonical `升档 L0→L1/L1→L2/L2→L3` 与 `退役 L0|L1|L2|L3→retired` 视为机器 transition；其 action/fromTier/toTier 有序 multiset 必须与 confirmationHistory/consumedConfirmations 完全一致，额外、缺失、重复或乱序均 fail closed，普通 `记录@L0` 不误伤，legacy v1 不变。

[升档]
    - 未达当前档阈值不得 elevate；阈值默认 L0=3、L1=5、L2=8。
    - L0→L1：先向用户展示具体规则文本；确认后在同一 journal transaction 写入 L1 registry、更新 L0 `l1RegistryAnchor`，状态 `candidate`，计数归零。
    - L1→L2：确认后在同一 transaction 把 registry 规则置为 `active` 并更新 L0 anchor；runtime 生成器只按 `L0 anchor → current L1 registry → expected L2 projections/runtime registry` 单向校验和投影。
    - L2→L3：提供 checker 项目相对路径与 `registrationFiles`；orchestrator 验证文件真实存在、路径安全，并只认可 package scripts、CI `run:` 或 Hook 中实际执行 checker 的命令。Node 只接受 `node <checkerPath> [checker args]`。使用零依赖 canonical command-word tokenizer：每个 word 只能完全 unquoted，或由一对完整单/双引号包裹；未闭合引号、跨 token 首尾误配、关闭引号后直接拼接字符均拒绝。解释器 basename 只接受大小写敏感的 lowercase canonical token，Node/PowerShell/bash/sh 的 script-position 保持冻结。注册证据保存 `type/path/entry/command` 与完整 canonical match-set；同一路径允许不同 entry，但 tuple 不得重复。L2→L3 的 L1 hardening 更新与 L0 anchor 同 transaction。
    - `AGENTS.md` / `CLAUDE.md` 两份入口不是独立真源，禁止手改 `target-experience-projection` 块。

[退役]
    - 步骤由当前 tier 与 registry/projection/hardening 实际状态自动计算，不接受 caller 自报 `removed` 或 raw `l3Operations`。
    - 必须按 L3→L2→L1 逆序：registry hardening 先校验 canonical checker/registration 结构，退役前再从允许的 package/CI/Hook/test 文件 fresh 解析，并将 fresh match-set 与 stored match-set 做 exact set 比对；不接受 `registrationUpdates`、replacement content 或 raw operations。orchestrator 按 type 结构化、确定性删除全部 exact package script key、workflow run entry 或 Hook/test line，重新解析确认达到零 match 后，checker 才可在 `owned=true`、owner marker 与 hash 同时匹配时删除；随后撤销双投影和 registry 规则。L0 达阈值可直接留下 tombstone，不伪造 L1 步骤。
    - 撤销 L1 registry 时必须在同一 transaction 更新 L0 anchor；最后在 L0 archived 保留 `status=retired` tombstone、用户确认凭据、retirement 步骤和完整 trajectory。
    - 任一步失败由 `.vibe-experience-transaction.json` 回滚，不得留下半退役状态。

[L0 独立锚点与显式 adoption]
    - `l1RegistryAnchor=null` 只表示尚无 L1 registry；current L1 存在但 anchor 缺失/null，或 anchor path/version/hash 与 current L1 不匹配时，普通 record/elevate/retire 全部返回 `anchor-adoption-required` 或 conflict，文件保持不变。
    - 既有无 anchor 的 v2 项目只允许显式 `adopt-anchor`：先严格验证旧 v2 除缺 anchor 外无其他 schema 问题与 current L1 canonical；若已有 L2/runtime，必须先证明它们完整匹配 current L1；随后只在原子事务中写 anchor。runtime 不是 anchor 写入器，不得静默 adoption。
    - 新 bootstrap 无 L1 时允许 canonical anchor=null；首次创建 L1 时由 orchestrator 同事务写 anchor。
    - threat boundary：识别 L1+L2+runtime registry 协同改写；不引入签名系统，也不承诺识别攻击者同时重写 L0 与全部派生文件。

[双运行时信号]
    - Claude / Codex Hook 都是薄包装，统一调用 `tools/detect-experience-signal.mjs`。
    - 关键词、eventId、promptHash 与 signal schema 只维护一份；Bash 不依赖 jq。
    - Hook 只产生最小信号和 `autoRecord` 路由，不直接决定升档或跨域写入。

[按需加载 references]
    | 场景 | 读取 |
    | --- | --- |
    | 需要 ledger v2、确认 receipt、registry/projection marker 或 orchestrator 请求示例 | `references/ledger-and-elevation.md` |

[红线]
    - 不写用户全局 Codex 经验库。
    - 不把 target-project 事件自动写成 package feedback。
    - 不绕过阈值、用户确认、revision 或 checksum。
    - 不把 Skill 文本冒充 L3 checker。
