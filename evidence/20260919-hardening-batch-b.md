# 证据：v2 工程化加固批 B——Stop 收工凭据（contractVersion v5 → v6）

- 日期：2026-09-19
- 上游任务包：`tasks/20260919-v2-hardening-plan.md`（§6 批 B、§7 终局条款义务）、`tasks/20260919-v2-hardening-implementation.md`（批 B 章节 B0-B5）
- 授权记录（B0）：owner 会话 2026-09-19 指示「创建三个会话进程协调 ABC 三批执行」，由总指挥转达为本批（Stop 收工凭据）执行指令。行为扩展=契约变更，授权路径先例：`evidence/20260917-auto-record-batch.md` §7（hard-gate 同为 owner 会话拍板 + 本目录证据落档）。本文件即本批授权与执行的落档点。

## 1. 范围与边界（如实声明）

- 本批只碰四个文件：`scripts/invoke-vibe-hook-adapter.ps1`、`adapters/vibe-hooks/contract.json`、`tests/test-vibe-hook-adapter.ps1`、本证据文件。
- 未跑 `install-vibe-hooks.ps1`、未查找/联系任何目标项目（`.feisheng` 目录）、未取 fresh-session 冒烟——激活与 per-target 重装冒烟归总指挥落地阶段（owner 提供目标清单后）。
- 未跑 `verify.ps1` / `build-canonical-catalog.ps1` / `build-capability-index.ps1`（本批禁令）；未做任何 git add/commit/push。
- `experience-recorder.mjs` 与 `install-vibe-hooks.ps1` 不在本批文件边界内，未改动（影响见 §6）。

## 2. B1 收工凭据 schema（定稿）

```json
{
  "verification": [{ "command": "<实际执行的验证命令>", "exitCode": 0, "outputDigest": "<关键输出摘要>" }],
  "scope": { "declared": ["<本任务声明的文件边界或来源声明>"], "outOfScope": [] },
  "findings": { "deferred": 0, "rejectedWithReason": 0 }
}
```

- `verification`：数组且至少 1 项；每项 `command` 非空字符串、`exitCode` 数值、`outputDigest` 非空字符串。
- `scope`：对象；`declared` 非空字符串数组、`outOfScope` 数组（可为空）。
- `findings`：对象；`deferred`、`rejectedWithReason` 均为数值（新发现未当场处理条数 / 评估后不采纳条数）。
- **scope.declared 的两个声明源**（写进凭据义务文本与契约 `stopCredential.scopeDeclaredSources`）：
  1. dev-builder 流 = dev-plan 的「不做边界/停止条件」字段；
  2. 普通任务 = sliver-core Operating Law 的 declared file boundary（该句由批 A 并行落地；本批只在契约文本里引用其语义，不依赖其文件、不产生第二份声明）。
- 载体：`<TargetRoot>/.feisheng/vibe-hook-state/stop-credential-<sessionId>.json`，由会话 AI 收工前写入（已在白名单状态目录内，零新增写入面；sessionId 与 selfcheck ack 同规则消毒）。

## 3. B2 适配器改动（`scripts/invoke-vibe-hook-adapter.ps1`，+80/-10）

1. 新增 `Test-StopCredentialShape`：只验存在与形状（沿用 10 秒存在性检查预算，不重跑命令、不验真伪）；读取/解析/取值任何异常一律按形状不合格（fail-closed on shape）。
2. `Assert-Contract` 增加完整性不变量：Stop 启用必须声明 `stopCredential` 节（缺一 fail-closed，与 contextInjection/recorder 配对先例同型）。
3. Stop 门禁放行条件由 `pending==0 且 hasAck` 扩为 `pending==0 且 hasAck 且 credOk`（凭据为新增第三条件，既有条件不删）。
4. 拦截理由改为按「剩余义务」拼接（未消化信号 / 凭据缺失或形状不对 / 未自检留痕三段自由组合）：一次拦截给全图景，避免 AI 分次补齐烧掉 3 次封顶预算。原 L344/346 两条 block 理由文本全部改为要求凭据（凭据段含完整 schema、落盘路径、声明源与 findings 记账说明）。
5. `stop_hook_active=true` 直接放行语义不变；每会话 3 次拦截 fail-open 封顶 + 审计不变；门禁异常 fail-open（TEMP 兜底审计）不变；状态目录冷启动建目录逻辑不变。未新增任何重试层。
6. SessionStart 常备义务文本（auto-record 契约 here-string）：原第 2 条自检义务保留（尾句改为留痕），新增第 3 条收工凭据义务（schema + 两个声明源 + 只验形状不验真伪 + 3 次封顶），原 3)-6) 顺延为 4)-7)。

