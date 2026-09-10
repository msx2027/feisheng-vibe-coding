# Feisheng Vibe Coding 交接文档

更新时间：2026-09-10（第三轮：分类数据化 + 能力索引 + 单入口验证 + 写权限门禁）

## 总目标

把三个来源重构为一个可维护、可审计的统一仓库 `F:\skiils工具\feisheng-vibe-coding`：

- `F:\skiils工具\sliver-vibe-coding`
- `F:\skiils工具\vibe-coding-skills`
- `F:\skiils工具\mattpocock-skills`

统一仓库必须以 Sliver 为唯一项目级控制面，按来源追溯（provenance）、许可证、调用类型和运行时边界
逐项处理 Vibe 与 Matt 技能；不能只是把三包并排复制。三个来源仓库必须保持不被修改；证据不足时保持
source-only、blocked 或回滚，不能因为「看起来可用」就接入。

## 当前基线

- 仓库：`F:\skiils工具\feisheng-vibe-coding`，分支 `main`
- 基线：第二轮 / 第三轮提交序列（递增）：
  - `5f7d60d` feat: add claude runtime projection, shared guard, and release notice gate
  - `399adc8` feat: merge vibe per-skill license ledger and close font/source gaps
  - `c257ac0` audit: cross-verify vibe groups (v5) and record adapter-candidate decision
  - `50aca5b` feat: add release package builder, release-gate CI, and normalize script encoding
  - `b58946f` docs: refresh continuation handoff after G1-G4
  - `907e4c7` docs: record committed baseline and post-commit gate verification
  - `fd15146` refactor: make skill classification data-driven, add capability index and verify entrypoint
  - （第三轮后续提交见 `git log`；当前 HEAD 以 `git -C 'F:\skiils工具\feisheng-vibe-coding' log -1 --oneline` 为准）
- 工作树：干净（每轮完成后已提交）。
- 完整性核对（提交后）：catalog 82 条记录中 78 条可寻址且 SHA-256 全部一致；4 条 Matt 记录
  （`ask-matt`、`code-review`、`implement`、`tdd`）的 SKILL.md 按 `tasks/20260910-matt-clean-snapshot.md`
  的既有策略未进入快照（4 个未提交文件不导入），非漂移。

## 已确认的架构决策（不变）

1. **Sliver 是唯一项目级控制面和主路由。** 不能出现第二个项目入口、第二个 route catalog、第二个 target truth 或第二个 runtime writer。
2. **Matt 仅提供工程原语。** 已接入的原语不能拥有项目路由、target truth 或 Hook 写入权。
3. **Vibe 是产品/UI/checker/宿主适配候选。** 许可证或宿主行为没有逐项证明前，保持 source-only。
4. **运行时只读取 canonical catalog。** `provenance/CANONICAL-CATALOG.json` 是唯一技能决策真源（由 `scripts/build-canonical-catalog.ps1` 生成）；`provenance/SKILL-INVENTORY.json` 只是来源事实快照。
5. **Hook 必须只有一个 runner。** Vibe Hook 适配器默认禁用，不得执行来源 Hook，不得安装到真实 Codex/Claude 目录。
6. **不能伪称真实新 Codex 对话/归档。** 只证明了逻辑隔离的子 Agent、任务包和证据回写。
7. **分类是数据，不是代码。** 技能分类唯一真源是 `provenance/SKILL-CLASSIFICATION.json`（`domain` × `readiness` → `statusPolicy` → `status`）；`CANONICAL-CATALOG.json` 是生成物。改分类 = 改数据后重生成，不得改生成器数组或手工编辑 catalog。
8. **门禁只有一个实现。** Codex/Claude 投影共用 `scripts/runtime-projection-guard.ps1`；禁止平行门禁实现（本轮曾发现并修掉 Codex 侧的重复实现）。门禁从 `decisionPolicy` 读策略，不硬编码状态字面量。
9. **canonical 命名由本仓库决定。** 上游的未提交工作树改动只作为**事实记录**，不采用、也不等待上游确认。不采用工作树内容是因为其意图不可证，而不是因为命名冲突；命名与「是否采用未提交内容」是两件不同的事。
10. **快照内容必须是可证明的来源。** 优先取来源工作树；当工作树存在未提交改动时，取**已提交 revision 的 blob**（按已实测的换行归一化模型写入），并在导入记录里逐条登记。不得直接丢弃——丢弃会造成记录指向不存在的文件。
11. **本仓库自持，不再依靠任何上游。** owner 于 2026-09-10 明确：`feisheng-vibe-coding` 自此由 owner 自行维护，
   不再等待任何上游确认，也不产出上游问题报告。上游差异（如未提交的工作树改动）只作**事实记录 + 周期复核项**，不构成阻塞。
   - **待定影响（需 owner 决定，本轮未改）**：自持后我们**有权**修改 vendored 内容（例如 Sliver 的 3 个模板资产
     在 Claude Code 下会触发 YAML frontmatter 解析告警）。但那样会打破与来源的字节一致性，使 provenance 模型需要升级为
     「vendor + 本地补丁偏差登记」。本轮**未**修改任何 vendored 内容；现有 provenance 门禁（字节一致 + 树摘要）保持不变。

