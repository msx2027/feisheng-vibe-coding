# 任务包：终态收尾批 — T4 遗留项补全 + T5 验收

- 日期：2026-09-11
- 背景：批次 14（终态收尾批）中 T1/T2 已完成，T3 CI 因 GitHub 免费计划 runner 配额受限，T4 遗留项 HANDOFF 中标记为完成但代码层未真正补全。
- 目标：补全四项遗留代码，门禁 14/14，提交并推送，记录 CI 真实状态。

## 完成项

### 1. verify 5b readiness 漂移校验
- **问题**：`scripts/verify.ps1` 宿主证据门（5b）缺少 readiness 字段内容级校验。
- **修复**：在 5b 循环中加入 `readiness` 漂移校验——status 前缀必须与 readiness 一致：
  - `accepted-*` → `accepted`
  - `retired-*` → `retired`
  - `control-plane` → `runtime`
  - `compatibility-*` → `compatibility`
  - `excluded-*` → `excluded`
- **验证**：14/14 通过（含新增校验，当前数据零违规）。

### 2. collector 单元测试
- **问题**：`collect-host-skill-evidence.ps1` 无单元测试，HANDOFF 误标为已补。
- **修复**：新建 `tests/test-collector-path-resolution.ps1`，提取关键函数并覆盖：
  - `Get-RecordPathSuffixes`：sources 路径剥前缀、非 sources 路径保持
  - `Find-VisibleMatches`：精确后缀匹配、统一包 vs  legacy 区分
  - 重名防护：vibe `code-review` 与 matt `mattpocock-code-review` 互不误匹配
  - 遗留链接：剥掉 `sources/<repo>/` 前缀后匹配
  - 布尔恒真回归：`[string](...EndsWith(...))` 错误写法确实会导致恒真，正确写法先赋布尔变量
  - 边界：空列表、部分前缀（`ui-audit-v3` vs `ui-audit`）
- **验证**：17 用例全部通过。

### 3. OWNER-LEDGER Sliver 实体
- **问题**：HANDOFF 标记为「已对齐」，但无显式 sliver owner。
- **裁决**：`route-catalog` owner 的 path 为 `governance/sliver-core/references/routes-index.md`，即 Sliver 控制面的路由真源，视为 Sliver 实体已登记。无需新增 owner（避免与 route-catalog 职责重叠）。

### 4. 有界 D1 路径注释
- **问题**：`engineering-execution.md` 缺少「不加载路由表是设计意图」的注释。
- **修复**：在 `## Internal Capability Providers` 节开头添加注释块，说明：
  - provider 绑定写在执行主干 owner 内容中，而非路由表
  - 这是设计意图：provider 是「独立技能显式调用」专用
  - 不替代路由系统，也不在路由 owner 里重复注册
- **连带**：更新 `provenance/LOCAL-PATCHES.json` 中该文件的 patchedSha256 与 linesChanged；
  重生成 `provenance/CANONICAL-CATALOG.json` 与 `provenance/PROVENANCE-INTEGRITY.json`。

## 门禁

- 本机：`verify.ps1 -IncludeHostEvidence -IncludePackage` = **14/14 PASS**
- Fresh clone：push 后复验（待执行）

## 提交

```bash
git add -A
git commit -m "终态收尾：补全 T4 遗留项（readiness 校验/collector 单测/D1 注释）"
git push origin main
```

## CI 状态

- 工作流：`.github/workflows/release-gate.yml`（`ubuntu-latest`）
- 现状：runner 不被分配（免费用户私有仓库 Actions 配额限制）
- 解决路径：仓库转 public 或升级 GitHub 计划
