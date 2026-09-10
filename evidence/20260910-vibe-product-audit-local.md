# Vibe 产品/checker/user-tool 组本地审计证据（主 Agent 逻辑审查）

审计日期：2026-09-10
任务包：tasks/20260910-vibe-product-audit-v3.md、tasks/20260910-vibe-product-audit-v4.md
审计人：主 Agent（本地只读逻辑审查）
状态：review-unavailable（独立 Luna 审计因宿主 503 中断，无回执；不得视为独立交叉审查通过）

## 范围与方法

- 目标：provenance/CANONICAL-CATALOG.json 中 source=vibe-coding-skills 且状态为 source-only-product-or-checker、source-only-checker、source-only-unreviewed、event-only-source-only 的 29 个技能（含 code-review 目录，catalog id vibe-code-review）。
- 方法：对每个技能目录计算 SKILL.md SHA-256 并与 catalog sourceSha256 对照；读取 frontmatter（name / user-invocable / disable-model-invocation / version / allowed-tools）；rg -n --encoding utf-8 检索写入动词、.vibe-docs.json / AGENTS.md / CLAUDE.md / .claude / Hook / runtime / route / canonical / CANONICAL-CATALOG 等关键引用。
- 来源快照：sources/vibe-coding-skills/ 是非 git checkout（F:\skiils工具\vibe-coding-skills 不是 git 仓库），因此 catalog sourceRevision: null 是事实记录；本轮只验证快照 SHA。

## 快照 SHA 对照（29 项全部一致）

以下 SHA-256 与 catalog sourceSha256 完全一致（小写）：

| 技能 | SHA-256（前 16 位） | 目录文件数 |
|---|---|---|
| architecture-foundation | dc24aeaa67274840 | 2 |
| audit | 112b76c94760b016 | 1 |
| bug-fixer | ecf909cbb990f5ea | 1 |
| codebase-memory-scout | 3cb816fed287f9ab | 2 |
| critique | 8b308ae0ae1a7b22 | 4 |
| design-brief-builder | 2eefae58bc7c1dcd | 2 |
| design-maker | 21263c47b67640e0 | 1 |
| dev-builder | 47279c8a3ebfd070 | 65 |
| dev-planner | fd168a661f392f6b | 9 |
| doc-sync-guardian | 5bd7272fa432f93c | 3 |
| harden | 5c61c790d5f499a0 | 1 |
| hotspot-governor | e0397907ada596ff | 1 |
| optimize | a30162f5d56cc9b5 | 1 |
| product-spec-builder | ea28e7a526a7301b | 12 |
| release-builder | 1f7616ecf61a3c3b | 1 |
| requirements-test-designer | 02de1b4c6cfbc31b | 17 |
| rule-harvester | a3a3aadc77fa09df | 1 |
| skill-builder | 0b8cbf368dabbc9e | 2 |
| target-constitution-setup | 158c255d5a56464c | 2 |
| target-runtime-setup | b1db777856778353 | 2 |
| test-automation | 4da564996970853f | 4 |
| ui-system-guardian | 0cc78518d7fab13b | 3 |
| code-review（vibe-code-review） | f056c73726f5fcf8 | 1 |
| beginner-flow-guide | 935a5962df0346b4 | 2 |
| clarify | 69a975485176752e | 1 |
| shape | 8a75ce770b2e26a6 | 1 |
| evolution-engine | d7527dcb9be0aa6a | 1 |
| experience-elevator | d5ad25b0a1133a54 | 2 |
| feedback-writer | 6b9b72c299771730 | 1 |

## 调用类型

29 项 frontmatter 全部为 user-invocable: false、disable-model-invocation: true；description 统一声明「仅当用户先明确调用 vibe-coding-skills 总入口并指定本 Skill，或由总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发」。结论：没有第二个项目入口；全部依赖唯一总入口路由。

evolution-engine、experience-elevator、feedback-writer 三项 frontmatter 进一步限定为结构化事件 caller（SessionStart / UserPromptSubmit Hook / feedback-observer 子 Agent），普通自然语言、总入口 routeHints、直接 Skill ID 一律停止；不得归为普通 user-tool。

## 逐项写入边界（仅列出会写文件的技能）

