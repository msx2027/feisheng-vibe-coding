# 分类数据化 + 能力索引 + 单入口验证（①②③）

日期：2026-09-10
目标：把「要不要提升为 adapter-candidate」从一个高风险标签决策，改造成一次低风险数据编辑。
关联任务包：tasks/20260910-classification-data-driven-and-index.md（accepted）

## 结论

分类决策从生成器脚本的硬编码数组搬到声明式真源 `provenance/SKILL-CLASSIFICATION.json`；
生成器变成纯派生；新增人类可读能力索引 `docs/CAPABILITY-INDEX.md`；新增单入口 `scripts/verify.ps1`；
门禁改为读取 `decisionPolicy`（消除"声明 vs 执行"两套）。**全部 82 条记录的既有字段逐字段不变**（等价性已证明）。

## 一、③ 分类数据化（先做，因为 ① 依赖它）

### 新增真源

`provenance/SKILL-CLASSIFICATION.json`（schema `feisheng-skill-classification/v1`）：

| 部分 | 作用 |
|---|---|
| `skills.<id>.domain` / `.readiness` | 唯一分类决策（正交两轴） |
| `skills.<id>.source` | 交叉校验（防止键错位） |
| `skills.<id>.writeAuthority` | 可选；④ 的接入点（缺省 `[]`） |
| `statusPolicy` | `domain\|readiness` → `status` 派生表（22 行） |
| `runtimePolicy` | `controlPlaneStatus` + `acceptedStatuses`（runtime 唯一准入真源） |
| `reasonsByStatus` / `reasonsById` | 人类可读原因（索引使用） |
| `duplicateGroups` | 语义重复组的 canonical owner 与规则 |

### 生成器改造

`scripts/build-canonical-catalog.ps1` 现在：读取 inventory（事实）+ classification（决策），只做派生
（id 命名、路径、来源 revision）。新增 fail-closed 校验：

- 派生 id 不在分类中 → 抛错；分类存在过期条目 → 抛错；
- 分类 `source` 与 inventory 不一致 → 抛错；
- `(domain, readiness)` 不在 `statusPolicy` → 抛错。

### 等价性证明（关键）

重生成 catalog 后与 `HEAD` 版本逐字段比对：

```
EQUIVALENCE: PASS (82/82 legacy fields identical)
legacy fields: id, source, path, sourceRevision, invocation, status, sourceSha256, writeAuthority
+ duplicateGroups identical + acceptedStatuses/runtimeExcludedStatuses 集合一致
```

等价性比对本轮**抓到并修掉一个真实回归**：旧生成器会把「已验收原语」的 path 从 `sources/...` 重映射到
目标仓库 `skills/engineering/<id>/SKILL.md`；新派生最初漏了这一步。修正后改为**按 `readiness=accepted`
语义判定**（而不是硬编码名单），并通过比对。

### 门禁改为读策略（消除第二套真相）

| 脚本 | 改动 |
|---|---|
| `scripts/runtime-projection-guard.ps1` | 从 `decisionPolicy.controlPlaneStatus` / `acceptedStatuses` 读取 runtime include 与 control-plane 身份；缺策略即抛错 |
| `scripts/validate-release-notices.ps1` | 从 `decisionPolicy.acceptedStatuses` 读取 runtime include 集合；为空即拒绝 |

原实现硬编码 `'control-plane'` / `'accepted-primitive'`，即 catalog 声明的策略无人执行。现已收敛为单一真源。

### 提升 = 一行数据编辑（实测）

实测：把 `ui-styling` 的 `readiness` 由 `source-only` 改为 `candidate` → 重生成 → catalog 变为
`ui / candidate / adapter-candidate`，能力索引中自动从「来源专用」移入「已审查、待启用」并带上其专属原因。
随后已还原。

本轮同时补了 `candidate` 策略行（ui、product-or-checker、checker、primitive、user-tool、event、unreviewed、adapter），
使「提升为候选」在常见域下都是一行编辑；而「提升为运行时（accepted）」仍只对 `primitive` 域开放策略行 ——
把非 primitive 域提升为运行时是**故意保持 fail-closed** 的显式决策动作（且还须同时打开其来源的
`LICENSE-MAP.runtimeEligible`，是第二道独立闸门）。

## 二、① 能力索引

`scripts/build-capability-index.ps1` → `docs/CAPABILITY-INDEX.md`（生成物，禁止手工编辑；输出确定性，便于校验新鲜度）。

内容：现在可用（4）/ 已审查待启用（7）/ 来源专用（按域分组，61）/ 阻塞（2）/ 兼容与排除（8），
每项带原因；并说明「如何改变可用集合」的 4 步。

## 三、② 单入口验证

`scripts/verify.ps1`：一条命令跑 6 项，退出码 0/1。

| # | 步骤 | 说明 |
|---|---|---|
| 1 | catalog 与分类真源同步 | 重生成到临时目录后语义比对（忽略 `generatedAt`） |
| 2 | 能力索引新鲜度 | 重生成后逐字节比对 |
| 3 | 发布 NOTICE 门禁 | `decisionPolicy.acceptedStatuses` 驱动的 runtime 映射 |
| 4 | Vibe Hook 适配器保持禁用 | 以「不抛异常」判定（测试内部 Validate!=0 / Invoke!=3 会抛） |
| 5 | Codex 静态投影 | Build + Validate |
| 6 | Claude 静态投影 | Build + Validate |
| 6' | 发布候选包装配（`-IncludePackage`） | 可选 |

## 复验结果

```text
[PASS] catalog 与 SKILL-CLASSIFICATION.json 同步
[PASS] 能力索引新鲜度
[PASS] 发布 NOTICE 门禁 — runtime items = 5
[PASS] Vibe Hook 适配器保持禁用
[PASS] Codex 静态投影 Build + Validate
[PASS] Claude 静态投影 Build + Validate
verify: 6/6 steps passed
```

**fail-closed 反例测试**（故意把 `ui-styling.readiness` 改为当时无策略行的 `candidate`）：

```text
[FAIL] catalog 与 SKILL-CLASSIFICATION.json 同步 — 分类策略缺失: skill 'ui-styling' 的 (domain=ui, readiness=candidate) 不在 statusPolicy 中。
verify: 5/6 steps passed
failed steps: ...
VERIFY_EXIT=1
```

即：生成物与真源不一致时验证器确实失败并返回 1（该反例同时暴露并促成了 candidate 策略行的补齐）。

## 其他变更

- `provenance/OWNER-LEDGER.json`：`skill-catalog` 的 `inputs` 增加 `provenance/SKILL-CLASSIFICATION.json`，
  `writes` 增加 `domain` / `readiness`，`projections` 增加 `docs/CAPABILITY-INDEX.md`。
- `.github/workflows/release-gate.yml`：门禁步骤收敛为单入口 `verify.ps1`，保留发布包装配与 artifact 上传。

## 已知限制 / 未完成

- `status` 仍是给消费者的兼容别名（generated alias）；收敛阶段应让消费者直接读 `readiness` 并移除 `status`。
- `build-codex|claude-runtime-projection.ps1` 的 manifest 分组仍按字面 `kind -eq 'control-plane'` 分组（仅影响输出分组展示，
  不入闸门）；后续可一并收敛到 `plan`。
- 宿主 discovery / trust / fresh-session smoke 仍 `UNVERIFIED`。
- ui-ux-pro-max data CSV 的上游数据许可仍未在线核对（bundled MIT 声明覆盖）。
