# 20260910 Vibe 快照闭环证据

## 结论

任务 `20260910-vibe-snapshot-closure` 结论为 **accepted**。

- 绑定目标仓库基线：`699d53db84275a42ae8a2676b0dfe899e3f996ed`。
- 源目录：`F:/skiils工具/vibe-coding-skills`，无 `.git`，因此 `sourceRevision` 保持 `null`；源目录只读，未对其执行写操作。
- 正式快照：`sources/vibe-coding-skills`，实际文件数 `550`。
- 按批准白名单核对的文件数：`550`；缺失 `0`，快照额外文件 `0`。
- 逐文件 SHA-256：检查 `550`，不匹配 `0`。
- 源白名单树摘要与快照树摘要一致：`sha256:d74d2c5a535926b6d0595e48df33c3016487cad1e160346bcbf99e2e981799ca`。
- `.agents`、`.claude/skills`、`.claude/agents`、`.codex`、`MANIFEST.json`、`skills/ROUTING-MANIFEST.json` 均不在正式快照中。
- 正式快照中原有的 `skills/ROUTING-MANIFEST.json` 已移动到批准隔离根下的 `sources/_quarantine/vibe-claude-skills-mirror/formal-snapshot/ROUTING-MANIFEST.json`；移动前后 SHA-256 均为 `35a9b31ca7e07fc1297bdfdadb914f5782c72c711274a9e23ec7f4445234f758`。
- 当前 `scripts/import-vibe-source.ps1` 在复制 `skills` 目录后显式剔除该路由清单，因此 provenance 的 `reproducibleClosure` 为 `true`。

逐文件记录、排除路径状态、摘要和重建说明已写入 [`provenance/VIBE-IMPORT.json`](../provenance/VIBE-IMPORT.json)。

## 白名单口径

目录白名单来自导入脚本：`skills`、`agents`、`hooks`、`codex-hooks`、`feedback`、`tools`、`docs/legal`、`.claude/feedback`、`.claude/hooks`。

文件白名单为：`AGENTS.md`、`README.md`、`CLAUDE.md`、`package.json`、`settings.json`、`codex-hooks.json`、`.claude/CLAUDE.md`、`.claude/settings.json`。在目录白名单基础上，明确排除六项生成镜像或过期清单路径。

源目录全量文件数为 `1342`，其中 `792` 个文件不属于批准白名单；它们未进入正式快照。这个数字是来源目录的只读审计统计，不代表缺失。

## 实际命令与退出码

以下命令均在 2026-09-10、目标基线 `699d53db84275a42ae8a2676b0dfe899e3f996ed` 上执行；PowerShell 读取中文文件时显式使用了 `-Encoding UTF8`。

1. 读取任务包：

   ```powershell
   Get-Content -Raw -Encoding UTF8 'F:\skiils工具\feisheng-vibe-coding\tasks\20260910-vibe-snapshot-closure.md'
   ```

   退出码：`0`。

2. 读取导入脚本并检查当前剔除逻辑：

   ```powershell
   Get-Content -Raw -Encoding UTF8 'F:\skiils工具\feisheng-vibe-coding\scripts\import-vibe-source.ps1'
   ```

   退出码：`0`。脚本当前包含 `generatedPaths`、`skills/ROUTING-MANIFEST.json` 和 `Remove-Item -LiteralPath $generatedPath`，所以全新目标导入会得到过滤后的正式快照。

3. 将正式快照中的过期清单移动到批准隔离区，并校验移动前后哈希：

   ```powershell
   Move-Item -LiteralPath 'F:\skiils工具\feisheng-vibe-coding\sources\vibe-coding-skills\skills\ROUTING-MANIFEST.json' -Destination 'F:\skiils工具\feisheng-vibe-coding\sources\_quarantine\vibe-claude-skills-mirror\formal-snapshot\ROUTING-MANIFEST.json'
   ```

   退出码：`0`。移动前后 SHA-256：`35a9b31ca7e07fc1297bdfdadb914f5782c72c711274a9e23ec7f4445234f758`。

