# Task 20260910-provenance-integrity-gate

状态：accepted（主 Agent 本地复验）

## 唯一目标

把「来源快照未被篡改 / 与来源一致」从一次性审计结论变成可重复强制属性，并接入单入口验证。

## 不做事项

- 不修改三个源项目（全程只读来源）。
- 不手工修改 `sources/`、`governance/sliver-core/` 任何快照文件。
- 不新增分类真源：快照清单从已有导入记录派生。
- 不把「当前现状」直接写成基线（基线必须有来源背书）。
- 不声称宿主行为或运行时可用性已验证。

## 允许写入

- 新增 `scripts/provenance-integrity.ps1`（共享模块）
- 新增 `scripts/record-provenance-integrity.ps1`（基线记录器，fail-closed）
- 新增 `provenance/PROVENANCE-INTEGRITY.json`（记录）
- `scripts/verify.ps1`（新增「来源快照完整性」步骤）
- `evidence/20260910-provenance-integrity-gate.md`、本任务包
- `docs/HANDOFF.md`（记录新门禁）

## 验收与停止条件

- 正常状态下 `verify.ps1` 全绿（pwsh 7 与 Windows PowerShell 5.1 均通过）。
- 篡改任一快照文件 → `verify.ps1` 失败且**指名漂移路径**。
- 篡改状态下记录器必须拒绝写入基线（非 0 退出）。
- 树摘要跨 PowerShell 版本一致。
- 来源仓库不被修改（只读）。

## 主 Agent 验收记录

- 验收时间：2026-09-10
- 先测量：905/905 快照文件与来源逐字节一致；来源 git 状态与导入记录一致（Sliver clean@rev / Matt 恰好 4 脏文件@rev / Vibe 非 git）。
- 复验 1：`verify.ps1` pwsh 7 = 7/7、Windows PowerShell 5.1 = 7/7（后者顺带证明树摘要跨版本一致）。
- 复验 2：篡改 `sources/mattpocock-skills/README.md` → `verify.ps1` 失败，报 `README.md (content-vs-source)`；`VERIFY_EXIT=1`。
- 复验 3：同一篡改 → 记录器拒绝（`PROCESS_EXIT=1`，原因正确）；还原后记录器 `EXIT=0`。
- 复验 4：还原后 SHA 回到 `fb9eef1a…`，`git status` 显示该文件无改动。
- 决定：本任务 accepted。限制：来源层校验仅在本机来源可用时执行（CI 只跑自证层）；Sliver 白名单覆盖 151/223 文件。
