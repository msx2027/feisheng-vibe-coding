# Feisheng Vibe Coding 交接文档

更新时间：2026-09-10（第二轮：接手推进 G1–G4 后重写）

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
- 基线：第二轮提交序列（递增）：
  - `5f7d60d` feat: add claude runtime projection, shared guard, and release notice gate
  - `399adc8` feat: merge vibe per-skill license ledger and close font/source gaps
  - `c257ac0` audit: cross-verify vibe groups (v5) and record adapter-candidate decision
  - `50aca5b` feat: add release package builder, release-gate CI, and normalize script encoding
  - `b58946f` docs: refresh continuation handoff after G1-G4
  - `907e4c7` docs: record committed baseline and post-commit gate verification
  - （当前 HEAD 以 `git -C 'F:\skiils工具\feisheng-vibe-coding' log -1 --oneline` 为准）
- 工作树：干净（第二轮完成后已提交）。
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

## 当前技能状态（CANONICAL-CATALOG.json，未改变）

- `control-plane`：1（sliver-vibe-coding）
- `accepted-primitive`：3（diagnosing-bugs、codebase-design、domain-modeling）
- `adapter-candidate`：7（Matt）
- `blocked-unclassified-working-tree`：2（code-review、tdd）
- Vibe：`source-only-ui` 16、`source-only-product-or-checker` 22、`source-only-unreviewed` 3、
  `event-only-source-only` 3、`source-only-checker` 1、`compatibility-alias` 1

关键含义：**只有 3 个 Matt 原语进入候选 Codex/Claude 静态投影。所有 Vibe 技能、Vibe Hook、
Matt `tdd`/`code-review` 都没有进入运行时。** 本轮未改动 catalog 与生成器分类。

## 未完成的工作

### P0-A（剩余）：adapter-candidate 登记

前置条件已完成（逐技能许可证映射、字体缺口、ui-system-guardian 来源声明、独立交叉审查、无第二入口）。
未完成的是**状态迁移本身**，被以下条件阻断：

1. 真实宿主（Codex/Claude）discovery / trust / fresh-session smoke 缺失；
2. 或需要 owner 在 `provenance/OWNER-LEDGER.json` 显式授权「仅分类登记、不进入运行时」的有界迁移。

解除后按「一个有界能力组」分批改 `scripts/build-canonical-catalog.ps1` 的分类列表、重生成 catalog，
每批跑投影/NOTICE/Hook 全套 smoke。**不得直接手工编辑 `CANONICAL-CATALOG.json`（它是生成产物）。**

### P0-B：Matt 四项阻塞技能

上游（`vinvcn/mattpocock-skills-zh-CN`）HEAD 仍为 `9fe7e7a`（2026-08-30），无新提交、无开放 PR。
本地 4 个文件（`ask-matt`、`code-review`、`implement`、`tdd` 的 SKILL.md）仍为半改名工作树：
`code-review` frontmatter 改为 `mattpocock-code-review`，但 `.claude-plugin/plugin.json`、
`marketplace.json` 仍为 `code-review`。没有上游提交/PR/维护者确认前：

- `tdd`、`code-review` 维持 `blocked-unclassified-working-tree`；
- `implement`、`ask-matt` 不得因工作树内容解锁或改写；
- 不修改来源仓库，不把这 4 个工作树版本复制到目标仓库。

### P1：宿主投影与发布能力

1. **真实宿主 smoke 未验证**：Codex/Claude 投影均为静态候选；真实宿主 discovery、trust、fresh-session smoke 全部 `UNVERIFIED`；不得写入真实宿主目录，除非另有明确授权和回滚方案。
2. **发布包已可装配，CI 未真实运行**：`scripts/build-release-package.ps1` 本地两套 PowerShell 均验证通过（19 文件、0 违规、包内投影 Validate 通过）；`.github/workflows/release-gate.yml` 仅本地 YAML 校验，未在真实 runner 执行。
3. **Hook 未解锁**：需要 per-skill license、host discovery、事件顺序/并发、写白名单/回滚和独立逻辑审查全部通过。

## 当前阻塞项

- **真实宿主证据缺失**：Vibe adapter-candidate 登记与 Hook 解锁的共同阻塞项。
- **外部依赖未满足**：Matt 四项解锁依赖上游提交/PR/维护者确认。
- **宿主稳定性**：本轮 v5 派发时 `luna_vibe_product_audit_v5` 首次被中断、`v5b` 遇 `Upstream request failed`，
  第三次 `v5c` 成功；重派时需接受可能的中断，只采纳有回执的轮次。

## 本轮子 Agent 状态

- `luna_vibe_product_audit_v5`：被中断，无产出（不计入）。
- `luna_vibe_product_audit_v5b`：宿主 `Upstream request failed`（不计入）。
- `luna_vibe_product_audit_v5c`：成功回执（采纳）。
- `luna_vibe_ui_audit_v5`：成功回执（采纳）。

历史轮次（v3/v4、health check 等）仍无回执，不得补标 accepted。

## 建议的接手顺序

1. 读取本文件、`AGENTS.md`、`docs/AGENT-ORCHESTRATION.md`、`provenance/CANONICAL-CATALOG.json`、
   `provenance/LICENSE-MAP.json`、`evidence/20260910-vibe-independent-audit-v5-and-decision.md`。
2. `git status --short` 与 `git log -1 --oneline` 确认基线；不要重置或回退任何已有提交。
3. 若先做分类推进：取得 owner 显式授权后，按一个有界能力组改生成器分类并重生成 catalog + 全套 smoke；
   否则优先推进真实宿主授权安装与 fresh-session smoke。
4. 在真实 GitHub runner 上验证 `.github/workflows/release-gate.yml`；如需可加发布流水线（仍不得声明发布授权）。
5. 跟踪 Matt 上游提交/PR/维护者确认，满足条件后再复评四项状态。
6. Hook 解锁按 P1 第 3 条逐门禁推进。

## 常用验证命令

```powershell
# 目标仓库状态
git -C 'F:\skiils工具\feisheng-vibe-coding' status --short
git -C 'F:\skiils工具\feisheng-vibe-coding' log -1 --oneline

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
- 不把 static smoke 写成真实宿主可用，也不把中断的子 Agent 回执写成独立审计通过。
- 不把发布包写成发布授权。