## 第二轮完成情况（G1–G4）

| 目标 | 结论 | 证据/入口 |
|---|---|---|
| **G1 Vibe 许可证台账合并 + 缺口补齐** | `LICENSE-MAP.json` 新增 `vibePerSkill`（8 族覆盖 46/46 Vibe 技能）；ui-styling 6 个字体（IBMPlexSerif ×4、InstrumentSerif ×2）OFL-1.1 文本补齐并记录上游 revision；ui-system-guardian 补来源声明 | `legal/fonts/NOTICE.md`、`legal/ui-system-guardian/SOURCE-DECLARATION.md`、`evidence/20260910-vibe-license-ledger-merge.md` |
| **G2 独立交叉审计（v5）** | 宿主恢复后以 v5 新标识重派；产品组 29/29 SHA 一致、29/29 frontmatter 合规、控制面关键字 0 命中；UI 组 16/16 SHA 一致、字体缺口已补、来源声明核对一致 | `evidence/20260910-vibe-product-audit-v5.md`、`evidence/20260910-vibe-ui-audit-v5.md` |
| **G2b adapter-candidate 登记决策** | **决定：暂不登记**（宿主发现/信任/行为证据缺失，按 AGENTS.md「宿主证据缺失时停止迁移」）；解除条件已列明 | `evidence/20260910-vibe-independent-audit-v5-and-decision.md` |
| **G3 Matt 四项阻塞复核** | 上游无新提交、无开放 PR、无维护者确认；工作树仍半改名不一致 → 四项维持 blocked/原状态 | `evidence/20260910-matt-blocked-followup-g3.md` |
| **G4 发布包装配 + 门禁 CI 接入** | 新增发布包装配器（门禁前置 fail closed、NOTICE.txt、RELEASE-MANIFEST.json、zip）；新增 CI 工作流；修正 6 个脚本 BOM 使其在 Windows PowerShell 5.1 可用 | `scripts/build-release-package.ps1`、`.github/workflows/release-gate.yml`、`evidence/20260910-release-package-and-ci.md` |

### 本轮关键更正（独立审计发现）

UI 组本地证据把范围写成「17 个 UI 技能」，但 catalog 中 `status=source-only-ui` 实际为 **16 项**
（差异项 `ui-system-guardian` 实际状态是 `source-only-product-or-checker`）。已在
`evidence/20260910-vibe-ui-audit-local.md` 顶部追加 v5 更正说明；`LICENSE-MAP.json` 归类与 catalog 一致。

### 本轮关键限制（写入 RELEASE-MANIFEST）

`ConvertTo-Json` 在 Windows PowerShell 5.1 与 PowerShell 7 下输出格式不同，语义相同但字节不同，
导致 `manifestSha256` 不同。**以 PowerShell 7 (pwsh) 为唯一规范化 release 构建运行时**；
5.1 可运行同一套门禁与投影，交叉版本不可字节复现。