| 技能 | 写入目标 | 写入器 / 门禁 | 是否试图拥有仓库级 route/truth/runtime/Hook |
|---|---|---|---|
| product-spec-builder | 目标项目 需求文档.md、需求变更.md、.vibe-docs.json、接口契约.md | 声明生成的是用户目标项目文档，不是本分发包维护文档；根目录 Markdown 仅允许 AGENTS/CLAUDE/文档索引 | 否（真源指向目标项目 .vibe-docs.json） |
| dev-planner | 目标项目 docs/项目治理/开发计划.md | 读取 .vibe-docs.json | 否 |
| dev-builder | 目标项目代码、docs、.vibe-docs.json | 按 Phase；写生命周期文档后跑 check-target-doc-names.mjs | 否 |
| target-constitution-setup | 目标项目 项目画像.md、宪法设计.md、.vibe-docs.json，再交 runtime 写 AGENTS/CLAUDE managed block | 默认 dry-run；缺脚本停止；写后 check/guardrail | 否（目标项目 truth 适配器；不拥有统一仓库 truth） |
| target-runtime-setup | 目标项目 AGENTS.md / CLAUDE.md 短硬 managed block、.vibe-runtime.json | 唯一写入器 init-target-runtime.mjs；checksum / sourceHash 漂移 fail closed | 否（runtime overlay 适配器；目标项目级） |
| doc-sync-guardian | 目标项目既有文档真源、AGENTS.md / CLAUDE.md managed block version/checksum、.vibe-runtime.json | 不建立平行 truth；drift 检查收口 | 否 |
| rule-harvester | 提议写 vibe 源码 tools/init-target-runtime.mjs Agent 宪法；只读扫描目标项目手写区与用户全局 | 任何写入必须逐条用户确认；改源码前要求 git 版控或备份；绝不自动写全局 .claude / .codex | 否（写入须确认；不拥有统一仓库 truth） |
| experience-elevator | 目标项目 docs/项目治理/经验治理.md、宪法设计.md L1 受管块、AGENTS/CLAUDE L2 投影 | 统一 tools/experience-governance.mjs；缺台账 fail closed；升档/删除/硬化须用户确认凭据 | 否 |
| evolution-engine | .claude/feedback/ 驱动规则毕业，写入目标 SKILL.md 或本包 CLAUDE.md | 只生成提议，用户确认后执行；与 rule-harvester 互斥不双写 | 否 |
| feedback-writer | .claude/feedback/ 与索引 | 只接受 feedback-observer structured-event caller | 否 |
| skill-builder | 新 Skill 文件（本包/目标项目内） | 模板优先；治理继承 | 否（创建新技能须经用户流程） |
| release-builder | 目标项目发布产物、Git tag、GitHub Release | 安装策略：新增依赖须用户同意；T3+ 发布闭环 | 否 |

其余技能（audit、bug-fixer、codebase-memory-scout、critique、design-brief-builder、design-maker、harden、hotspot-governor、optimize、requirements-test-designer、test-automation、ui-system-guardian、beginner-flow-guide、clarify、shape、code-review）为只读 checker / 文档输出工具；未发现试图拥有 route/truth/runtime/Hook 权限的声明。

## 依赖情况

- 绝大多数技能声明「本 Skill 无外部依赖 / 不安装依赖 / 新增依赖须用户确认」。
- 引用的工具均为来源包内 tools/*.mjs / scripts/*.mjs 或已安装能力（rg、Git、Playwright、gh CLI 等可选增强，缺失降级不阻塞）。
- critique allowed-tools 引用 npm exec --offline -- impeccable（offline 执行本包 bundled 的 impeccable），未要求在线安装新依赖。
- 未在本轮执行任何安装命令。

## 分组结论（建议，未改写 catalog）

1. target-constitution-setup、target-runtime-setup、doc-sync-guardian、product-spec-builder、dev-planner、dev-builder、release-builder、requirements-test-designer、test-automation、ui-system-guardian、hotspot-governor、optimize、harden、rule-harvester、skill-builder、design-brief-builder、design-maker、critique、audit、code-review、bug-fixer、codebase-memory-scout、clarify、shape、beginner-flow-guide：许可证/写入边界证据充分、无第二控制面，可登记为 adapter-candidate 候选（仅候选，不进入 runtime；等待逐技能许可证映射与独立逻辑审查）。
2. evolution-engine、experience-elevator、feedback-writer：事件类技能，建议保持 event-only-source-only；如要转候选，必须先有宿主事件契约、事件去重/顺序/超时验证和独立审查，本轮不转。
3. architecture-foundation：已有 evidence/20260910-vibe-foundation-audit.md 结论（adapter-candidate 候选），本轮复核一致，不重复提升。

## 未验证项 / 阻塞项

- 独立 Luna 交叉审查不可用（宿主 503 × 2 轮），本证据只能记为逻辑审查 / review-unavailable，不得作为独立审计 PASS。
- 未验证真实宿主（Codex/Claude）如何发现和触发这些技能；未做 fresh-session smoke。
- 未逐项核对每个技能 references/templates/scripts 的第三方许可证（属 UI/legal 审计任务 20260910-vibe-ui-audit-* 范围）。
- 未改写 CANONICAL-CATALOG.json、LICENSE-MAP.json、OWNER-LEDGER.json。

## 下一步建议

1. 宿主恢复后以新任务标识重派独立 Luna 交叉审查；或由第二个主会话复读本证据关键 SHA/引用后记为逻辑审查完成。
2. UI/第三方许可证组审计（20260910-vibe-ui-audit-v4）出证据后，合并许可证台账，再由主 Agent 决定哪些技能登记 adapter-candidate 并同步 LICENSE-MAP.json。
3. 对建议候选组做宿主 adapter 行为 smoke 前，保持 source-only，不写入 runtime projection。
