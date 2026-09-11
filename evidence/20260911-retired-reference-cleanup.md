# 证据：退役能力正文引用清理（owner 选 A：登记的本地补丁 + 门禁复跑）

- 日期：2026-09-11
- 触发：owner 在 §9.10 复核后选择 **A**（登记 `LOCAL-PATCHES.json` 本地补丁、逐条改写文本、重录基线、复跑门禁）
- 关联真源：`provenance/LOCAL-PATCHES.json`（补丁登记）、`provenance/SKILL-CLASSIFICATION.json`（退役裁决）
- 门禁结果：`verify.ps1 -IncludeHostEvidence -IncludePackage` = **15/15 通过**（新增 1 步：Matt 侧副本一致性）

## 1. 问题（为什么必须动文本）

能力定批评次把 35 个未接入技能裁决为 **13 接入 / 22 退役**并清零了共享根链接，但
**已接入技能的正文仍指向被退役的 skill 与路径**。这类引用会直接把模型指向包内不存在的东西：

| 悬空引用 | 处数 | 典型位置 |
|---|---|---|
| `codebase-memory-scout`（退役：依赖未配置的 MCP，降级本就是 `rg`） | 13 | bug-fixer / dev-builder / dev-planner / hotspot-governor / test-automation / architecture-foundation |
| `target-constitution-setup`（退役：写入者与控制面 topic 冲突） | 5 | dev-builder 脚手架模板的 owner 字段 / architecture-foundation 依赖 |
| `skills/beginner-flow-guide/SKILL.md`（退役：二梯队重复路由） | 1 | bug-fixer 依赖清单（指向包内不存在文件） |
| `/setup-matt-pocock-skills`、`/improve-codebase-architecture`、`skill-builder`、`target-runtime-setup` | 各 1 | code-review / diagnosing-bugs / evolution-engine / dev-builder 参考文档 |
| `vibe-code-review` | 1 | skills/README.md |

共 25 处 / 13 文件。其中 `skills/README.md` 的 2 处已在上一批（`f2f0d17`）随现状刷新修掉；
本批处理**剩下 12 文件 23 处**（23 行）。

## 2. 修法（只改文本，不改能力）

| 原引用 | 改成 | 依据 |
|---|---|---|
| `/improve-codebase-architecture` | `codebase-design`（本包已接入的深模块设计能力） | 同职能，且已接入 |
| `/setup-matt-pocock-skills` | 向用户确认 issue 来源与 tracker 约定，不自行发明 tracker 规则 | 该技能退役（tracker 约定层不随包分发） |
| `skill-builder` | 按本仓治理流程登记（分类真源 + 导入脚本），不得裸建未登记技能 | skill-builder 退役：与本仓「来源快照 + 导入」治理冲突 |
| `target-constitution-setup`（模板 owner） | `sliver-vibe-coding`（控制面） | 其职能由控制面项目宪法 / 接管路由接管 |
| `target-runtime-setup` | 控制面接管路由（`references/routes-rescue.md`） | 目标项目运行时块不再由该技能写 |
| `codebase-memory-scout` | 「影响面侦察（`rg` / 可用的代码图工具）」 | 该能力退役且依赖从未配置，原文本本就写明降级为 `rg` |
| `skills/beginner-flow-guide/SKILL.md` | 整行删除（依赖清单里它是死路径） | beginner-flow-guide 退役 |

刻意**不做**的事：不新增能力、不改触发条件、不改依赖授权、不放宽任何门禁；只把「指向不存在的东西」
换成「已接入的能力 / 控制面路由 / 明确降级」。

## 3. 机制改造（让登记的偏差合法、未登记的偏差仍然失败）

原实现只有**快照树**补丁的概念（`snapshot = 快照名`），而本项目的一等副本（`skills/**`）另有
「副本必须逐字节等于来源快照」的断言（`build-canonical-catalog.ps1` 的副本自洽校验 +
`verify.ps1` 步骤 1c）。因此只改文本必然被门禁拦下。本次把补丁模型扩成两类**互不重叠的命名空间**：

| 命名空间 | 对象 | 校验语义 |
|---|---|---|
| `snapshot = <快照名>`（原有） | 快照树本身（如 `governance/sliver-core`） | 快照 == `patchedSha256`，来源 == `originalSha256` |
| `snapshot = runtime-import`（新增） | 一等副本（`skills/**`，path 相对仓库根） | 副本 == `patchedSha256`，其派生的快照文件 == `originalSha256` |

改动点（都复用同一份读取实现，没有第二份补丁逻辑）：