## 第三轮完成情况（分类数据化 ①②③④）

| 目标 | 结论 | 证据/入口 |
|---|---|---|
| **③ 分类数据化** | 新增 `provenance/SKILL-CLASSIFICATION.json`（真源）；`build-canonical-catalog.ps1` 改为纯派生 + fail-closed 校验；**等价性证明：82/82 条既有字段逐字段一致**（该比对抓到并修掉 accepted 原语 path 重映射回归） | `evidence/20260910-classification-data-driven-and-index.md` |
| **门禁读策略** | `runtime-projection-guard.ps1` / `validate-release-notices.ps1` 改读 `decisionPolicy`，不再硬编码 `'control-plane'` / `'accepted-primitive'` | 同上 |
| **① 能力索引** | 新增 `scripts/build-capability-index.ps1` + 生成物 `docs/CAPABILITY-INDEX.md`（可用 4 / 待启用 7 / 来源专用 61 / 阻塞 2 / 兼容排除 8，逐项带原因；含 `writeAuthority` 列） | `docs/CAPABILITY-INDEX.md` |
| **② 单入口验证** | 新增 `scripts/verify.ps1`：6 项门禁 + 生成物新鲜度（catalog 同步、索引新鲜度），退出码 0/1；反例实测返回 1 | `scripts/verify.ps1` |
| **④ 写权限门禁** | `writeAuthority` 从空占位变为**强制执行**：runtime include 必须声明（规则 A）；控制面 token 必须由排他 owner 声明（规则 B，防重复写入者）；词表 9 个 token | `evidence/20260910-write-authority-gate.md` |
| **④ 附带：门禁实现收敛** | 发现 `build-codex-runtime-projection.ps1` **自带平行门禁实现**（使新门禁对 Codex 静默失效）；已收敛到共享门禁，并证明 Codex 产物**逐文件 SHA 一致** | 同上 |

### 第三轮关键更正

`evidence/20260910-claude-projection-smoke.md` 的「Codex/Claude 共用门禁」在抽取当时**只对 Claude 成立**；
Codex 侧当时仍是平行实现。已在两处补记更正，并在本轮完成收敛（含等价性证明）。

### 第三轮关键含义（对“提升”的影响）

「提升一个技能」现在是**一次数据编辑**：改 `SKILL-CLASSIFICATION.json` 里该技能的 `readiness`
（`candidate` 策略行已覆盖常见域）→ 重生成 catalog + 索引 → 跑 `scripts/verify.ps1`。
「提升为 runtime（accepted）」仍只对 `primitive` 域开放策略行，且还需同时打开其来源的
`LICENSE-MAP.runtimeEligible`（第二道独立闸门）——**故意保持 fail-closed**。

## 第四轮完成情况：来源快照完整性门禁

| 目标 | 结论 | 证据/入口 |
|---|---|---|
| 把「快照未篡改 / 与来源一致」从一次性结论变成**每次运行强制** | 新增共享模块 `scripts/provenance-integrity.ps1`（自证树摘要 + 来源逐字节交叉校验）与基线记录器 `scripts/record-provenance-integrity.ps1`（fail-closed，必须被来源背书才写基线）；`verify.ps1` 新增「来源快照完整性」步骤 | `evidence/20260910-provenance-integrity-gate.md` |

- 基线（写入 `provenance/PROVENANCE-INTEGRITY.json`）：Vibe 550 / Matt 132 / Sliver 223 个文件的树摘要；记录时 **754 个文件逐字节经来源校验**。
- 反例已验证：篡改任一快照文件 → `verify.ps1` 失败并**指名漂移路径**；同一状态下记录器拒绝写基线。
- 跨版本：树摘要在 pwsh 7 记录、Windows PowerShell 5.1 重算一致（两侧 `verify.ps1` 均 7/7）。
- **含义：「禁止手工修改快照」从自律变成了强制。** 修改 `sources/` 或 `governance/sliver-core/` 下任何字节都会使 `verify.ps1` 失败。

