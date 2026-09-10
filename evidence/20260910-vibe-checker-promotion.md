# 首批 Vibe 技能物理导入 + 运行时门禁策略化（accepted）

日期：2026-09-10
关联任务包：tasks/20260910-vibe-checker-promotion.md（accepted）
上游结论来源：evidence/20260910-tool-batch-promotion.md（上一轮被门禁拦下的成批提升尝试）

## 一、本轮做了什么

上一轮验证出「接受 = 必须物理导入」这个结构前提，但只翻了分类标签，被三个门禁同时拒绝。
本轮把前提本身补齐，并按「一个有界能力组」接入首批 Vibe 技能。

**接入批次：impeccable 侧 bundled 只读检查器 4 个**（`audit`、`critique`、`harden`、`optimize`）。

| 步骤 | 落地物 |
|---|---|
| 1. 物理导入 | `scripts/import-vibe-skills.ps1`（新增，唯一导入路径）；内容 `sources/vibe-coding-skills/skills/<dir>/` → `skills/checker/<id>/`；派生来源台账 `provenance/VIBE-IMPORTS.json`（含逐文件 SHA-256、sourceCommit） |
| 2. 生成器路径规则 | `scripts/build-canonical-catalog.ps1`：Vibe 记录 `readiness=accepted` 时 path 改为 `skills/checker/<id>/SKILL.md`；并 fail-closed 要求 accepted 的 Vibe 记录必须声明 `sourceDir` 且等于上游目录名 |
| 3. NOTICE 门禁策略化 | `provenance/LICENSE-MAP.json` 新增逐族策略字段 `vibePerSkill.families[].runtimeEligible`（8 族全部显式声明）；`scripts/validate-release-notices.ps1` 读该字段，删除硬编码的「Vibe 条目必须 runtimeEligible=false」不变量 |
| 4. 分类真源 | `provenance/SKILL-CLASSIFICATION.json`：新增 `checker|accepted → accepted-checker` 策略行；`runtimePolicy.acceptedStatuses` 加入 `accepted-checker`；4 条记录改为 `domain=checker, readiness=accepted, writeAuthority=["none"], sourceDir=<上游目录>` |
| 5. 投影/包声明 | Codex/Claude 投影 manifest 的 `acceptedPrimitives`（硬编码 kind）改为 `accepted`（含 status）；`scripts/build-release-package.ps1` 删除「Vibe 不贡献 runtime 文件」的硬编码声明，改为按门禁报告派生 |
| 6. 新门禁 | `scripts/verify.ps1` 新增两条：① runtime include 内容与登记的 `sourceSha256` 一致；② 导入副本与快照逐文件一致（与 eol 无关） |
| 7. 文档同步 | `docs/CAPABILITY-INDEX.md`（重生成）、`README.md`、`docs/MIGRATION-PLAN.md`、`packaging/runtime-projection.json` |

结果：runtime 覆盖 **4 → 8**（Sliver control-plane + 3 Matt 原语 + 4 Vibe 检查器）；门禁 **10/10 PASS**。

## 二、为什么是这 4 个，而不是交接文档建议的 13 个

交接文档建议「审计记为只读 checker 的 13 个（`writeAuthority=none`）」。按**许可证证据**逐项复核后，
13 个里只有 4 个可以直接进入 runtime：

| 技能 | 许可证族 | 族级 runtimeEligible | 本轮处置 |
|---|---|---|---|
| `audit`、`critique`、`harden`、`optimize` | `impeccable-bundled-product-checker-overlap` | **true** | **接入** |
| `bug-fixer`、`codebase-memory-scout`、`design-brief-builder`、`design-maker`、`hotspot-governor`、`requirements-test-designer`、`test-automation`、`ui-system-guardian` | `vibe-original-product-checker` | false | 不接入 |
| `vibe-code-review` | `vibe-original-checker` | false | 不接入 |

排除理由是**许可证/来源**，不是待办：

- `vibe-original-*` 族的上游是 private 分发包（`package.json` `private: true`、`version: 0.0.0-private`），
  **未逐技能授予许可证文本**。`legal/ui-system-guardian/SOURCE-DECLARATION.md` 已有的判定是
  「在获得上游逐技能许可证声明或独立审查前保持 source-only」。
  仓库内的 SOURCE-DECLARATION 是**来源记录**，不是上游许可授予，因此不能当作可再分发的 NOTICE。
- 因此本轮把这个判定**写进数据**（`runtimeEligible: false` + reason），而不是继续留在代码里当例外。
  解除需要「上游逐技能许可证声明」或「独立法律审查」并同步改真源。

这样处置符合仓库规则「未通过来源、许可证、revision、调用类型和运行时门禁，不迁移技能内容」，
以及「不把任何第三方许可证归并为统一根许可证」。

## 三、门禁实测（含反例）

正向：`pwsh scripts/verify.ps1 -IncludePackage` = **10/10 PASS**（发布包 32 文件、0 违规）。

