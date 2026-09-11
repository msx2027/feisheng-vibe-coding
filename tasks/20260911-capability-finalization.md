# 任务包：能力定编批次（capability-finalization，批次 A + B 一次收口）

- 日期：2026-09-11
- 授权：owner 对 35 个未接入技能的第一性原理裁决批准（「把批次A和B全部完成收口」）
- 裁决基础：两批内容分析子 Agent 逐技能提取正文/依赖/重叠后的主 Agent 裁决（见
  `evidence/20260911-capability-finalization.md` §1 完整裁决表）

## Goal

把 82 条分类收敛到终态：**52 admitted（39+13）/ 23 retired（1+22）/ 7 excluded|compatibility**，
宿主只剩统一包 + 35 个现役服务链接的格局不变；为源项目归档（终态路线第 3 步）扫清能力面。

## 批次 A：接入 10 + 退役 22（一次有界迁移）

### 接入（10）
- matt（8，复制快照目录到 `skills/engineering/<id>/` + readiness→accepted + writeAuthority）：
  grilling, prototype, research, resolving-merge-conflicts, setup-pre-commit, wizard,
  writing-for-agents, handoff（handoff 需新增 `user-tool|accepted → accepted-user-tool` 策略行并加入
  runtimePolicy.acceptedStatuses）
- vibe（2，classification 加 sourceDir/writeAuthority 后走 import-vibe-skills.ps1）：
  design-maker（product）、clarify（domain unreviewed→checker + accepted，语义审查随本批内容评审完成，
  理由入 reasonsById）

### 退役（22，经 retire-capability.ps1 逐个执行，含二梯队默认退役 2 个）
- primitive(3)：git-guardrails-claude-code, migrate-to-shoehorn, scaffold-exercises
- adapter(7)：implement, setup-matt-pocock-skills, to-spec, to-tickets, triage, wayfinder, improve-codebase-architecture
- user-tool(5)：grill-me, grill-with-docs, teach, to-questionnaire, wait-what
- product-or-checker(4)：skill-builder, target-constitution-setup, target-runtime-setup, codebase-memory-scout
- unreviewed(2)：beginner-flow-guide, shape
- checker(1)：vibe-code-review
- 需新增策略行：primitive|retired, adapter|retired, user-tool|retired, product-or-checker|retired,
  unreviewed|retired, checker|retired（+ reasonsByStatus 文案）

## 批次 B：事件三件套接入（轻量形态收口）

- experience-elevator / evolution-engine / feedback-writer：`event|accepted → accepted-event` 策略行 +
  runtimePolicy.acceptedStatuses + LICENSE-MAP vibe-event-only 族 runtimeEligible true（owner 授权）+
  sourceDir/writeAuthority + 导入到 `skills/event/<id>/`（import 脚本新增 event 分组映射）
- **诚实边界**：skills 正文引用的 `tools/*.mjs` 自动化层与 `.vibe-docs.json` 目标项目治理基础设施**不随批接入**
  （与控制面写入者冲突的 target-*-setup 已退役）；每个技能目录附 `RUNTIME-NOTES.md` 说明轻量运行形态
  （AI 按 SKILL.md 方法学直接维护经验台账；tools 留在快照待基础设施批次）；契约 enablementScope 更新为
  「消费技能已接入（轻量形态），自动触发链待后续」

## 路由绑定

13 个新 admitted 全部在 `engineering-execution.md` 的 Internal Capability Providers 表加条件行
（event 三件套标注 explicit-invocation-only）→ LOCAL-PATCHES patchedSha256 更新 → record-provenance-integrity。

## 验收门

1. `verify.ps1 -IncludeHostEvidence -IncludePackage` 全绿 + fresh clone 复验
2. CAPABILITY-INDEX 统计 = 52 可用 / 23 已退役 / 82 总量对账
3. 宿主证据重采：52 条 admitted 全部经统一包 model-visible
4. README / HANDOFF-NEXT / SKILL-DECISIONS 口径同步