## 第五轮完成情况：Matt 四项解除阻塞（命名归一化 + 采纳已提交内容）

| 目标 | 结论 | 证据/入口 |
|---|---|---|
| 解除 Matt 四项因「上游未提交改名」而 blocked | 命名由本仓库决定（新增 `canonicalNamingPolicy`），内容改取**已提交 revision** 的 blob（字节安全导出 + 已实测的 LF→CRLF 归一化）；工作树未提交改动仅作事实记录 | `evidence/20260910-matt-canonical-naming.md` |
| 修掉暴露的数据缺陷 | 原导入器把工作树已改动的 4 个文件**删除**，导致 4 条 catalog 记录指向不存在的文件；现快照 132 → **136**，82 条记录 0 缺失、0 哈希不符 | 同上 |
| 连带保持一致 | inventory 对 revision 来源路径改从快照读取（否则 id 会漂到上游脏名）；provenance 新增 `revisionSourcedPaths`；删除投影门禁里硬编码的 blocked 名单 | 同上 |

**结果：`blocked` 记录数 = 0。** `tdd` → `source-only-primitive`、`code-review` → `source-only-checker`。
上游那个未提交改名仍记录在 `reasonsById` 里（作为事实，不再是 blocking 理由）。若上游日后**提交**该改名，
那是一次**有意的重新导入**事件，不是阻塞。

## 第六轮完成情况：Claude Code 真实宿主 smoke（发现性已验证）

用户授权一次真实宿主安装 + smoke。结论精确如下：

| 事项 | 结果 |
|---|---|
| **fresh-session discovery**（Claude Code 是否发现并注册该技能） | ✅ **VERIFIED**：A/B 全新会话 **169（装）vs 168（移出）**，delta=1；Claude Code 2.1.266；加载根 `user=~/.claude/skills` |
| 安装方式 | 仅用 Sliver 自带 `build_runtime_bundle.py` 按 `runtime-manifest.json` 白名单产出（76 文件），装到文档指定 install root，**只新增不覆盖**，可一键回滚 |
| `validate_runtime_bundle` 深度校验 | ❌ **UNAVAILABLE**：需受信任基线 git 对象 `29695fe0…`，本地源仓库（非浅克隆）不含该对象 |
| 宿主 trust / 技能行为 / Hook 强制 | ⏳ 仍 `UNVERIFIED`（未越界声明） |

证据：`evidence/20260910-host-smoke-claude-discovery.md`；复现脚本：`scripts/smoke-claude-skill-discovery.ps1`（`-Install` / `-Probe` / `-Uninstall`，**不**接入 `verify.ps1`，因为会消耗真实额度）。

### 本轮两个新发现

1. **深度校验缺受信任基线对象**（阻塞 `validate_runtime_bundle`）：需通过授权方式让 `29695fe0…` 对象可用
   （对来源仓库 `git fetch` 会写入来源 `.git`，属修改来源项目，本轮未做）。
2. **bundle 内 3 个上游模板资产在 Claude Code 触发 YAML frontmatter 解析失败**
   （`assets/project-audit/audit-report.md`、`assets/project-decision/adr.md`、`assets/project-feature/feature-truth.md`）。
   它们是 Sliver 上游内容且与来源逐字节一致 —— **不得为消错而修改**，应作为上游发现上报。

## 第七轮完成情况：深度校验解锁 + Codex 发现性验证

用户授权：① 一次 `git fetch`（解锁深度校验）；② Codex 侧 smoke。同时确立新原则：**本仓库自持，不再依靠任何上游**。

