# 证据：能力定批评次（capability-finalization，批次 A + B）

- 日期：2026-09-11
- 任务包：`tasks/20260911-capability-finalization.md`
- 授权：owner 对 35 个未接入技能的第一性原理裁决批准（「把批次A和B全部完成收口」），并确认
  vibe-coding-skills 为本人开发、matt 的 4 个脏文件为本人随意改动（不保留）。

## 1. 裁决方法

两个只读子 Agent 逐一读取 35 个技能的 SKILL.md 全文（23 matt + 12 vibe），提取实质功能/触发/依赖/
与已接入 39 项的重叠/生态绑定度/内容质量；主 Agent 按「独特职能 × 控制面兼容 × 生态自含」三判据裁决。
完整裁决表与逐技能理由已固化在 `provenance/SKILL-CLASSIFICATION.json` 的 reasonsById（退役 22 条
逐条带证据指针与 retiredAt）。

## 2. 批次 A：接入 10 + 退役 22

### 接入（10）
- matt（快照目录逐文件 sha 对账后复制到 `skills/engineering/`）：grilling、prototype、research、
  resolving-merge-conflicts、setup-pre-commit、wizard、writing-for-agents（primitive→accepted-primitive）、
  handoff（新增 `user-tool|accepted → accepted-user-tool` 策略行 + acceptedStatuses 扩容）
- vibe（sourceDir + writeAuthority + import-vibe-skills）：design-maker（product）、
  clarify（domain unreviewed→checker，理由入 reasonsById）
- 结果：模型可见、可经控制面路由（绑定行见 §3）

### 退役（22，全部经 retire-capability.ps1，0 失败）
- primitive 3：git-guardrails-claude-code、migrate-to-shoehorn、scaffold-exercises
- adapter 7：implement、setup-matt-pocock-skills、to-spec、to-tickets、triage、wayfinder、improve-codebase-architecture
- user-tool 5：grill-me、grill-with-docs、teach、to-questionnaire、wait-what
- product-or-checker 4：skill-builder、target-constitution-setup、target-runtime-setup、codebase-memory-scout
- unreviewed 2：beginner-flow-guide、shape
- checker 1：vibe-code-review
- 新增 6 条 `<domain>|retired` 策略行 + reasonsByStatus 文案（fail-closed：无策略行工具即拒）

## 3. 路由绑定与 vendored 补丁

- `engineering-execution.md` Internal Capability Providers 表追加 13 行（event 三件套标注
  explicit-invocation-only）；git diff 13 insertions 0 deletions（保真树换行纪律）
- `LOCAL-PATCHES.json` patchedSha256 更新（f18b9479… → 5255fe09…），linesChanged 55→68
- `record-provenance-integrity.ps1` 重录基线通过（含已登记补丁核验）

## 4. 批次 B：事件三件套轻量接入

- 策略：`event|accepted → accepted-event` + acceptedStatuses 扩容；LICENSE-MAP `vibe-event-only`
  runtimeEligible true（owner 授权）+ `legal/vibe-event-only/SOURCE-DECLARATION.md`（owner 作者确认）
- 导入：import 脚本新增 event 分组（fail-closed 缺省 throw），三件套落地 `skills/event/<id>/`
- **诚实边界（写入每个技能的 RUNTIME-NOTES.md）**：`tools/*.mjs` 自动化层与 `.vibe-docs.json`
  目标项目治理基础设施**不随批**（其写入者与控制面冲突的 target-*-setup 已退役）；正文引用缺失脚本时
  必须如实报告；运行形态 = 采集 → PENDING 提醒 → 显式调用技能按方法学处理 → `-Mode Digest` 标记
- 契约 `enablementScope` 更新：consumptionSkillsAdmitted=true（lightweight；auto-trigger wiring pending）；
  SKILL-DECISIONS.md event-only 条目同步

## 5. 机制修复（实施中踩坑）

- `build-canonical-catalog.ps1`：event 分组映射缺失（与 import 脚本同构 fail-closed）；
  **RepoRoot 相对路径会让显式 bundle 枚举的前缀裁剪错位**（本批实测：`-RepoRoot .` 产生
  「显式 bundle 里没有记录指向的文件」假错误）→ 已加 `GetFullPath` 归一（建议进踩坑清单）
- 分类真源批量变异的一次性脚本两处自查修复（global 声明顺序、reasonsById 缩进退化），JSON 全程校验

## 6. 终态数字（全部机器对账）

| 项 | 值 | 证据 |
|---|---|---|
| 分类 | 82 = **52 runtime** + **23 retired** + 7 excluded/compat | SKILL-CLASSIFICATION readiness 计数 |
| runtime 构成 | 控制面 1 + matt 13 + vibe 38（checker 5 / product 14 / ui 16 / event 3） | CANONICAL-CATALOG |
| runtime 文件 | **422**（投影安装 manifest fileCount=422，validated，sourceRevision 本批提交） | 安装输出 |
| 宿主证据 | model-visible=**52**（全部经统一包）、legacy 暴露=0、not-installed=30（22+6+1+1 本就不迁移面） | HOST-DISCOVERY-EVIDENCE 重采 |
| 共享根 | 176 → **112**（三源链接 64 全部退役：29 D1 批 + 35 本批；回滚记录 _smoke/retire-{29,35}-rollback.json） | audit 快照 after |
| 门禁 | `verify -IncludeHostEvidence -IncludePackage` = **14/14**；发布包 858 文件 | 本文件 §7 |

## 7. 门禁输出（节选）

```
[PASS] catalog 与 SKILL-CLASSIFICATION.json 同步
[PASS] runtime include 内容完整性 — files = 422
[PASS] 导入副本与快照一致性 / 保真树换行 / 索引新鲜度
[PASS] 来源快照完整性 / 路由绑定（admitted=51 bound=51）/ NOTICE 门禁
[PASS] Vibe Hook 适配器安全契约 / 宿主证据门（admitted=52）
[PASS] Codex / Claude / 宿主中性投影 Build + Validate / 发布候选包装配（858）
verify: 14/14 steps passed
```

## 8. UNVERIFIED 边界（不变）

52 个新接入能力与既有 38 个一样：**逐技能行为质量 = 用一次验一次**；事件三件套的
tools 自动化层与自动触发链未接入；宿主 trust、Hook fresh-session 冒烟、发布 CI 实跑维持 UNVERIFIED。
