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

工程原语（Matt，来源快照 `sources/mattpocock-skills`）：

- `engineering/diagnosing-bugs`
- `engineering/codebase-design`
- `engineering/domain-modeling`

只读检查器（Vibe，impeccable 侧 bundled，Apache-2.0；导入台账 `provenance/VIBE-IMPORTS.json`）：

- `checker/audit`
- `checker/critique`
- `checker/harden`
- `checker/optimize`

## 明确未接入

- `vibe-original-*` 族的 Vibe 技能（含 `bug-fixer`、`design-maker`、`requirements-test-designer`、
  `test-automation`、`ui-system-guardian`、`vibe-code-review` 等）：上游是 private 分发包，
  未逐技能授予许可证文本 → 许可证族 `runtimeEligible=false`，不得进入 runtime。
- `unreviewed` 技能（`clarify`、`shape`、`beginner-flow-guide`）：语义审查未完成。
- `code-review`、`tdd`（Matt）：命名问题已按「内容取已提交 revision、canonical id 由本仓库决定」解除，
  现在缺的是验收/行为证据，仍未进入正式目录。
- Hook 相关资产：仍全部禁用（见 `adapters/vibe-hooks/contract.json`）。

当前可用集合的权威快照是生成物 `docs/CAPABILITY-INDEX.md`；不要手工维护这里的清单。
