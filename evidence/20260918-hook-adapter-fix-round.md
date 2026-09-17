# 证据：Hook 适配器修复批次（60f86d5 收尾：3×P1 + 3×P2，含回归用例）

- 日期：2026-09-18
- 性质：上一批次（20260917-auto-record-batch.md）提交 60f86d5 的复核收尾，修复审计确认的缺陷
- **测试状态：全绿（2026-09-18 实跑）。** 上一批次因 shell 故障（`D:\Git\bin\bash.exe` spawn
  ENOENT）只做了逐行静态复核；本次恢复后已实跑：
  - `node --check adapters/vibe-hooks/experience-recorder.mjs` → 通过；
  - `pwsh -NoProfile -File tests/test-vibe-hook-adapter.ps1`（PowerShell 7.6.3）→ exit 0，
    汇总行 PASS（hard-gate-v1 全链：capture + autoRecord 注入 + recorder 闭环 + 政策治理 +
    Stop 自检硬门禁 + 白名单 + 幂等）。本批新增/重写用例 4f、5-0、5c-1、5d-5、5e-3、5f、5f-2
    全部在套件内且通过（套件为 fail-fast 风格，任一断言失败即非零退出）。
    一次全绿，未修改任何被测代码或用例。

## 1. P1 修复（按严重序）

1. **注入 record 模板缺 `--source-dedup-key`**（runner 原 488/328 行）：record 路径照模板执行
   永不消化源信号 → 未消化计数恒 >0 → Stop 门禁每会话拦满 3 次 + 教训被跨会话重复记账。
   两处模板均已补参数（autoRecord 注入带真实 `$dedupKey`；门禁理由带占位指引 + 指向索引行）。
   回归：5c-1 断言注入 record 模板含 `--source-dedup-key <真实key>`；5e-3 断言门禁理由含该参数。
2. **Stop 门禁状态目录缺失时整体失效**（runner 原 324 行）：计数器 `WriteAllText` 抛
   DirectoryNotFoundException，先于 block 输出，被 `catch{exit 0}` 静默吞掉。修复：写状态前
   确保目录存在（路径被同名文件占位时显式抛错走 fail-open）；catch 改为放行但留审计
   （状态目录不可用时退系统 TEMP 的 `stop-gate-audit.log`）。
   回归：5f（冷启动目标无状态目录 → 必须仍输出 block 且计数器落盘）；5f-2（状态目录被文件
   占位 → fail-open 放行且 TEMP 审计增长）。
3. **recorder 清扫后重放崩溃**（experience-recorder.mjs 原 578-579 行）：govern 清扫后
   `processedEvents` 保留事件而 `experiences[]` 已移除条目，重放同 eventId 时 `find()` 得
   undefined，取 `.tier` 直接 TypeError，且崩溃点在消化标记写入之前 → 信号永不消化。
   修复：`experiences` 未命中时查 `archived`，两者皆无按「经验已被清扫」幂等成功处理
   （`swept:true`、count/tier=null、只消化源信号、台账零改动、不恢复计数）。
   回归：5d-5（清扫 EXP-001 后原 payload 重放 → exit 0、replay+swept、旧 dedupKey 标记落盘）。

## 2. P2 修复

1. **安装器 StrictMode 崩溃**（原 161/194/221/252 行）：对用户既有 hook 组裸取 `$_.command`
   /`$_.hooks`，形状不可信时崩掉安装/卸载。新增 `Test-RunnerMarkedGroup`（属性存在性先行），
   三宿主注册去重与 `Remove-HostRegistrations` 全部改走该助手。
   回归：5-0（预置缺 command/hooks 键的异形条目 → 安装成功且原条目保留）；卸载断言循环同步加固。
2. **无 dedupKey 旧索引行永久 pending**：新增 `Get-LegacyLineKey`（行内容 sha256 前 40 hex，
   `legacy-` 前缀，恶意行同样无法路径逃逸）。Digest 维护命令为旧/损坏行打 legacy 标记消化；
   pending 计数同口径。Digest 输出改为 `marked/already/legacy/legacyAlready`（原 `unmarkable`
   语义取消——所有行现在都可标记）。契约 `digestion.dedupKeyValidation` 同步改写。
   回归：4f 重写（legacy 计数链 + 全消化后 SessionStart 不得再报 PENDING + 恶意行不得逃逸状态目录）。
3. **仓库态注入不存在的 recorder 路径**：runner 原 `Join-Path $scriptDir` 在仓库态指向
   `scripts/experience-recorder.mjs`（不存在）。改为跟随契约副本目录（安装态=runner 目录，
   仓库态=`adapters/vibe-hooks/`），三处 handler 局部赋值删除、脚本级单点定义。
   回归：5c-1 断言注入文本里的 recorder 路径 `Test-Path` 通过。

## 3. 文档同步

- `adapters/vibe-hooks/contract.json`：`digestion.dedupKeyValidation`（legacy 标记语义）、
  `events.Stop.behavior`（状态目录按需创建、门禁异常留审计 TEMP 兜底、指令含 --source-dedup-key）。
- `skills/event/experience-elevator/RUNTIME-NOTES.md`：门禁异常「静默放行」→「放行但留审计」、
  record 模板必带源键、Digest legacy 兜底、清扫后重放语义。

## 4. 复核发现（git 级，未闭环）

- 60f86d5 为 HEAD（reflog 确认，含完整哈希 60f86d5158d6…，提交信息与本批次三段一致）。
- **【已实证 2026-09-18】`git show 60f86d5 --stat` 结论：实际 8 个文件，既不是原清单的 6，
  也不是预估的 7**。原清单 6 文件之外，随提交一并入库的有两个：
  1. `evidence/20260917-auto-record-batch.md`（117 行）——提交信息第 6 条引用的证据文件，
     确认已入库、非悬空，无需补救；
  2. `provenance/CANONICAL-CATALOG.json`（±7300 行）——由生成器再生的统一决策投影
     （契约 v2 变更后的正常再生），符合「只再生、不手工编辑」规则。
  工作区当前未跟踪文件仅 `evidence/20260918-hook-adapter-fix-round.md`（本文档），随本次修复提交入库。

## 5. 回归用例执行口径

- `pwsh tests/test-vibe-hook-adapter.ps1`（Windows 无 pwsh 时自动回退 `powershell`，Linux CI 亦兼容）。
- 本批新增/重写：4f（legacy 消化链）、5-0（异形既有 hook 条目）、5c-1（模板带源键 + recorder
  路径存在）、5d-5（清扫后重放）、5e-3（门禁理由含源键）、5f/5f-2（门禁冷启动 + 异常审计）。
- 预期结果：exit 0；Digest 输出断言依赖本批的新输出格式（`legacy/legacyAlready`）。
