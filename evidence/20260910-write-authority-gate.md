# 写权限门禁 + 投影门禁收敛（④）

日期：2026-09-10
目标：让 `writeAuthority` 从空占位变成**被强制执行**的门禁，并消除投影门禁的平行实现。
关联任务包：tasks/20260910-write-authority-gate.md（accepted）

## 结论

`writeAuthority` 已声明并被共享门禁强制执行（两条规则）；同时发现并修复了 **Codex 投影构建器存在平行门禁实现**
这一真实缺陷（该缺陷会让新增门禁对 Codex 静默失效）。收敛后 Codex 输出与收敛前**逐文件一致**。

## 一、# writeAuthority 受控词表与声明

`provenance/SKILL-CLASSIFICATION.json` 新增：

| 键 | 内容 |
|---|---|
| `writeAuthorityVocabulary` | 9 个受控 token：`none`、`target-project-code`、`target-project-docs`、`route-catalog`、`target-truth`、`validation-gate`、`skill-catalog`、`runtime-projection`、`hook-writer` |
| `writeAuthorityPolicy.controlPlaneTokens` | 6 个控制面 token（route-catalog、target-truth、validation-gate、skill-catalog、runtime-projection、hook-writer） |
| `writeAuthorityPolicy.exclusiveOwners` | 每个控制面 token 的排他 owner 记录 id（`route-catalog`/`target-truth`/`validation-gate` → `sliver-vibe-coding`；其余 → 空） |
| `writeAuthorityPolicy.requireDeclaredForRuntime` | `true` |

生成器把该策略投影进 catalog 的 `decisionPolicy.writeAuthorityPolicy`（门禁只读 catalog，单一输入）。
生成时校验 token 是否在词表中，未知 token 直接抛错。

### 声明（仅依据已有证据，不推断未验证技能）

| id | writeAuthority | 依据 |
|---|---|---|
| `sliver-vibe-coding` | `route-catalog`、`target-truth`、`validation-gate` | 唯一项目级控制面，拥有 route / truth / 验收门 |
| `domain-modeling` | `target-project-docs` | 只维护目标项目 glossary/ADR，写入受 target-truth 约束（`evidence/20260910-matt-primitive-adoption.md`） |
| `diagnosing-bugs` | `none` | 仅提供诊断反馈环纪律（同上） |
| `codebase-design` | `none` | 仅提供 deep module / interface / seam 共享词汇（同上） |

其余 78 条**不声明**（保持 absent）——这是诚实状态：还没逐项问过，而且它们不在 runtime，门禁不适用。

## 二、门禁规则（共享门禁模块内强制执行）

| 规则 | 内容 |
|---|---|
| A | **runtime include 必须声明 writeAuthority**（空声明即失败） |
| B | **任何记录声明控制面 token 时，必须是该 token 的排他 owner**；否则失败（防重复写入者） |

规则 B 对所有记录生效（不只 runtime），因此错误声明在提升前就会暴露。

## 三、发现并修复的真实缺陷：Codex 平行门禁实现

### 发现

按 ④ 设计跑反例（让 `codebase-design` 声明 `route-catalog`）时，**Codex 构建竟然成功（exitCode 0）**。
排查结果：

- `scripts/build-codex-runtime-projection.ps1` 自带一整套重复 helper
  （`Get-FullPath`、`ConvertTo-SafeRelativePath`、`Join-ContainedPath`、`Get-Sha256`、`Get-GitRevision`、
  `Get-NormalizedRelativePath`、`Get-ParentDirectories`、`Test-PathContainsSegment`）**以及自己的
  `Get-ProjectionPlan`**；
- 只有 Claude 构建器点源了 `scripts/runtime-projection-guard.ps1`；
- 因此 `evidence/20260910-claude-projection-smoke.md` / 交接文档中「Codex/Claude 共用同一套投影门禁，非平行实现」
  的说法**对 Codex 不成立**——这正是仓库明令禁止的「平行实现 / 第二个 gate 实现」。

后果：本轮新增的写权限门禁、以及上一轮把门禁改为读 `decisionPolicy` 的改动，**对 Codex 全部静默失效**。

### 修复

- `scripts/build-codex-runtime-projection.ps1`：删除全部重复 helper 与本地 `Get-ProjectionPlan`，改为点源共享门禁模块
  （现仅剩 `Test-CodexRuntimeProjection` 及其后的 Codex 特有逻辑）。
- `Get-ExpectedDirectories`（两个构建器各自重复了一份、且逐字相同）移入共享门禁模块，两边删除本地副本。

### 收敛等价性证明

先记录收敛前 Codex 输出，再做收敛，然后比对：

```
files before: 5   after: 5
CODEX OUTPUT IDENTICAL after guard convergence (per-file sha256 + file set)
```

即收敛不改变任何产物内容。

## 四、反例测试（修复后，Codex 路径）

| 反例 | 注入 | 结果 |
|---|---|---|
| B 重复写入者 | `codebase-design.writeAuthority = ['route-catalog']`（非排他 owner） | Codex 构建被门禁拒绝（抛出） |
| A runtime 未声明 | 删除 `codebase-design.writeAuthority`（它是 runtime include） | Codex 构建被门禁拒绝：`runtime include 必须声明 writeAuthority` |

（修复前这两个反例在 Codex 路径上都不会触发；Claude 路径本来就会触发。）

## 五、复验

```text
[PASS] catalog 与 SKILL-CLASSIFICATION.json 同步
[PASS] 能力索引新鲜度
[PASS] 发布 NOTICE 门禁 — runtime items = 5
[PASS] Vibe Hook 适配器保持禁用
[PASS] Codex 静态投影 Build + Validate
[PASS] Claude 静态投影 Build + Validate
[PASS] 发布候选包装配 — files = 19
verify: 7/7 steps passed
```

能力索引「现在可用」表新增 `可写（writeAuthority）` 列，直接展示已启用技能能写什么。

## 已知限制 / 未完成

- 78 条记录仍未声明 writeAuthority（诚实 absent）；它们不在 runtime，门禁不适用；逐个声明是增量工作。
- `status` 仍是给消费者的兼容别名（收敛阶段应移除，消费者改读 `readiness`）。
- Claude 构建器仍保留 Claude 特有逻辑与 Sliver 资产路径常量（这是宿主差异，不是门禁重复）。
- 宿主 discovery / trust / fresh-session smoke 仍 `UNVERIFIED`。
