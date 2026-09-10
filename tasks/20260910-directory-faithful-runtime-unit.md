# Task 20260910-directory-faithful-runtime-unit

状态：accepted（主 Agent 本地复验 + 三个反例 + fresh clone 验收）

## 唯一目标

把 runtime 单位从「每条记录一个已批准文件」升级为「目录忠实的显式白名单」，
让被接受的技能在投影里带上它引用同目录文件（`reference/`、`templates/`、`scripts/`、同级格式文件），
同时**不**破坏「显式白名单」语义，也**不**把宿主编排资产或控制面整棵树带进 bundle。

## 不做事项

- 不让控制面 `governance/sliver-core/` 变成目录单位（那棵树含 hooks / packaging / tests，应保持单文件）。
- 不把 `agents/`（宿主编排与插件资产）纳入投影；被排除的路径必须记录以便审查。
- 不放宽任何既有门禁（禁止段、blocked 排除、写权限排他、NOTICE、保真树换行）。
- 不做宿主安装或 fresh-session smoke（不声称行为已验证）。
- 不做路由绑定（另一件事；当前 0 条绑定）。
- 不手工编辑生成物（catalog / 能力索引）。

## 允许写入

- `provenance/SKILL-CLASSIFICATION.json`（`runtimePromotionPolicy.bundlePolicy`）
- `scripts/build-canonical-catalog.ps1`（bundle 枚举 + 逐文件 sha + 生成期 fail-closed + 输出 bundlePolicy）
- `scripts/runtime-projection-guard.ps1`（按 bundle 展开 filePlan + 从 catalog 策略取禁止段）
- `scripts/build-codex-runtime-projection.ps1`、`scripts/build-claude-runtime-projection.ps1`
  （禁止段来源收敛；manifest 的 controlPlane/accepted 按 id 聚合文件清单）
- `scripts/build-release-package.ps1`（禁止段来源收敛）
- `scripts/build-capability-index.ps1`（展示 runtime 单位与文件数）
- `scripts/verify.ps1`（内容完整性覆盖整个 bundle）
- `provenance/CANONICAL-CATALOG.json`、`docs/CAPABILITY-INDEX.md`（重生成）
- `packaging/runtime-projection.json`（去掉手工复制的文件清单，改为描述性 + 理由）
- `skills/README.md`（说明 runtime 单位是目录）
- `evidence/20260910-directory-faithful-runtime-unit.md`、本任务包、`docs/HANDOFF-NEXT.md`

## 验收与停止条件

- 被接受技能的同目录引用文件全部出现在投影里；控制面仍为单文件。
- catalog 每条 accepted 记录带 `bundle`（scope/root/files（逐文件 sha256）/excluded），
  且 `bundle.files` 必含记录自身文件、其 sha 等于 `sourceSha256`。
- 禁止段列表只有一处定义（classification → catalog.bundlePolicy），三个消费者都读生成物。
- 反例实测：引用文件漂移被拒；目录内新增未登记文件导致 catalog 不同步；目录内出现 `hooks/` 段时生成器 throw。
- `pwsh scripts/verify.ps1 -IncludePackage` 全绿；fresh clone（多种 `core.autocrlf`）仍全绿。

## 主 Agent 验收记录

- 验收时间：2026-09-10。
- 复验 1：catalog 8 条 accepted 记录全部带 bundle；7 条 `scope=directory`、控制面 1 条 `scope=file`；
  bundle 文件总数 16（原 8）；`agents/openai.yaml` ×3 被排除并记录在 `bundle.excluded`。
- 复验 2：Codex 投影 Build = PASS，13 → **20** 文件（16 runtime + 3 host facts + manifest）；
  `accepted` 段按 id 聚合并列出每个文件；`exclude.forbiddenSegments` 来自 catalog 策略。
- 复验 3：发布包 32 → **48** 文件、0 禁止段违规；`exclusions.forbiddenSegments` 来自 catalog 策略。
- 复验 4（反例）：改动 `critique/reference/personas.md` → `verify: 7/10`。
- 复验 5（反例）：`skills/checker/audit/` 新增 `EXTRA.md` → `verify: 9/10`（catalog 新鲜度），
  且生成器确实把新文件纳入 bundle（不会静默漏掉）。
- 复验 6（反例）：`skills/checker/audit/hooks/probe.json` → 生成器 throw「落在禁止路径段 'hooks'」。
- 复验 7：`verify.ps1 -IncludePackage` **11/11 PASS**（`pwsh` 与 Windows PowerShell 5.1）。
- 验收时间：2026-09-10。
- 复验 8（本批次引入并修复的缺陷）：目录忠实改完本机 11/11，但 fresh clone（`autocrlf=true`）**10/11** ——
  生成器里一个多行字面字符串使 catalog 的字符串值继承脚本源码换行，而 `scripts/**` 无属性规则 →
  修法：catalog 的 note 改从 classification 读 + `.gitattributes` 新增 `scripts/** text eol=lf`；
  修后 fresh clone 三种配置均 11/11。
- 决定：本任务 accepted。遗留：宿主 trust/行为/Hook `UNVERIFIED`；路由绑定仍 0 条。
