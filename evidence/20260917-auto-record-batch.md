# 证据：经验自动记账批次（auto-record-v1 → autonomous-v1 → hard-gate-v1）——契约 v3/v4/v5、注入接线、experience-recorder、三宿主安装、政策制治理、Stop 硬门禁

- 日期：2026-09-17
- 授权：owner 在会话中拍板（触发范围=宽采集严判断；写入方式=本地记录器脚本；清理权限=提议+确认；宿主=claude/zcode/codex 全接，批次1+2 连做）
- 范围：`adapters/vibe-hooks/contract.json`（status → `enabled-experience-auto-record-v1`）、
  `scripts/invoke-vibe-hook-adapter.ps1`、`adapters/vibe-hooks/experience-recorder.mjs`（新增，包原创零依赖 Node）、
  `scripts/install-vibe-hooks.ps1`（多宿主）、`tests/test-vibe-hook-adapter.ps1`（新增 5c 段）、
  `skills/event/experience-elevator/RUNTIME-NOTES.md`（接线生效注记）

## 1. 交付内容

- **捕获→注入**：UserPromptSubmit 命中纠错词表后，索引行追加 `eventId`（EVT-<dedupKey>）与
  `promptHash`（sha256 全长），并以 `hookSpecificOutput.additionalContext` 注入 autoRecord 路由
  （含记录/消化命令模板）。台账未启用的项目 fail-closed：只报「未启用」，不注入 record 指令。
- **SessionStart**：注入常备自动记账契约（五条，含红线）+ 未消化提醒；无台账项目退化为只读提醒。
- **experience-recorder.mjs**：台账 v2 唯一机器写入器。动作 check/record/dismiss；
  expectedRevision CAS、eventId 幂等重放（payload 原样）/collision 拒绝、原子写（tmp+rename）、
  围栏外人工区原样保留、台账路径必须同时命中 `.vibe-docs.json` 登记与契约白名单（contract-gap 拒绝）、
  realpath 防 junction 越界；record/dismiss 自动消化源信号（<dedupKey>.digested）。
  signalType 固定 `explicit-correction`、scope 固定 `target-project`（与快照 ledger-core 镜像一致，
  保证未来自动化层接入无格式迁移）。**不升档、不退役**：达阈值仅输出 `atThreshold=true`。
- **安装器多宿主**：`-HostAdapter claude|zcode|codex|all`。zcode 合并写入 workspace
  `.zcode/config.json`（保留既有 mcp 键，`hooks.enabled:true`）；codex 写 `.codex/hooks.json`
  （snake_case 事件）；卸载清三宿主注册、保留经验数据。安装清单记录三件套 SHA 与 hosts。

## 2. 测试（本机全绿）

- `tests/test-vibe-hook-adapter.ps1`：exit 0。既有全段（幂等/过期重录/Digest/篡改 fail-closed/
  junction 负面用例/白名单边界）+ 新增 5c 段（注入 JSON 断言、recorder
  check→record→自动消化→replay no-op→CAS 拒绝、无台账不注入、人工区保留）。
- 附带修复两处测试基建问题：父进程 stdout 解码必须显式 UTF-8（否则中文后紧邻的 ASCII
  被 GBK 多字节对吞掉）；installer 哈希表缺键在 StrictMode 下须 `ContainsKey` 守卫。

## 3. fs-agent 实机安装与冒烟（三宿主）

- 安装：`install-vibe-hooks.ps1 -TargetRoot E:\fs-agent -HostAdapter all -Force` → INSTALLED。
  manifest SHA：runner `75ea8154…`、contract `88178e35…`、recorder `1a843dfb…`。
- 验证：`.zcode/config.json` 的 mcp 键保留且 `hooks.enabled=true`；`.codex/hooks.json` 生成
  snake_case 注册；`.claude/settings.json` 注册不变。
- 冒烟（宿主原样命令）：
  1) 捕获注入：exit 0，`hookSpecificOutput.hookEventName=UserPromptSubmit`，含 autoRecord 与
     record 命令模板，eventId `EVT-9147c1ee…`；
  2) SessionStart：注入契约 + `PENDING=1; TOTAL=1`；
  3) recorder `--action check` 真台账：revision 0，路径 `docs/项目治理/经验治理.md`。
- **真实收账（转正）**：台账人工登记区 2026-09-15 browser-use evaluate 教训由 recorder 收账为
  `EXP-001`（eventId `EVT-a57234a8f120b741f76f3ee4240297ddffb5804c`，revision 0→1，count 1）。
  人工区已补转正备注，围栏外内容原样。冒烟合成信号与状态目录已清理。

## 4. 未验证项 / 待办（不声明宿主强制生效，直至逐项补齐）

- **fresh-session 冒烟未做**：Claude Code / ZCode 需在 fs-agent 新开会话确认 Hook 真实触发与
  additionalContext 呈现；本批仅验证宿主将执行的命令本身。
- **Codex hooks.json schema 为镜像假设**（依据 owner `~/.codex/config.toml` 的 hooks.state 事件名）：
  注册已写入，capture-only 语义，注入未声明。待 Codex 实会话验证后另行补证。
- ZCode 的 `hookSpecificOutput` 注入格式与 Claude Code 同构为高置信假设（ZCode 文档声明
  additionalContext 注入 + 严格 JSON 校验）；若格式不符，宿主将丢弃输出（降级为采集-only），不阻塞。
- AI 返工自检（无 Hook 信号的第二条采集线）依赖注入的常备契约文本，未单独验证 AI 服从性。
- 批次 4（治理扫描器、全局台账、提议+确认工作流）未开工。

## 5. 回滚