| 事项 | 结果 |
|---|---|
| ① 受信任基线对象 | ✅ 常规 fetch / `--tags` 都取不到（不在任何分支/标签历史），**按 SHA 直连 fetch 成功**（只写来源 `.git`，工作树未动） |
| ① 深度校验 | ✅ **claude-code 76 文件 PASS、codex 78 文件 PASS**（`validate_runtime_bundle --trusted-base-root`） |
| ② Codex discovery | ✅ **VERIFIED**：`codex debug prompt-input` A/B — available skills **204 vs 203**，且该技能**新获自己的根 `r0`（`~/.codex/skills`）** |

证据：`evidence/20260910-host-smoke-codex-and-bundle-validation.md`；双宿主可复现脚本：`scripts/smoke-host-skill-discovery.ps1`。

### 本轮三个带设计含义的发现

1. **一次安装服务两个宿主**：`~/.claude/skills` 与 `F:\skiils工具\_adapters\shared\skills` 是同一目录（junction），
   而 Codex 把它当自己的技能根 `r1`。因此本轮**移除了冗余的 Codex 专属安装**，避免重复注册。
2. **Codex 的真实入口是仓库根 `AGENTS.md`**（模型可见输入里会被注入为 instructions），
   而我们的 **Codex 投影并未包含 `AGENTS.md`** → 已记为待补缺口。
3. **调 Sliver 的 Python 工具必须带 `-B`**：否则在快照里生成 `__pycache__`，会被我们自己的 provenance 门禁拦下（实测过）。

### 宿主安装与脚手架约定（owner 要求）

- 安装状态：`~/.claude/skills/sliver-vibe-coding` 已装（76 文件，共享根，两宿主可见）；Codex 专属根已卸载；
  回滚：`Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\skills\sliver-vibe-coding"`。
- 所有测试脚手架放在 **`<repo>/_smoke/`**（已 gitignore），**总目标完成后统一清理**；不得污染其它 Claude/Codex 配置与既有技能。
- 宿主安装只经 Sliver 自带 `build_runtime_bundle.py` + `runtime-manifest.json` 白名单；不得自造安装集。

## 当前技能状态（CANONICAL-CATALOG.json）

- `control-plane`：1（sliver-vibe-coding）
- `accepted-primitive`：3（diagnosing-bugs、codebase-design、domain-modeling）
- `adapter-candidate`：7（Matt）
- `blocked-unclassified-working-tree`：**0**（此前 code-review、tdd，已按上述策略解除）
- Vibe：`source-only-ui` 16、`source-only-product-or-checker` 22、`source-only-unreviewed` 3、
  `event-only-source-only` 3、`source-only-checker` 1、`compatibility-alias` 1

第三轮新增派生字段：每条记录带 `domain` / `readiness` / `reason`；`decisionPolicy` 新增
`controlPlaneStatus` 与 `writeAuthorityPolicy`。分类状态值**未改变**（等价性已证明）。

关键含义：**只有 3 个 Matt 原语进入候选 Codex/Claude 静态投影。所有 Vibe 技能、Vibe Hook 都没有进入运行时。**

人类可读视图：`docs/CAPABILITY-INDEX.md`（生成物）。

## 未完成的工作

### P0-A（剩余）：adapter-candidate 登记

前置条件已完成（逐技能许可证映射、字体缺口、ui-system-guardian 来源声明、独立交叉审查、无第二入口）。
第三轮后**提升本身已降为一次数据编辑**（见上「第三轮关键含义」），但仍被以下条件阻断：

1. 真实宿主（Codex/Claude）discovery / trust / fresh-session smoke 缺失；
2. 或需要 owner 在 `provenance/OWNER-LEDGER.json` 显式授权「仅分类登记、不进入运行时」的有界迁移。

解除后：改 `provenance/SKILL-CLASSIFICATION.json` 的 `readiness` → 重生成 catalog 与索引 → 跑 `scripts/verify.ps1`。
**不得手工编辑 `CANONICAL-CATALOG.json` 或 `docs/CAPABILITY-INDEX.md`（都是生成物）。**

### P0-B：Matt 四项（已解除阻塞，转为周期性复核）

