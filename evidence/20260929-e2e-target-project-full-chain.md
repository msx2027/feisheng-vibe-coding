# E2E 目标项目真机七层全链路实测（sess-find）

日期：2026-09-29 · 批次：独立 Goal（owner 拍板：七层全链路+抽查 / 只测 ZCode / 要测拒绝路径 / 缺陷只登记不修）
目标项目：`F:\skiils\sess-find`（纯本地 git，与工厂仓平级，不推远端；真实交付物 = 跨 ZCode/Claude Code/Codex/pi 四源会话速查 CLI `sf`，零依赖 Node，16 测试用例，已 `npm link` 全局可用）

## 目的

在工厂包之外真实开发一个小项目，验证 `feisheng-vibe-coding` 各层功能能否被正常触发——重点打 README 保持 `UNVERIFIED` 的面（宿主激活、启动动作、目标装配），不重复工厂自有单测已覆盖面（ledger-core/closure/anchor）。

## 七层结果

| 层 | 功能 | 结果 | 新鲜证据 |
|---|---|---|---|
| 1 | 宿主激活入口技能 + 启动动作四步 | PASS | Skill 经 junction（生产安装态）激活；控制面 SKILL.md/runtime-adapter 读取；startup 动作顺序执行 |
| 2 | 目标项目自动装配（热点门禁+密钥护栏） | PASS | 空项目新装 11 模块 + 护栏 2 文件 + pre-commit 两道接线 + 双首检基线；**二次运行幂等**（新装 0/一致 13/接线跳过） |
| 3 | init-target-runtime 运行件 | PASS* | `--write` 写 AGENTS.md/CLAUDE.md/.vibe-runtime.json，`--check` 全 PASS 退出 0。*裸调用被 finding F1 阻断，显式 `--skills-root` 通过；fail-closed 方向正确 |
| 4 | 控制面路由 + 正向开发 | PASS | route-catalog 确定性投影 22 路由；选定 开发执行·implement（D1/T2）；严格 TDD 16 用例**先红（12+4 断言级失败）后绿**；真实数据冒烟：全源「密钥」356 命中、四源各活、`--json`/`--agent`/退出码契约全过；真实提交穿门禁落账 |
| 5 | 门禁拒绝路径（owner 点名要测） | PASS×4 | ①高置信假密钥（FALLBACK-AWS-KEY 形态）→ 提交阻断退出 1，**不进基线**；②低置信通用赋值形态 → 警告+进基线+放行；③1500+ 行文件 → 热点 blocker=2 拦截；④修复后重新提交 → 「修复剔除 1，基线存量 0」自动棘轮 |
| 6 | 纠错信号采集面（vibe-hooks） | PASS（装配面） | `install-vibe-hooks.ps1 -HostAdapter all` → 三宿主注册文件在位（.zcode/config.json `hooks.enabled:true` 实查）；记录器对缺 `.vibe-docs.json` **fail-closed**（`ledger-disabled`，不瞎写台账） |
| 7 | 工厂包自检 + 零污染 | PASS | `verify.ps1` **21/21 全绿**；工厂仓工作树全程干净，测试产物零回流 |

工厂仓本批唯一写入 = 本证据文档（登记通道，owner 已批）。

## Finding 登记（只登记不修，处置等 owner 裁决）

### F1（P1）长寿命宿主进程的环境变量残留使 init-target-runtime 裸调用阻断

- 现象：裸调用 `init-target-runtime.mjs <target>` 报 `Invalid skills root: F:\skiils工具\vibe-coding-skills`（已删除旧盘路径）。
- 根因：本体 `skills/event/experience-elevator/tools/init-target-runtime.mjs:182` 解析顺序 `args.skillsRoot > process.env.VIBE_CODING_SKILLS_HOME > DEFAULT_SKILLS_ROOT`；9-29 a474a80 批已清**注册表**（Machine/User 均空，本批实查复核），但**长寿命 ZCode 进程环境**不热刷新，陈旧值继续传给全部子进程，重启宿主前一直命中。
- 缺陷点（两层）：①错误信息不提示值来自环境变量，排查绕路（先怀疑硬编码）；②受管块文案自己宣传「设置了 VIBE_CODING_SKILLS_HOME 就优先使用」，环境变量优先级设计放大陈旧值杀伤面。
- 建议方向（不实施）：错误信息附 env 来源提示；或文档声明 env 仅迁移期兼容、降其优先级。
- 自愈性：重启 ZCode 即消失；显式 `--skills-root` 不受影响。fail-closed 行为本体正确（拒绝坏根而非静默用错根）。
- **处置（同日）**：owner 拍板修复，报错来源提示已落地（零语义变更），见 `20260929-f1-stale-env-source-attribution.md`。

### F2（P3·观察，非工厂缺陷）ZCode 会话源中工具展示文本挂在 user 角色下

ZCode 库内 TodoWrite 等工具的展示文本以 `type:"text"` part 挂在 user 角色消息下，`sf` 检索会命中它们——「会话里出现过」≠「用户原话」。已在 sf README 记为已知边界。登记原因：未来做跨宿主经验采集/语义分析时，「用户输入」的判定口径在各宿主差异大，Codex 有注入包裹、ZCode 有工具文本混挂，不能按 role 一刀切。

## 保持 UNVERIFIED（owner 10 分钟 fresh-session 冒烟清单）

Hook 不热加载，以下只有真人新开会话才算数（本会话内模拟不新鲜）：

1. 在 `F:\skiils\sess-find` 目录**新开 ZCode 会话**，说「帮我看看这个项目」→ 预期：SessionStart 只读提醒出现（vibe-hooks 接线生效的可见信号）。
2. 同会话内对 AI 纠错一次（如「不对，重新弄」）→ 预期：`.claude/feedback/` 出现采集文件（UserPromptSubmit 采集生效）。
3. （范围外，顺手可测）Claude Code / Codex 在同目录各开一次新会话，重复第 1 步。

## 顺带交付

`sf` 全局命令（`npm link`）：`sf <词> [--agent zcode/claude/codex/pi] [--project x] [--days n] [--limit n] [--json]`；四源只读搜索、坏源不拖垮整体（显式指定坏路径报错、默认路径缺失安静跳过）；测试 16 用例 `npm test`。