- 目标项目：`install-vibe-hooks.ps1 -TargetRoot E:\fs-agent -Uninstall`（三宿主清注册，经验数据保留）。
- 仓库级：契约 status 翻回禁用值 → 所有 runner/recorder 实例 fail-closed。

## 6. 同日第二批次：零触发词自治 + 政策制治理（autonomous-v1）

- 授权：owner 会话拍板「AI 不需要用户说不对/搞错了，自己判断自己记录自己治理」+ 治理权限选「政策制自治」
  （清扫政策示例：L0 且 30 天未命中且计数<3 → 自动清扫，留痕可恢复；升格仍逐次确认）。
- 契约 status → `enabled-experience-autonomous-v1`；recorder 动作集扩展
  check/record/dismiss/**policy-add/policy-list/govern**；白名单新增清扫日志路径
  `docs/项目治理/经验治理-清扫.md`；新增契约 [governance] 节（政策围栏 + 清扫日志 + 升退役仍逐次确认）。
- **零触发词自检**：SessionStart 注入契约新增自检义务——AI 任务完成前自检自身返工/重试/方案推翻、
  用户重复请求、用户手动改写或撤销产出、用户放弃转向等行为信号，可复用即自行记录
  （`--prompt-material` 自造确定性事件身份，不依赖 hook 信号）。治理义务由 `check` 输出
  `governance.dueForReview` 驱动（>14 天未治理或台账增长 ≥5）。
- **政策制清扫**：政策存台账文件的政策围栏（` ```json vibe-experience-policies `，含
  confirmedBy/source 凭据）；`govern` 按政策清扫 L0 尘埃条目（tier/count/最近命中三元判定，
  最近命中取 processedEvents 绑定 occurredAt 最大值，无时间证据保守跳过），单事务 revision+1，
  条目完整进清扫日志，**ID 永不复用**（nextExperienceId 同时扫描台账与清扫日志）。
- **测试**：套件全绿（exit 0），新增 5d 段：自检义务注入断言、政策登记、未登记政策 govern 拒绝、
  老化条目清扫进日志、人工区保留、dueForReview 翻转、零触发词自造身份记录。
- **测试暴露并修复的真缺陷**：① policy-add 首次登记时写入空政策表（push 遗漏）；
  ② 清扫后新记录复用已清扫 ID（ID 扫描未含清扫日志）；③ 哈希表缺键 StrictMode 报错；
  ④ 测试父进程 GBK 解码吞 ASCII。全部以回归用例固化。
- **fs-agent 实机**：重装三宿主 INSTALLED（runner `e8ddb678…`）；真台账登记政策 P-001
  （凭据：confirmedBy=owner，source=owner 会话拍板 2026-09-17 政策制自治选项全文）；
  govern 非破坏运行（EXP-001 刚收账，0 清扫，符合预期）；SessionStart 注入含
  autonomous-v1/自检义务/治理义务/红线 四项验证通过。
- **仍未验证**：fresh-session 真实触发（Claude/ZCode 新会话）、Codex hooks schema、
  AI 对自检义务的实际服从率（模型行为，需真实使用观察）——在补齐前不声明宿主强制生效。

## 7. 同日第三批次：Stop 自检硬门禁（hard-gate-v1）

- 授权：owner 会话明确指示「把自检升级成 Stop-hook 硬门禁」——即解除原
  「Stop 事件与控制面治理重复故禁用」红线，将该事件重定义为经验自检强制（vibe 源 stop-gate 仍不移植）。
- 契约 status → `enabled-experience-hard-gate-v1`；`events.Stop` 启用（timeout 10s），
  behavior 记录门禁语义与授权来源；runner/installer 状态白名单同步。
- **门禁语义**（`Invoke-StopGateHandler`）：Stop 时（a）存在未消化纠错信号，或（b）本会话无
  `selfcheck` 留痕 → 输出 `{decision:block, reason:<可执行指令>}` 拦截会话结束；
  会话 id 为不可信输入（白名单字符外哈希 40 hex 防路径注入）；每会话拦截上限 3 次，
  超限 fail-open 放行并写 `stop-gate-audit.log`；宿主 `stop_hook_active=true` 直接放行；
  handler 任何异常静默放行（绝不困住会话）；除状态目录外零写入。
- **recorder 新增 `selfcheck` 动作**：自检留痕标记（`selfcheck-<sid>.json`），不要求台账存在。
- **安装器**：claude/zcode 注册 Stop（matcher 无），codex 显式排除（capture-only 语义不变）。
- **测试**：套件全绿（exit 0），新增 5e 段：首次拦截、selfcheck 放行、未消化拦截、
  stop_hook_active 放行、3 次封顶 fail-open 审计、恶意 sid 不逃逸。
- **fs-agent 实机冒烟**（宿主原样命令）：首次 Stop 拦截（自检指令）→ selfcheck 后放行 →
  捕获信号后拦截（未消化指令）→ dismiss 消化后放行 → 干净路径复核（拦截→消化+留痕→放行）。
  冒烟残留已清理，last-govern 标记保留，台账 revision=1、EXP-001、政策 P-001 不变。

## 8. 已知边界（硬门禁不改变的部分）

- 硬门禁能**确定性强制**的是：已捕获信号必须被消化、每会话必须自检留痕。
  「AI 是否真的发现了自身错误」仍是模型判断（门禁把它从可选变成必答题，但不保证答案质量）。
- Stop 门禁每轮结束会触发一次 runner（Windows PS 启动数百毫秒量级），属可感知但可接受的开销。
- Codex 会话不受门禁约束（capture-only）；ZCode 的 Stop continuation 上限为宿主侧 3 次，
  与门禁自身 3 次封顶独立生效。