反例（都按预期拒绝，实测后已回退）：

| 反例 | 预期 | 实测 |
|---|---|---|
| 向 `skills/checker/audit/SKILL.md` 追加一行 | runtime 内容完整性失败 | `[FAIL] runtime include 内容完整性 — audit (sha 与登记不一致)` |
| 把 `impeccable-bundled-product-checker-overlap.runtimeEligible` 改为 false | NOTICE 门禁拒绝该族 | `[FAIL] 发布 NOTICE 门禁`（族级策略生效） |
| 重复运行导入脚本 | 拒绝覆盖 | `目标位置已存在，拒绝覆盖: skills/checker/audit` |
| 缺 `sourceDir` 的 accepted Vibe 记录 | 生成器 fail-closed | 已加校验（`accepted 的 Vibe 记录必须声明 sourceDir`） |

## 四、落地产物核对

- 一等副本：`skills/checker/{audit,harden,optimize}/SKILL.md`、`skills/checker/critique/{SKILL.md,reference/*.md}`（共 7 文件）。
- 派生来源：`provenance/VIBE-IMPORTS.json`（4 条，逐文件 SHA-256，`sourceRevision=635c54f9abb091c1293de346407663ad6af0862b`，
  该 revision 从 LICENSE-MAP 的 `families[].upstream` 读取，不在脚本里硬编码）。
- 投影 bundle（Codex 实测）：`skills/checker/<id>/SKILL.md` 4 条都在，且 `sources` 段不在 bundle 内。
- 发布包 NOTICE：4 条 Vibe 条目各带 2 个 notice（Apache-2.0 LICENSE + Anthropic frontend-design NOTICE）。

## 五、已知限制（不得当作已完成）

1. **投影契约是「每条记录一个已批准文件」**：`critique` 的 `reference/*.md`、以及既有 Matt 原语的
   `DEEPENING.md` / `ADR-FORMAT.md` / `agents/` 都**没有**进入 bundle。
   本轮的导入是目录完整的，但投影不是。让 runtime 单位变成「目录忠实」是一个独立的有界任务
   （改 catalog 记录形状 + 投影门禁 + manifest），本轮**没有**做，也不声称已做。
2. **这 4 个检查器依赖未接入的 `impeccable` 父技能**（SKILL.md 正文要求先 `Invoke /impeccable`）。
   即 bundle 里的检查器是**部分依赖闭包**，不是可独立完整运行的技能。
3. 宿主 **trust**、技能**行为正确性**、Hook 强制：全部仍 `UNVERIFIED`。本轮只提升静态投影覆盖，
   没有任何行为证据，也没有做 fresh-session smoke。
4. 没有做 `collect-host-skill-evidence.ps1` 重采：宿主证据直接复用 2026-09-10 快照
   （4 个技能均为 `model-visible`，安装于共享根）。

## 六、附带发现（超出本批范围，但影响仓库核心主张）

跑「fresh clone」对照时发现**既有门禁在全新 clone 上就是红的**，与本轮改动无关：

- `git clone` 到新目录（继承本机 `core.autocrlf=true`）后，`sources/**` 被 materialize 成 **CRLF**，
  而三个来源项目是 LF → `来源快照完整性` 报 **492 个文件 content-vs-source**；
- 根因：git 只保存规范化后的 LF blob，而 `PROVENANCE-INTEGRITY.json` 的 treeHash 与逐文件 sha
  是在**工作树的 CRLF 字节**上算出来的 → 基线不可跨 clone 复现。
- 本仓库**没有** `.gitattributes`（`attr/` 为空），因此换行行为完全由使用者本地配置决定。

这条对「逐字节一致的来源快照」这个核心主张是**真实的缺陷**，但修复面很大（需要 `.gitattributes -text`
+ 按来源字节重写已提交 blob，涉及 909 个快照文件 + 已导入副本）。
本轮**没有**修，已登记为独立任务：`tasks/20260910-line-ending-reproducibility.md`。

实测对照（同一提交，`git clone` 到新目录）：

| 门禁 | 本机工作树 | fresh clone | 说明 |
|---|---|---|---|
| `runtime include 内容完整性` | PASS (8) | **FAIL**（4 条 Vibe 记录 sha 与登记不一致） | 受 eol 影响 |
| `导入副本与快照一致性` | PASS (7) | **PASS (7)** | 刻意设计为与 eol 无关 |
| `来源快照完整性` | PASS | **FAIL**（vibe 快照 492 文件 content-vs-source） | 既有缺陷，HEAD 即可复现 |
| 两条静态投影 Build + Validate | PASS | PASS | 与本缺陷无关 |
| fresh clone 总计数 | 10/10 | **8/10** | 两个失败都源于同一个既有换行缺陷 |

结论：本批真正新增的「导入是否忠实」证据（`导入副本与快照一致性`）**跨机器成立**；
而 sha-vs-登记 类门禁的跨机器可复现性是被附带发现的那个既有缺陷掣肘，不是本批引入的新问题。
