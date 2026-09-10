# Vibe 第一批基础技能审计证据

## 结论

本轮审计对象为 `architecture-foundation`、`target-constitution-setup`、`target-runtime-setup`、`doc-sync-guardian`。四项均来自 `sources/vibe-coding-skills` 的快照，canonical catalog 当前记录为 `source-only-product-or-checker`、`user-invoked`、`writeAuthority: []`；本轮不把它们提升为 `accepted-primitive`，也不直接改写 canonical catalog。理由是 Vibe 来源在 `LICENSE-MAP.json` 中仍为 `mixed; per bundled skill` 且 `runtimeEligible: false`，尚未完成逐技能许可证与宿主适配行为验收。语义上四项均可作为后续 `adapter-candidate`，但当前保守状态保持不变。

## 逐项审计

| 技能 | provenance / 调用 | 写入目标与门禁 | 分类结论 |
|---|---|---|---|
| `architecture-foundation` | `sourceRevision: null`（快照非 git checkout）；`user-invoked`，frontmatter 同时禁止自然语言独立触发、禁止模型直调 | 读取目标项目 `.vibe-docs.json`、需求和按需代码证据；增量写入既有 `docs/项目治理/系统架构.md`，以 `PASS/BLOCKED` 作为 `dev-planner` / `dev-builder` 前置门；不应拥有 route/truth | `adapter-candidate`（待适配）；不接受为 primitive |
| `target-constitution-setup` | 同一 Vibe 快照；`user-invoked` 且只能由总入口指定路由 | 通过 `init-target-constitution.mjs` 生成/更新目标 `项目画像.md`、`宪法设计.md`、`.vibe-docs.json`、`文档索引.md`，再衔接 runtime；默认 dry-run，缺脚本停止，写后必须 check/guardrail | `adapter-candidate`（目标 truth 写入适配器）；不接受为 primitive |
| `target-runtime-setup` | 同一 Vibe 快照；`user-invoked` 且只能由总入口指定路由 | 唯一写入器为 `init-target-runtime.mjs`；追加/更新目标 `AGENTS.md`、`CLAUDE.md` managed block 和 `.vibe-runtime.json`；首次接入依赖 constitution 层，L0 anchor / checksum / sourceHash 漂移 fail closed | `adapter-candidate`（runtime overlay 适配器）；不接受为 primitive |
| `doc-sync-guardian` | 同一 Vibe 快照；`user-invoked` 且只能由总入口指定路由 | 面向代码、Skill、Hook、脚本、命令和工作流变更同步相关文档；应写目标项目既有文档真源并以 drift 检查收口，不得建立平行 truth | `adapter-candidate`（文档同步 checker/adapter）；不接受为 primitive |

## 治理与许可证证据

- `provenance/CANONICAL-CATALOG.json` 四条记录均为 `source-only-product-or-checker`、`writeAuthority: []`，未授权其直接拥有 Sliver route、target-truth 或 runtime projection。
- `provenance/SKILL-DECISIONS.md` 明确：Sliver 拥有项目级 route/operation/lens/truth；这四项只保留 Vibe 的目标项目工具实现，不能形成第二套项目 router 或平行真源。
- `provenance/OWNER-LEDGER.json` 将 `skill-catalog`、`target-truth`、`runtime-projection` 分别设为唯一 owner，并禁止 parallel truth authorities、manual generated mirror edits、untracked hook writers。
- `provenance/LICENSE-MAP.json` 将 Vibe 标记为 `mixed; per bundled skill`、`runtimeEligible: false`，原因是 bundled skill 的第三方许可证和 notices 尚未逐项复核；因此不能进入 accepted runtime projection。

## 未决风险

1. 来源导入记录 `sourceRevision: null` / `not-a-git-checkout`，只能证明快照 hash，不能证明上游 commit provenance；需维护者提供可核验 revision 后再做升级。
2. 四项尚无本仓库宿主 adapter、真实 target-truth 写入契约和 fresh-session 行为 smoke；仅凭 Skill 文本不能宣称 runtime 可用。
3. `doc-sync-guardian` 的具体写入器/检查器边界仍需逐项验证，特别是是否会越权更新非 canonical 文档。

## 验证记录

以下均为只读命令，退出码 `0`：

```powershell
git -C F:\skiils工具\feisheng-vibe-coding rev-parse HEAD
git -C F:\skiils工具\feisheng-vibe-coding status --short
Get-Content -Raw -Encoding UTF8 F:\skiils工具\feisheng-vibe-coding\provenance\CANONICAL-CATALOG.json
Get-Content -Raw -Encoding UTF8 F:\skiils工具\feisheng-vibe-coding\provenance\LICENSE-MAP.json
rg -n --encoding utf-8 "write|写入|PASS|BLOCKED|AGENTS|CLAUDE|\.vibe-docs|init-target" F:\skiils工具\feisheng-vibe-coding\sources\vibe-coding-skills\skills\architecture-foundation F:\skiils工具\feisheng-vibe-coding\sources\vibe-coding-skills\skills\target-constitution-setup F:\skiils工具\feisheng-vibe-coding\sources\vibe-coding-skills\skills\target-runtime-setup F:\skiils工具\feisheng-vibe-coding\sources\vibe-coding-skills\skills\doc-sync-guardian
```

实际未修改源项目，也未安装依赖；canonical catalog 保持原样，等待逐技能许可证、adapter 和行为 smoke 证据。
