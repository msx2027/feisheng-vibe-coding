# 证据：T1 宿主中性投影（选项 A）实施与安装

- 日期：2026-09-11
- 提交：`4fe8f43`（宿主中性投影 + 安装默认 + 门禁纳入）、`cb05fb1`（DryRun 副作用修复）
- 决策依据：HANDOFF-NEXT.md 第 6 节决策 #4（共享根装宿主中性包）——本批只是执行，未推翻任何决策

## 做了什么

1. **共享主体抽取**：`scripts/runtime-projection-guard.ps1` 新增 `Invoke-RuntimeProjection`（Build+Validate 唯一实现）。
   Codex / Claude 两个 builder 改为薄壳 writer，只声明差异（manifest 名、schema、host 标签、overlay 目标、
   hostAdapter 段、结果附加字段）。两个宿主 builder 的输出与重构前完全一致（Codex 95 文件、Claude 93 文件，实测）。
   没有写第三个复制版 builder（交接 9.1 明确禁止）。
2. **宿主中性 builder**：新增 `scripts/build-shared-runtime-projection.ps1`
   （manifest `shared-projection-manifest.json`，schema `feisheng-shared-runtime-projection/v1`，host `shared-neutral`，
   无任何宿主 overlay；guard 主体在 `-OverlayTargetName` 为空时 fail-closed 断言计划里无 `host-facts` 文件）。
3. **安装脚本**：`install-runtime-projection.ps1` 新增 `Shared` 目标并设为**默认**；
   标记校验改为「带本仓库任一投影形态的 manifest 才算我们的安装」（仍在三种已知 schema 集合内 fail-closed，
   外人目录装/卸都被拒，见反例实测）；输出 JSON 增加 `manifestName` / `manifestSchema` / `replacesSchema`。
4. **门禁纳入**：`verify.ps1` 静态投影步骤从 2 个扩为 3 个（Codex / Claude / 宿主中性），
   `-IncludePackage` 下 **12 步 → 13 步**。
5. `packaging/runtime-projection.json`（人写策略描述）登记中立 builder 与 `sharedNeutral` 形态说明。

## 实施中发现并修复的 bug

**带 `-Force` 的 DryRun 会删掉已安装目录**（占用检查里的 `Remove-Item` 在 DryRun 退出点之前执行）。
首次实装时 DryRun 先行删除了旧的 Claude 形态安装，紧随其后的真实安装补上，最终状态正确，但 DryRun 违反了只读契约。
已在 `cb05fb1` 修复：DryRun 只记录 `replacesSchema`，不动目标目录；修复后实测安装目录前后文件数不变（92 → 92）。

## 安装验收（全部实测）

- 实装命令：`install-runtime-projection.ps1 -Force`（默认 Shared 形态），HEAD `cb05fb1`，装后 builder Validate 复核通过
- 文件数 **92**（91 核心 + 1 manifest；Claude 形态 93、Codex 形态 95，差异恰为各自 overlay）
- 宿主专属文件**全部缺席**（逐个实测）：
  - `agents/openai.yaml` ✗ 缺席
  - `governance/sliver-core/references/studio-codex.md` ✗ 缺席
  - `governance/sliver-core/references/execution-liveness-host.md` ✗ 缺席
  - `governance/sliver-core/assets/project-claude/CLAUDE.md` ✗ 缺席
- 槽位 `governance/sliver-core/references/runtime-adapter.md` sha256 = `4c7b5db64a83865a947185b4fed61e5b64460be5239f9c4d77b028a73a039eff`，
  与控制面核心中性版**逐字节一致**（与 HANDOFF 4.2 记录的 Codex 槽位哈希相同，即中性版）
- manifest：`host = shared-neutral`，`host-facts` 文件数 = 0
- 共享根条目数保持 **180**（我们的目录仍只有一个 `feisheng-vibe-coding`，无重复入口）
- fail-closed 反例：对无标记的外人目录执行安装（-Force -DryRun）与卸载，均被拒绝

## 门禁与 fresh clone（全矩阵实测）

- 本机：`pwsh scripts/verify.ps1 -IncludePackage` = **13/13**（提交 `cb05fb1` 后重跑）
- fresh clone **4/4 组合全部 13/13**：
  | clone 配置 | shell | 结果 |
  |---|---|---|
  | `autocrlf=false` | pwsh | 13/13 |
  | `autocrlf=false` | PS 5.1 | 13/13 |
  | `autocrlf=true` | pwsh | 13/13 |
  | `autocrlf=true` | PS 5.1 | 13/13 |

## UNVERIFIED（不越界声明）

- 宿主对中性安装的**发现性与触发行为**：UNVERIFIED，由 T2（9.2）实测——本批只换掉了装的东西，没有宿主行为证据
- 宿主 trust、技能真实行为、Hook 强制：维持 UNVERIFIED
- manifest 与结果里的 `freshSessionSmoke = 'UNVERIFIED'` 为生成时的诚实标记，不因本批改变