1. `scripts/provenance-integrity.ps1`：新增 `Get-RuntimeCopyPatches`（含按 `snapshotPath` 前缀过滤）；
2. `scripts/verify.ps1` 步骤 1c：识别登记的副本补丁，未登记偏差仍失败；新增「登记必须被真实导入项消费」的
   过期检查；**新增步骤 1c-2「导入副本与快照一致性（Matt）」**——此前 Matt 侧没有逐文件覆盖
   （`MATT-IMPORT.json` v2 不含逐文件映射），现用 `SKILL-INVENTORY.json` 按 `(source, sha256)` 唯一命中
   还原上游路径后再逐文件比对；
3. `scripts/build-canonical-catalog.ps1`：两处副本自洽校验改为「未登记即失败（fail-closed），登记需同时对上
   原哈希与补丁后哈希」。

## 4. 验证（全部为本次新鲜证据）

### 4.1 正向

```text
[PASS] catalog 与 SKILL-CLASSIFICATION.json 同步
[PASS] runtime include 内容完整性 — files = 420
[PASS] 导入副本与快照一致性 — files = 318（含 10 个已登记本地补丁）
[PASS] 导入副本与快照一致性（Matt） — files = 24（含 2 个已登记本地补丁）
[PASS] 保真树换行可复现性 — files = 1614 (-text，索引==工作树)
[PASS] 来源快照完整性 — vibe-coding-skills=553, mattpocock-skills=136, sliver-core=220
[PASS] 路由绑定 — admitted=51 bound=51 scanned=44
[PASS] 发布 NOTICE 门禁 — runtime items = 53
[PASS] 宿主证据门 — admitted=52 ageDays=0.89
[PASS] Codex / Claude / 宿主中性静态投影 Build + Validate
[PASS] 发布候选包装配 — files = 858
verify: 15/15 steps passed
```

### 4.2 反向（四条反例，逐条实测失败并逐字节还原）

| # | 注入 | 结果 |
|---|---|---|
| 1 | 在**已登记**文件（test-automation）上再做未登记改动 | FAIL ×3：catalog 自洽（登记=44ef… 实际=e5ca…）、runtime include、1c（`patchedSha256` 不符 + 登记未消费）；退出码 1 |
| 2 | 在**完全未登记**文件（ui/brand）上改动 | FAIL ×3：catalog 自洽、runtime include、1c（`与快照不一致，且无本地补丁登记`） |
| 3 | 把**已登记**文件还原成快照原文（制造登记过期） | FAIL ×3：1c（`本地补丁登记未对应任何「副本偏离快照」的导入项`）、catalog 过期、runtime include |
| 4 | 在 Matt 侧**未登记**文件（engineering/tdd）上改动 | FAIL ×3：catalog 自洽、runtime include、**1c-2**（Matt 侧首次命中未登记偏差） |

四个反例测试后文件均按字节还原，哈希与登记一致；随后复跑全量门禁恢复 15/15。

### 4.3 残留清点（修后扫描）

对 `governance/sliver-core` + `skills` 全部 579 个文件按 22 个退役 id 扫描（剔除 `shape`/`implement`/`teach`/`triage`
这类与英文单词同形的 id）：**残留悬空引用 0 处**。

> **2026-09-12 更正**：本节「0 残留」结论对 `/shape` 命令形态不成立——同形词剔除把 `shape` 的
> `/shape` 引用一并放行，实际残留 6 处（`skills/checker/audit/SKILL.md:122,141`、
> `skills/checker/critique/SKILL.md:162,227`、`skills/ui/impeccable/reference/craft.md:7,11`）。
> 已按本文件第 2/3 节同一机制修复（登记 `entry-gate-description-retarget` 补丁 + 改写正文），
> 并把扫描口径固化为门禁 `scripts/validate-retired-references.ps1`（全量 retired id 的 `/id`
> 命令形态、屏蔽 `sources/` 快照路径引用，不再依赖人工同形词判断）。见
> `evidence/20260912-chain-audit-and-closure.md`。

### 4.4 宿主侧生效

`install-runtime-projection.ps1 -TargetHost Shared -Force` → `status=INSTALLED, fileCount=422, validated=true`；
在共享根（`F:\skiils工具\_adapters\shared\skills\feisheng-vibe-coding`）复扫 `codebase-memory-scout`：0 命中。

## 5. 可逆性与边界

- 每个文件都同时登记了 `originalSha256`（来源快照哈希）与 `patchedSha256`，且 `snapshotPath` 指向快照文件：
  任何时候都能从 `sources/` 恢复原文；登记项由门禁强制核对，登记过期会失败。
- **未修改** `sources/**`（内容真源保持逐字节忠实）、**未修改** `provenance/SKILL-INVENTORY.json`（来源事实快照）。
- 重新执行导入脚本（`import-vibe-skills.ps1` / `import-matt-source.ps1`）会用快照覆盖被打补丁的副本，
  届时门禁会因 `patchedSha256` 不符而失败——这是有意的 fail-closed，不是回归。
- 未变边界：宿主 trust、Hook fresh-session 冒烟、逐技能行为质量仍为 `UNVERIFIED`。
