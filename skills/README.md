# Skills

技能按工程、产品、UI 和 checker 分组。正式目录（本目录下的一等内容）**只接入已通过
`provenance/CANONICAL-CATALOG.json` 与运行时门禁的技能**；其余技能保留在 `sources/` 快照里。

「接受」（`readiness=accepted`）在本仓库意味着内容被**物理导入**到这里：投影门禁禁止把 `sources` 段
带进运行时 bundle，所以只改分类标签而不导入会被门禁如实拒绝。

**runtime 单位是目录**：`skills/<group>/<id>/` 下**整个导入目录**进入投影（含 `reference/`、`templates/`、
`scripts/` 与同级格式文件），而不只是 `SKILL.md`。文件清单在生成 catalog 时枚举并逐文件记录 sha256，
所以它仍是**显式白名单**而不是「目录里有什么就发什么」；新增文件必须先重新生成 catalog 并提交。
策略真源：`provenance/SKILL-CLASSIFICATION.json` 的 `runtimePromotionPolicy.bundlePolicy`。
目录内的 `agents/`（宿主编排与插件资产，如 `agents/openai.yaml`）**不**进入产物，被排除的路径记录在
catalog 的 `bundle.excluded` 里。

## 正式接入

清单**不在此手工维护**。当前 **52 条 runtime**（控制面 1 + Matt 13 + Vibe 38：checker 5 / product 14 /
ui 16 / event 3）的权威快照是生成物 `docs/CAPABILITY-INDEX.md`，真源是
`provenance/SKILL-CLASSIFICATION.json`（裁决只有这一个写入点）+ `CANONICAL-CATALOG.json`（由分类与清单再生）。

## 明确未接入

- 快照里**未被定编为 `accepted-*`** 的条目：`retired`（23 条，逐条理由与证据指针见
  `provenance/SKILL-CLASSIFICATION.json` 的 `reasonsById`；需要时可从 `sources/` 快照捞回）
  与 `excluded`/`compat`（上游 in-progress 或仅作兼容登记）。改分类只改 `SKILL-CLASSIFICATION.json`。
- Hook 相关资产：**纠错信号采集面已启用**（SessionStart 待消化提醒 + UserPromptSubmit 采集 +
  runner `-Mode Digest` 消化标记）；治理门禁事件（PreToolUse / PostToolUse / Stop）仍禁用归控制面。
  契约见 `adapters/vibe-hooks/contract.json`。

当前可用集合的权威快照是生成物 `docs/CAPABILITY-INDEX.md`；不要手工维护这里的清单。
