# 发布包装配与门禁 CI 接入证据（G4）

日期：2026-09-10
目标：G4（P1：构建 zip/NOTICE 发布包 + NOTICE 门禁接入 CI）
任务包：tasks/20260910-release-package-and-ci.md（accepted）
审计人：主 Agent

## 结论

新增 `scripts/build-release-package.ps1`：以发布 NOTICE 门禁为前置，装配 Codex/Claude 静态候选包
（runtime 投影 + NOTICE.txt + RELEASE-MANIFEST.json + 随包 provenance 许可证副本）并打包 zip。
新增 `.github/workflows/release-gate.yml` 把门禁接入 CI。本包为**静态候选包**，不是发布授权，
也不代表真实宿主可用。

## 新增/变更

| 文件 | 说明 |
|---|---|
| `scripts/build-release-package.ps1` | 发布包装配器：① 先跑 `validate-release-notices.ps1`，失败 fail closed；② 调 Codex/Claude 投影 builder 生成干净投影；③ **只按门禁报告的 provenance 路径**复制随包 NOTICE 文件；④ 生成 NOTICE.txt + RELEASE-MANIFEST.json；⑤ 用内置 `Compress-Archive` 打 zip（不新增依赖） |
| `.github/workflows/release-gate.yml` | CI：跑 NOTICE 门禁、Vibe Hook 禁用测试、Codex/Claude 投影 Build+Validate、发布包装配，并上传静态候选包 artifact（`retention-days: 14`） |
| 6 个脚本补 UTF-8 BOM | `build-claude-runtime-projection.ps1`、`runtime-projection-guard.ps1`、`validate-release-notices.ps1`、`import-vibe-source.ps1`、`invoke-vibe-hook-adapter.ps1`、`tests/test-vibe-hook-adapter.ps1`（详见下文） |

## 打包结构与验证结果

包内容（19 个文件，Both 宿主）：

```text
NOTICE.txt
RELEASE-MANIFEST.json
notices/governance/sliver-core/LICENSE
notices/sources/mattpocock-skills/LICENSE
notices/sources/mattpocock-skills/LICENSE.zh-CN.md
runtime/codex/{SKILL.md, governance/sliver-core/SKILL.md, skills/engineering/{domain-modeling,codebase-design,diagnosing-bugs}/SKILL.md, codex-projection-manifest.json}
runtime/claude/{SKILL.md, CLAUDE.md, adapters/claude/runtime-adapter.md, governance/sliver-core/SKILL.md, skills/engineering/{...}/SKILL.md, claude-projection-manifest.json}
```

| 验证 | 结果 |
|---|---|
| 装配（pwsh 7，Both） | `status=BUILT`；`noticeGateStatus=PASS`；`packageFileCount=19`；`forbiddenSegmentViolations=[]` |
| 装配（Windows PowerShell 5.1，Both） | `status=BUILT`；19 文件；无违规 |
| 包内 Codex 投影 Validate | `exitCode=0`，`manifestSha256=7f50c045…` |
| 包内 Claude 投影 Validate | `exitCode=0`，`manifestSha256=294d70fa…` |
| 包内不含 Vibe / blocked / generated-mirror / Hook | 由投影 builder 门禁保证；NOTICE.txt 声明 Vibe `runtimeEligible=false` |
| 随包 NOTICE 可追溯 | 每项记录 `repoPath` / `packagePath` / `sha256`（来自门禁映射，非手工挑选） |

## 门禁可移植性修复（BOM）

发现：6 个含中文的脚本没有 UTF-8 BOM，在 Windows PowerShell 5.1（中文区域默认 ANSI/GBK 解码）下
直接解析失败（例如 `validate-release-notices.ps1` 报 `UnexpectedToken`）。这会让仓库文档「常用验证命令」
在原样复制到默认 Windows PowerShell 时不可用。

修复：给这 6 个脚本补 UTF-8 BOM（纯字符编码元数据变更）。