## 4. B3 契约同步（`adapters/vibe-hooks/contract.json`，+21/-6）

1. **版本号**：新增显式 `contractVersion` 字段 = `v6`（此前版本为证据叙述制：v2 sedimentation / v3 auto-record / v4 autonomous / v5 hard-gate）。`status` 串保持 `enabled-experience-hard-gate-v1` 未动——该串被 `install-vibe-hooks.ps1` L79（越界文件）引用，bump 会破坏安装校验，故版本承载在 `contractVersion` 字段。
2. `enablementScope` (c)：Stop 硬门禁三条件（未消化信号 / 未自检留痕 / 凭据缺失或形状不对）。
3. 新增 `stopCredential` 节：introduced / carrier / schema / **hookBoundary** / scopeDeclaredSources / enforcement / degradation。
4. `events.Stop.behavior`：重写为三条件 + 凭据只验存在与形状 + 真伪由 CI 复跑兜底 + 封顶与 stop_hook_active 不变。
5. `enablePrerequisites`：`hook-fresh-session-smoke` 注明 v6 使既有 per-target 冒烟证据失效、重装+重冒烟前各目标一律报 `UNVERIFIED`；`event-order-and-concurrency-smoke` 追加 2026-09-19 凭据用例 PASS；`approved-write-whitelist-and-rollback-plan` 注明零新增写入面。
6. `rollback` 新增 `credentialGateDegradation`（见 §6），并写明凭据扩展完整回退 = 回到 v5 语义（删 `stopCredential` 节、还原 Stop.behavior 文本、目标项目重装）。

## 5. B4/B5（回归部分）用例清单与运行结果

`tests/test-vibe-hook-adapter.ps1`（+50/-5）：

| 用例 | 场景 | 断言 | 结果 |
|---|---|---|---|
| 5e-1（扩展） | 无信号+无留痕+无凭据 | block 理由含 selfcheck 指令与收工凭据指令 | PASS |
| 5e-2（重写） | selfcheck 留痕后 | 仍拦、理由只剩凭据段（不含「未消化」）；写入合格凭据后放行零输出 | PASS |
| 5e-3~5e-6（既有） | 未消化信号 / stop_hook_active / 3 次封顶 / 恶意 sid | 原断言不变全过 | PASS |
| 5g-1 | **凭据缺失** | block，理由含凭据 schema、落盘路径、declared 声明源 | PASS |
| 5g-2 | **形状不对**（缺 verification） | block | PASS |
| 5g-3 | **形状不对**（exitCode 非数值字符串） | block | PASS |
| 5g-4 | **齐备**（合格凭据 + recorder selfcheck 留痕） | 放行，零输出 | PASS |
| 5g-5 | **3 次封顶**（凭据缺失场景下） | 第 4 次 fail-open 放行 + `stop-gate-audit.log` 留审计 | PASS |
| 全量既有段 | Validate/幂等/Digest/安装/篡改 fail-closed/junction/白名单边界 | 原断言不变 | PASS |

- 全量运行：`pwsh -NoProfile -File tests/test-vibe-hook-adapter.ps1` → **PASS，exit 0**（共跑 3 次：改造后、LF 还原后、契约登记后，均绿）。
- PS 5.1（Windows PowerShell）附加验证：`-Mode Validate` PASS；凭据三态（缺失→block / 形状不对→block / 齐备→pass）与单元素 verification 数组反序列化边界全部通过（与契约 `event-order-and-concurrency-smoke` 的 pwsh+PS 5.1 双跑口径一致）。
- 换行可复现性：编辑过程中 Edit 工具曾把三个文件整体转为 CRLF，已按字节级（0D0A→0A）还原为纯 LF；BOM 保持原状（两个 .ps1 带 BOM、contract.json 无 BOM）；`git diff --numstat` 确认无整文件重写（21/6、80/10、50/5）。