**已解决。** 命名由本仓库决定；内容取自已提交 revision `9fe7e7a3`（工作树未提交的改名不采用、也不等待确认）。
快照新增 4 个文件（132 → 136），`tdd`、`code-review` 已解除阻塞，4 条记录的断链也已修复。

仍需周期复核（**不阻塞任何技能**）：上游若日后提交该改名，本仓库应对照复核并决定是否有意重新导入；
上游 HEAD 保持 `9fe7e7a3`、0 开放 PR（截至本轮）。

### P1：宿主投影与发布能力

1. **真实宿主 smoke**：Claude 与 Codex 的 **discovery 均已验证**；两侧的 trust、技能行为、Hook 强制仍未验证；
   我们自己的 Codex 投影（缺 `AGENTS.md`）尚未做其自身的 discovery smoke。不得写入更多真实宿主目录，除非另有授权与回滚方案。
2. **发布包已可装配，CI 未真实运行**：`scripts/build-release-package.ps1` 本地两套 PowerShell 均验证通过（19 文件、0 违规、包内投影 Validate 通过）；`.github/workflows/release-gate.yml` 仅本地 YAML 校验，未在真实 runner 执行。
3. **Hook 未解锁**：需要 per-skill license、host discovery、事件顺序/并发、写白名单/回滚和独立逻辑审查全部通过。

## 当前阻塞项

- **宿主 trust / 技能行为 / Hook 强制**：仍 `UNVERIFIED`（两宿主 discovery 已闭环）。
- **Codex 投影缺 `AGENTS.md`**：与宿主真实入口机制不匹配，待补。
- **宿主稳定性**：v5 派发时 `luna_vibe_product_audit_v5` 首次被中断、`v5b` 遇 `Upstream request failed`，
  第三次 `v5c` 成功；重派时需接受可能的中断，只采纳有回执的轮次。

## 本轮子 Agent 状态

- `luna_vibe_product_audit_v5`：被中断，无产出（不计入）。
- `luna_vibe_product_audit_v5b`：宿主 `Upstream request failed`（不计入）。
- `luna_vibe_product_audit_v5c`：成功回执（采纳）。
- `luna_vibe_ui_audit_v5`：成功回执（采纳）。

历史轮次（v3/v4、health check 等）仍无回执，不得补标 accepted。

## 建议的接手顺序

1. 读取本文件、`AGENTS.md`、`docs/AGENT-ORCHESTRATION.md`、`provenance/SKILL-CLASSIFICATION.json`、
   `provenance/CANONICAL-CATALOG.json`、`docs/CAPABILITY-INDEX.md`、`provenance/LICENSE-MAP.json`、
   `evidence/20260910-vibe-independent-audit-v5-and-decision.md`。
2. `git status --short` 与 `git log -1 --oneline` 确认基线；不要重置或回退任何已有提交。
3. 先跑 `pwsh scripts/verify.ps1` 确认基线可复现。
4. 若先做分类推进：取得 owner 显式授权后，改 `provenance/SKILL-CLASSIFICATION.json` 的 `readiness`，
   重生成 catalog 与索引，再跑 `verify.ps1`（提升已降为数据编辑）；否则优先推进真实宿主授权安装与 fresh-session smoke。
5. 在真实 GitHub runner 上验证 `.github/workflows/release-gate.yml`；如需可加发布流水线（仍不得声明发布授权）。
6. 跟踪 Matt 上游提交/PR/维护者确认，满足条件后再复评四项状态。
7. Hook 解锁按 P1 第 3 条逐门禁推进。

## 常用验证命令

```powershell
# 目标仓库状态
git -C 'F:\skiils工具\feisheng-vibe-coding' status --short
git -C 'F:\skiils工具\feisheng-vibe-coding' log -1 --oneline

# 一键全套门禁 + 生成物新鲜度（推荐入口；加 -IncludePackage 则一并装配发布包）
pwsh -NoProfile -File 'F:\skiils工具\feisheng-vibe-coding\scripts\verify.ps1' `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'

