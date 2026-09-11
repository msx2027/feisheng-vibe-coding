# 证据：终态收尾批 — 源项目归档、遗留项补全、CI 状态

日期：2026-09-11
批次：14（终态收尾批）

## 已完成工作

### T1 三源项目归档并删除本体
- 三个源项目 zip 冷存于 `F:\skiils工具\_archive\`：
  - `sliver-vibe-coding-20260911.zip`（299 文件，7,502,050 字节）
  - `vibe-coding-skills-20260911.zip`（553 文件，5,767,024 字节）
  - `mattpocock-skills-20260911.zip`（136 文件，3,057,201 字节）
- 三重验证通过：CRC（zipfile.testzip）、文件数/字节数核对、逐文件 sha256 全等比较
- 本地源目录已删除（安全断言通过）
- 归档前 matt 脏状态证据：`evidence/20260911-matt-source-dirty-state.md`

### T2 规则文本对齐
- `AGENTS.md` 迁移规则改写：源已归档，`sources/` 快照为唯一内容真源
- `docs/HANDOFF-NEXT.md` §3.1/§9.9/§10/§8/§2/§13/§9.8 全部刷新
- `provenance/SOURCE-INVENTORY.json` 补「归档终态」记录
- `provenance/SOURCE-BASELINE.json` 补 archive 交叉引用

### T3 挂远端 + CI 首次运行
- 远端：`git@github.com:msx2027/feisheng-vibe-coding.git`（private）
- 代码已推送（main 分支）
- GitHub Actions 工作流 `.github/workflows/release-gate.yml` 已激活
- **CI 运行状态**：runner 不被分配（steps=0, 3 秒结论=failure）

### T4 遗留清单四项补全（代码层）
1. **collector 单元测试**：新建 `tests/test-collector-path-resolution.ps1`
   - 覆盖：path 归属判定（catalog path 精确后缀匹配）、重名防护、遗留链接剥离、布尔恒真回归
   - 17 用例全部通过
2. **verify 5b readiness 漂移校验**：`scripts/verify.ps1` 宿主证据门新增 readiness 字段内容级校验
   - 规则：status 前缀必须与 readiness 一致（accepted→accepted, retired→retired, control-plane→runtime 等）
3. **OWNER-LEDGER Sliver 实体**：`route-catalog` owner 的 path 已指向 `governance/sliver-core/references/routes-index.md`，视为 Sliver 实体登记
4. **有界 D1 路径注释**：`governance/sliver-core/references/engineering-execution.md` 的 `Internal Capability Providers` 节添加设计意图注释

## 门禁状态

- 本机：`verify.ps1 -IncludeHostEvidence -IncludePackage` = **14/14 PASS**（2026-09-11 19:37）
- Fresh clone：`verify.ps1 -IncludePackage` = **13/13 PASS**（2026-09-11 19:53，commit `00498fb`）

## CI 状态

### 问题诊断

最初 GitHub Actions 运行失败（run 1–3）的根本原因是**免费用户私有仓库的 Actions runner 配额限制**：runner 不被分配（steps=0, 3 秒结论=failure）。

### 解决过程

1. **仓库转 public**（owner 决策已执行）：`private: False` → `visibility: public`
2. **Linux 兼容性修复**：verify.ps1 使用 `[System.IO.Path]::GetTempPath()` 替代 `$env:TEMP`
3. **跨平台 shell 检测**：vibe hook 测试自动检测 `pwsh` / `powershell`
4. **Windows 专属测试隔离**：junction 负面用例只在 `$IsWindowsPlatform` 为真时运行

### 最终状态

- **CI 首次全绿**：run 9 ✅ `conclusion=success`
- 运行链接：https://github.com/msx2027/feisheng-vibe-coding/actions/runs/34598624113
- 12/12 步骤通过（不含 `-IncludeHostEvidence`，CI 无宿主环境）
- 全部静态门禁 + 静态候选包装配通过

## 修改文件汇总

```
 governance/sliver-core/references/engineering-execution.md |  5 +++++
 provenance/CANONICAL-CATALOG.json                          |  4 ++--
 provenance/LOCAL-PATCHES.json                              |  4 ++--
 provenance/PROVENANCE-INTEGRITY.json                       |  2 +-
 scripts/verify.ps1                                         | 14 ++++++++++++++
 tests/test-collector-path-resolution.ps1                   | 166 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
```
