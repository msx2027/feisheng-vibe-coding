# Task 20260910-release-package-and-ci

状态：accepted（主 Agent 本地复验）

## 唯一目标

1. 构建发布候选包：把 Codex/Claude 静态投影 + 随包 NOTICE 文件装配成 zip，且以发布 NOTICE 门禁为前置（fail closed）。
2. 把发布 NOTICE 门禁接入 CI。

## 不做事项

- 不安装或写入真实 Codex/Claude 目录；不声称宿主可用或 fresh-session 已验证。
- 不把静态包写成发布授权。
- 不手工创建或挑选许可证文件（只按门禁映射路径程序化复制）。
- 不新增第三方依赖。
- 不修改三个源项目、`sources/` 快照、`CANONICAL-CATALOG.json`。

## 允许写入

- `scripts/build-release-package.ps1`
- `.github/workflows/release-gate.yml`
- 6 个脚本的 UTF-8 BOM（`build-claude-runtime-projection.ps1`、`runtime-projection-guard.ps1`、`validate-release-notices.ps1`、`import-vibe-source.ps1`、`invoke-vibe-hook-adapter.ps1`、`tests/test-vibe-hook-adapter.ps1`）
- `evidence/20260910-release-package-and-ci.md`
- `tasks/20260910-release-package-and-ci.md`

## 验收与停止条件

- 装配成功产出 zip，包含 NOTICE.txt + RELEASE-MANIFEST.json + 干净的 codex/claude 投影 + 随包许可证。
- 门禁失败时装配必须 fail closed（不产出包）。
- 包内不含 Vibe 运行时文件、blocked 技能、生成镜像或 Hook 段。
- 包内投影可被 `-Mode Validate` 重新校验通过。
- CI 工作流 YAML 合法，且逐步接入 NOTICE 门禁、Hook 禁用测试、双投影、装配。
- 输出不得声称发布授权或宿主可用。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 复验 1：`-TargetHost Both` 装配成功（pwsh 7 与 Windows PowerShell 5.1 各一次），19 文件、0 违规、`noticeGateStatus=PASS`。
- 复验 2：包内 Codex/Claude 投影 `-Mode Validate` 均 `exitCode=0`。
- 复验 3：BOM 修复后 3 个已跟踪脚本非 BOM SHA 与 HEAD blob 完全一致；两套 PowerShell 下门禁/投影均通过。
- 复验 4：`.github/workflows/release-gate.yml` YAML 解析通过，8 个 step。
- 决定：本任务 accepted；CI 未在真实 runner 执行、宿主 fresh-session 仍 `UNVERIFIED`，留待后续。