4. 只读重算批准白名单、正式快照计数、逐文件 SHA-256、排除路径和树摘要，并写入 `provenance/VIBE-IMPORT.json`。

   退出码：`0`。输出摘要：

   ```json
   {"snapshotFiles":550,"allowlistFiles":550,"sha256Checked":550,"sha256Mismatches":0,"snapshotMissing":0,"snapshotUnexpected":0,"excludedPresent":[],"snapshotTreeSha256":"sha256:d74d2c5a535926b6d0595e48df33c3016487cad1e160346bcbf99e2e981799ca","scriptExplicitlyRemovesExcludedRouteManifest":true,"validationStatus":"accepted"}
   ```

5. 解析 provenance 并确认机器可读字段：

   ```powershell
   $record = Get-Content -Raw -Encoding UTF8 'F:\skiils工具\feisheng-vibe-coding\provenance\VIBE-IMPORT.json' | ConvertFrom-Json
   ```

   退出码：`0`。`schema=feisheng-import-record/v2`，`snapshotFiles=550`，`fileRecords=550`，`sha256Mismatches=0`，`rebuildable=true`，`status=accepted`。

6. 重新读取 provenance 的 550 条记录，同时对源文件和快照文件逐一 `Get-FileHash -Algorithm SHA256`，并检查六项排除路径：

   退出码：`0`。输出：

   ```json
   {"actualSnapshot":550,"expectedSnapshot":550,"checked":550,"missing":0,"mismatch":0,"excludedPresent":0,"result":"PASS"}
   ```

7. 校验源目录清单与隔离副本存在且哈希相同：

   退出码：`0`。输出：

   ```json
   {"sourceExists":true,"quarantineExists":true,"sourceSha256":"35a9b31ca7e07fc1297bdfdadb914f5782c72c711274a9e23ec7f4445234f758","quarantineSha256":"35a9b31ca7e07fc1297bdfdadb914f5782c72c711274a9e23ec7f4445234f758","identical":true}
   ```

8. 检查授权范围内的工作树变更：

   ```powershell
   git -C 'F:\skiils工具\feisheng-vibe-coding' status --short --untracked-files=all -- 'provenance/VIBE-IMPORT.json' 'evidence/20260910-vibe-snapshot-closure.md' 'sources/_quarantine/vibe-claude-skills-mirror/formal-snapshot/ROUTING-MANIFEST.json' 'sources/vibe-coding-skills/skills/ROUTING-MANIFEST.json'
   ```

   退出码：`0`。本任务新增或更新的目标文件为 provenance、evidence 和批准 quarantine 下的移动副本；正式快照中的源清单路径已不存在。

## 未验证项与边界

- 未在全新临时目标目录上重新执行完整导入脚本；本次使用当前脚本的显式剔除逻辑检查，加上现有快照的逐文件重算，证明当前 provenance 可重建，但未伪造一次完整 fresh import 的运行日志。
- 未执行 runtime projection、安装、宿主 Hook 或 fresh-session smoke；这些不属于本任务验收范围，仍保持 `UNVERIFIED`。
- 源目录不是 Git checkout，无法提供源 Git commit；因此不能把 `sourceRevision=null` 解读为源内容已提交或不可变。
- 本证据不声明 Matt 技能迁移、runtime projection 或真实新聊天线程创建/归档。

## 变更摘要

- 更新：`provenance/VIBE-IMPORT.json`，写入 550 条逐文件 SHA-256、白名单计数、排除状态、树摘要和重建字段。
- 新增隔离副本：`sources/_quarantine/vibe-claude-skills-mirror/formal-snapshot/ROUTING-MANIFEST.json`。
- 新增：本证据文件。
- 共享工作区中的 `scripts/import-vibe-source.ps1` 在本 worker 复核期间已包含路由清单剔除逻辑；本 worker 未编辑或回滚该文件，仅按其当前内容验证可重建性。