## 6. 降级路径（终局条款减法机制，登记于契约）

- **触发**：凭据门禁**连续 2 次误拦**且 owner 确认非违规。
- **动作**：降级为提醒模式——同一变更集内翻转契约 status 为提醒值 + runner 学会提醒态行为，事件记入 evidence 与契约状态字段；**不在其上叠层**。
- **登记位置**：`contract.rollback.credentialGateDegradation` 与 `contract.stopCredential.degradation`（两处同文义）。
- **完整回退**：契约还原 v5 语义（删 `stopCredential` 节、还原 Stop.behavior）+ 目标项目重装，门禁退回「未消化信号 + 自检留痕」两条件，与 v6 前完全一致。

## 7. 边界声明与诚实记录

1. **「钩子只能验形状不能验真伪」已写进契约文本**，原文：`stopCredential.hookBoundary` = "the Stop hook validates EXISTENCE AND SHAPE ONLY (fields present, types correct) within the same 10-second existence-check budget; it never re-runs the listed commands and CANNOT judge authenticity — credential truth is independently re-verified by CI (v2-hardening batch C). A project without CI gets a credential of ceremonial value only: a known, accepted boundary recorded here by design"；`events.Stop.behavior` 同义复述。真伪兜底归批 C 的 CI 独立复跑。
2. **自检留痕（selfcheck ack）保留未删**：实施文档 B1 称「一张凭据替代收工时刻三道重叠自检」；本批凭据已承载验证/范围/记账三字段语义，但 ack 标记（recorder `--action selfcheck` 产物）作为记账义务的防漂移留痕被保留——完全删除 ack 条件需改 `experience-recorder.mjs`（本批越界文件）。是否收拢为单凭据，留 owner 裁决；当前语义是「凭据为新增第三条件」，只加不减、无放松。
3. **A3 依赖**：普通任务的凭据 `scope.declared` 声明源（Sliver Operating Law declared file boundary）依赖批 A3 落地；A3 未落地前激活门禁会对普通任务假拦、烧掉「连续 2 次误拦降级」预算——契约 `hook-fresh-session-smoke` 已注明 activation 须在批 A3 落地之后（与任务包「落地串行」一致）。
4. **状态串未 bump**：`enabled-experience-hard-gate-v1` 被 installer（越界）引用；落地阶段若需状态代际推进，须与 installer 同一变更集处理。

## 8. 遗留风险

- 形状检查存在宽松处（诚实声明）：可数值化的字符串（如 `"exitCode":"0"`）会过数值检查；`declared` 条目为非字符串对象时不会被拒。这是「存在与形状」门禁的本分边界，不是 schema 验证器；伪造凭据本就只在「无 CI 项目」有仪式价值，真伪防线在批 C。
- 已装目标项目在重装前继续运行旧版 hook 副本（无凭据要求），重装后新会话会遇到新的凭据拦截——属预期行为扩展，落地阶段按 UNVERIFIED 口径逐目标重装+冒烟。
- `docs/需求变更.md` 等非 git 化目标若凭据 `verification` 无命令可填，会持续被拦——预期由「2 次误拦降级」机制兜底，owner 确认后走降级。

## 落地补记（总指挥，2026-09-19）：v6 fresh-session 冒烟

- 合成目标：`F:\tmp\smoke-v6-bnIm`（临时 git 仓库，已清理）；安装器返回 INSTALLED，runner/contract/recorder 三 SHA 记账，SessionStart/UserPromptSubmit/Stop 三事件接线。
- 冒烟：`claude -p`（严格 MCP 配置）真实会话执行 hello.txt 任务 → 收工时凭据门禁放行。
- 凭据实测：`stop-credential-*.json` 三字段齐备——verification 命令 `Get-Content …hello.txt` + exitCode 0 + outputDigest「内容为 'hi'，符合预期」；scope.declared=["hello.txt"]、outOfScope=[]；findings 双计数归零。AI 收工语：「✓ 收工凭据已写入 ✓ 经验自检已留痕」。
- 结论：v6 形状校验 + 三字段凭据在真实宿主 fresh-session 闭环成立。本机历史目标项目不存在（fs-agent 已不在盘上，全盘无 .feisheng 残留），首个真实项目安装时按 contract enablePrerequisites 重取本项目冒烟即可。