# 改分类后重生成（顺序不能反）
pwsh -NoProfile -File 'F:\skiils工具\feisheng-vibe-coding\scripts\build-canonical-catalog.ps1' `
  -RepoRoot 'F:\skiils工具\feisheng-vibe-coding'
pwsh -NoProfile -File 'F:\skiils工具\feisheng-vibe-coding\scripts\build-capability-index.ps1' `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'

# 仅在「故意重新导入来源快照」后重记 provenance 基线（fail-closed；源不可用时拒绝）
pwsh -NoProfile -File 'F:\skiils工具\feisheng-vibe-coding\scripts\record-provenance-integrity.ps1' `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'

# 建议使用 PowerShell 7 (pwsh)；Windows PowerShell 5.1 亦可运行（manifest 字节不同）
# Hook 默认禁用行为
& 'F:\skiils工具\feisheng-vibe-coding\tests\test-vibe-hook-adapter.ps1' `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'

# Codex 静态投影（OutputRoot 必须是不存在的新目录，且不能在仓库内）
& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-codex-runtime-projection.ps1' `
  -Mode Build -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -OutputRoot 'C:\Users\MSX\AppData\Local\Temp\<新临时目录>'

# Claude 静态投影
& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-claude-runtime-projection.ps1' `
  -Mode Build -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -OutputRoot 'C:\Users\MSX\AppData\Local\Temp\<新临时目录>'

# 发布 NOTICE 静态门禁
& 'F:\skiils工具\feisheng-vibe-coding\scripts\validate-release-notices.ps1' `
  -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'

# 发布候选包装配（PackageRoot 必须不存在且不在仓库内；zip 生成在 PackageRoot 的父目录）
& 'F:\skiils工具\feisheng-vibe-coding\scripts\build-release-package.ps1' `
  -TargetHost Both -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding' `
  -PackageRoot 'C:\Users\MSX\AppData\Local\Temp\<新临时目录>' -Label 'candidate'
```

## 不可突破的边界

- 不安装新依赖，除非先证明现有能力不够并取得用户明确同意。
- 不修改三个来源项目。
- 不把 Vibe `.claude/`、`.agents/`、`.codex/` 镜像当成正式来源或运行时内容。
- 不把混合第三方许可证合并成一个根许可证。
- 不手工编辑 `CANONICAL-CATALOG.json`（生成产物）或生成镜像。
- 不手工改动 `sources/` 与 `governance/sliver-core/` 任何字节；完整性由 provenance gate 强制，篡改即验证失败。
- 不把技能分类写进生成器代码或第二个文件；分类唯一真源是 `provenance/SKILL-CLASSIFICATION.json`。
- 不为 Codex/Claude 各写一套投影门禁；两侧必须点源 `scripts/runtime-projection-guard.ps1`。
- 不新增第二份 provenance 校验实现；记录器与验证器必须点源 `scripts/provenance-integrity.ps1`。
- 不采用上游未提交的工作树内容（意图不可证）；命名由本仓库决定，不等上游确认。
- 不直接丢弃来源文件：工作树已改动时取已提交 revision 的 blob 并登记，保留可寻址性。
- 宿主安装只经 Sliver 自带 `build_runtime_bundle.py` + `runtime-manifest.json` 白名单；不得自造安装集，不得覆盖既有技能目录，必须留回滚命令。
- 不为消除宿主告警而修改上游资产文件（会破坏与来源的字节一致性）。
- **本仓库自持，不再依靠任何上游**：不产出上游问题报告、不等待上游确认；上游改名/差异仅作事实记录与周期复核项。
- 测试脚手架一律放 `<repo>/_smoke/`（gitignore），总目标完成后清理；不得污染其它 Claude/Codex 配置、不得覆盖既有技能。
- 调 Sliver 自带 Python 工具必须带 `-B`（否则在快照里生成 `__pycache__`，会被 provenance 门禁拦下）。
- 不把 static smoke 写成真实宿主可用，也不把中断的子 Agent 回执写成独立审计通过。
- 不把发布包写成发布授权。