| 验证 | 结果 |
|---|---|
| 内容未变 | 三个已跟踪脚本的非 BOM SHA-256 与 `HEAD` blob 完全一致（`daebd54d…`、`7a246b96…`、`41cf103e…`） |
| Windows PowerShell 5.1 门禁 | NOTICE 门禁 `exitCode=0`；Hook 测试 PASS（`EXIT=3` 为预期 BLOCKED） |
| Windows PowerShell 5.1 投影 | Codex / Claude Build 均 `exitCode=0` |

## 已知限制（已写入 RELEASE-MANIFEST.build）

`ConvertTo-Json` 在 Windows PowerShell 5.1（4 空格缩进、对齐冒号）与 PowerShell 7（2 空格缩进）下
输出格式不同，导致**语义相同但字节不同**的 manifest 与不同 `manifestSha256`（pwsh 7: `7f50c045…`；
PS 5.1: `4831d9ac…`）。

- 影响：跨 PowerShell 版本构建不可字节复现。
- 处理：`RELEASE-MANIFEST.json` 记录 `powerShellVersion` / `powerShellEdition` 与 `reproducibilityNote`；
  **以 PowerShell 7 (pwsh) 为唯一规范化 release 构建运行时**。
- 不影响正确性：Validate 校验的是 manifest 的字段值，同版本内自洽。

## 边界确认

- 未启用真实宿主安装；未写入真实 Codex/Claude 目录；`fresh-session smoke` 保持 `UNVERIFIED`。
- 未把 static 包写成发布授权；NOTICE.txt 与 manifest 都显式声明 `NOT a release authorization`。
- 未手工创建/挑选许可证文件：随包许可证全部按门禁映射路径程序化复制。
- Vibe 仍 `runtimeEligible=false`，包内无任何 Vibe 运行时文件；blocked 技能与生成镜像/Hook 段被排除。
- 未新增第三方依赖（zip 用内置 `Compress-Archive`；CI 用预装 pwsh）。

## 本轮全套 smoke（pwsh 7，最终）

| 门禁 | 结果 |
|---|---|
| 发布 NOTICE 门禁 | `status=PASS`，5 个 runtime 项，`exitCode=0` |
| Vibe Hook 适配器 | Validate PASS；Invoke 被拒绝（exit 3）；测试进程 `exit=0` |
| Codex 静态投影 | Build + Validate `exitCode=0` |
| Claude 静态投影 | Build + Validate `exitCode=0` |
| 发布包装配 | `status=BUILT`，19 文件，0 违规 |

## 未验证项

- CI 工作流未在真实 GitHub runner 上执行过（本地仅校验 YAML 合法、8 个 step）。
- 真实宿主 discovery / trust / fresh-session smoke。
- zip 的跨平台解包行为（仅在本机 Windows 验证）。

## 附：提交后复验（2026-09-10，HEAD `b58946f`）

第二轮成果已提交（`5f7d60d`、`399adc8`、`c257ac0`、`50aca5b`、`b58946f`）。提交后复跑全套门禁：

| 门禁 | 结果 |
|---|---|
| 发布 NOTICE 门禁 | PASS，5 个 runtime 项 |
| Vibe Hook 适配器测试 | PASS（进程退出码 0；被拒绝执行返回 3 为预期） |
| Codex 静态投影 | PASS，`manifestSha256=eb0d35dc…` |
| Claude 静态投影 | PASS，`manifestSha256=d13867f8…` |
| 发布包装配（Both） | BUILT，19 文件，0 违规，`zipSha256=93a9de0e…` |

说明：上表 manifest/zip SHA 与本文前面的记录不同，原因是投影 manifest 会记录构建时的 git revision；
提交后 HEAD 由 `7a76866` 变为 `b58946f`，因此 manifest 字节与 zip 哈希随之变化。这是预期行为，不是漂移。

提交后完整性核对：catalog 82 条记录中 78 条可寻址且 SHA-256 与 `sourceSha256` 全部一致；
4 条 Matt 记录（`ask-matt`、`code-review`、`implement`、`tdd`）的 SKILL.md 按
`tasks/20260910-matt-clean-snapshot.md` 的既有策略未进入快照（4 个未提交文件不导入）。
