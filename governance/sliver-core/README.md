# Sliver Vibe Coding

Sliver Vibe Coding 是一套给 AI 使用的软件项目开发与治理 skill：用户只需说明想做什么、想改什么或遇到什么问题，AI 负责查清当前真相、找到正确 owner、完成技术设计，并在授权范围内实现、测试和验收。

它面向所有依赖 AI 推进真实软件项目的人，尤其适合已经遇到过反复修不好、项目写乱、mock 冒充完成、文档与代码冲突，或者无法独立判断架构、安全和上线质量的用户。

- **非技术用户**不需要学习代码、内部路由或测试术语。用户确认可见结果、成本和不可逆影响，AI 承担技术判断和验证责任。
- **技术用户**仍然获得 owner、contract、当前证据和风险控制，但不会因为安装了治理 skill 就让每个小任务都走完整流程。

Sliver 能覆盖一个局部修改，也能覆盖立项、接管、开发、救援、安全、验收、发布和交接。完整生命周期是能力范围，不是每次使用的固定成本。

## 官网与社区

长期社区入口：[https://openbeetles.com/](https://openbeetles.com/)

### 微信四群（当前推荐）

![微信群四群：甲壳虫 AI 编程交流](assets/wechat-group-4.jpg)

二维码有效期以图片显示为准，过期后会更新图片；长期入口请保存上方社区地址。

## 它解决什么问题

- AI 没查当前代码和运行态就开始猜，改完仍然不工作。
- 同一个概念散落在 UI、controller、配置、prompt 和临时脚本里，没有单一 owner。
- 连续修复失败后仍然重复补丁，没有回到架构和真源。
- 小改动被迫写一堆没有价值的测试，高风险改动反而缺少负向验证。
- mock、静态检查、旧日志或“代码已经写了”被当成真实完成。
- 技术选型、数据库、权限、支付、第三方和发布决策被甩给不会判断的用户。
- UI 在没有用户任务、信息层级或成熟参考的情况下堆卡片和解释文案；原型脱离已有项目随意改风格、丢在项目外；设计转代码时整图铺页面、机械切图，或无视现有组件、token、主题和响应式约束。
- 半成品项目、AI 生成项目或长上下文无法安全接管和继续。

## 直接使用

安装后直接用自然语言说目标，不需要命令，也不需要知道内部路由名称。

| 你可以直接说 | Sliver 会优先做什么 |
| --- | --- |
| 我想从零做一个客户管理系统 | 补齐用户、第一闭环、MVP、非目标和验收边界 |
| 我完全不懂技术，帮我决定技术栈和架构 | 先审计现有产品真源；缺关键事实时一次只问一个问题，联网核对官方证据后由 AI 给出唯一的技术栈＋架构组合 |
| 我接手了一个写到一半的项目，先别乱改 | 先做只读接管审计，确认启动基线、owner、真源和第一个安全任务 |
| 这个 TypeScript 报错帮我修了 | 复现失败边界，窄修相关 owner，复用编译或现有测试门禁 |
| 只调整按钮间距，不改交互 | 做局部非行为验证，不为了仪式新增测试代码 |
| 参考当前项目给这个新页面出一版 UI 原型 | 先锁定页面服务的用户任务、必要信息和成熟同角色参考，读取现有布局、组件、token、主题和设计真源，再把版本化原型落到项目内 `dev-docs/design/`；只有真实视觉冲突才询问 |
| 按这张设计图一比一还原到代码 | 先拆清组件、图标、图片、文字和状态语义，复用当前项目约束；不整图糊页面，也不擅自重设计 |
| 给用户增加一个只能看高级内容的角色 | 追到权限和数据 owner，补齐合同、负向测试和跨用户验证 |
| 线上用户表要加字段 | 主动进入强化治理，先确认迁移、数据影响、备份、回滚和验证 |
| 全面检查安全，发现问题先别改 | 执行只读安全审计，先报告证据、严重性和修复路线 |
| 上下文太长，换个窗口继续 | 生成包含 Git、运行态、验证、风险和下一步的可复制交接 |

Codex 用户也可以在需要排查命中时显式点名：

```text
Use $sliver-vibe-coding to 推进我的软件项目。
```

## 它会怎么工作

1. **确认结果和授权**：明确这次真正要获得什么、什么不能动、何时必须停下来确认。
2. **读取最小真相**：只检查当前请求需要的文件、owner、活跃文档、Git 和运行证据。
3. **按任务拓扑选择成本**：单 owner 任务窄查、窄改、窄验；多 owner 或基础变更才增加设计与真源。风险只追加命中边界的负向验证、授权和恢复控制。
4. **基础选型由 AI 决定**：技术栈和架构联合评估；资料不够就阻断，技术事实联网查一手资料，用户只确认成本、停机、迁移和不可逆影响。
5. **先改真正 owner**：共享语义进入核心 owner，UI、API、CLI 和平台层保持薄适配。
6. **先判断测试责任**：每次实现都分类测试门禁，但只有稳定、确定、可自动化的行为改动才强制严格 RED → GREEN。
7. **用新鲜证据交付**：测试、构建、浏览器、API、数据库、实机或用户验收证明到哪一层，就只声明到哪一层。

生产环境、数据迁移、权限、支付、第三方、密钥、安全和不可逆操作会追加对应控制，但不会把小任务包装成大项目。真源冲突和连续失败只扩大解决该冲突所需的 discovery；证据关闭后立即恢复普通成本。

## 核心能力

- **单一顶层 owner**：技术与非技术用户都从同一个项目级入口开始，不让单点流程抢走完整判断。
- **当前真相和单一 owner**：当前文件、合同、Git、运行态和真实证据优先于旧对话与旧文档。
- **风险缩放**：内部始终完成风险判断，外部只展示当前用户真正需要的结论、证据和决策。
- **技术栈＋架构联合决策**：从产品事实、质量场景和架构驱动出发，核对框架原生约束与当前一手资料，只保留一个主组合；不让小白选择技术名词，也不为纯设想堆微服务、DDD 或 CQRS。
- **测试治理**：测试分类强制，新测试代码有条件；拒绝测 mock 自己、覆盖率表演和为了 GREEN 改弱断言。
- **领域无关工作室调度**：按交付物、依赖、唯一 writer、合同、环境和验收关系判断是否值得创建多个用户可见任务；游戏、美术、前后端、数据、文档等只是同一任务图模型的不同实例，不维护行业白名单。
- **用户任务优先的 UI 交付**：新增或实质修改界面前，先确认用户要完成的任务、必要信息、交互状态和不应变化的区域；已有成熟界面时直接绑定同角色参考，禁止另造风格、堆无意义文案或擅自重排信息架构。
- **成熟组件向下复用**：新页面默认适配现有稳定布局、组件、token、图标、主题和断点；修改共享默认值必须先确认既有消费者、回归证据和回滚边界。实施后用同 viewport/state/theme 的参考与候选视觉对、DOM/无障碍快照和适用交互轨迹验收。
- **可恢复的执行方案**：跨阶段、可交接的实施方案写入唯一文档 owner，并随执行、纠正和验收持续更新；对话不充当方案真源，上下文压缩后仍从同一 owner 恢复。
- **任务与授权分离**：任务规模由真实 owner 拓扑决定，风险、测试、Git、外部写入和发布授权分别控制；小任务不会因为术语复杂被放大，高风险动作也不能借“小改动”绕过保护。
- **证据完整性与防退化**：能力、语义、runtime 文件和关键治理规则都有基线与变异测试；静态检查、打包结果、fresh-session 行为、Host Hook 和公开发布证据分层报告，缺失的层保持 `UNVERIFIED`。
- **隐私安全的行为测试**：正式测试 fixture 从零构造，不读取本机项目、全局记忆、客户资料或其他真实工作内容；源码包、运行包和会话连续性插件保持独立边界。
- **从局部任务到完整生命周期**：空项目、半路接管、普通开发、报错救援、AI 债务、安全、验收、发布和交接不断链。
- **防假完成**：没有新鲜验证不宣布完成；连续三次修复失败后停止局部补丁，重新审计架构、owner 和真源。

## 60 秒确认是否生效

安装并重启 AI 工具后，新开一个会话，在任意已有项目中输入：

```text
我接手了一个写到一半的项目。先只读判断现在做到哪一步、有哪些真源和风险，先不要修改文件。
```

正常表现：AI 先确认只读边界并查看当前证据，用白话说明项目状态、风险和下一步，不会直接开始重写。如果它要求你选择内部路由、只复述 README，或者没有查看项目证据就宣布结论，应先排查旧安装副本和宿主发现状态。

## 安装

源码仓与模型运行包已经分离。不要再把整个源码仓直接 clone 到 skill 安装目录；源码中的测试、CI、README、海报、二维码和其他平台 metadata 不属于运行时。

先获取源码：

```bash
git clone https://gitee.com/sliver-ring_admin/sliver-vibe-coding.git ~/sliver-vibe-coding-source
cd ~/sliver-vibe-coding-source
```

### Codex

```bash
python3 scripts/build_runtime_bundle.py --target codex --output ~/.codex/skills/sliver-vibe-coding --force
python3 scripts/validate_runtime_bundle.py ~/.codex/skills/sliver-vibe-coding --target codex --source-root .
```

### 可选：Codex 会话连续性插件

`plugins/sliver-session-continuity` 是一个独立的 Codex 插件源码，用于在上下文压缩前后保存和提示恢复有限的本机会话证据。它不属于 Sliver Skill runtime bundle，也不读取或回写项目真源文档；安装 Skill 不会自动安装或信任这个插件。

授权前请先理解：插件只在 Codex 管理的 `PLUGIN_DATA` 下保存脱敏、截断后的最近四条用户请求、最新 `update_plan` 和上一条已完成助手消息；主会话正常结束时立即删除，超过 24 小时未活动的状态会在下一次 Hook 事件到来时惰性清理，不是后台定时删除。异常退出、停用或卸载后若没有后续 Hook，源码不能保证恰好 24 小时清除。脱敏是 best effort，不能保证识别未知秘密；插件不联网，也不读取或回写项目真源。

在源码仓根目录执行：

```bash
codex plugin marketplace add "$PWD"
codex plugin add sliver-session-continuity@sliver-local
```

安装后在 Codex Desktop 新会话输入 `/hooks`，逐项审查并信任这个插件声明的 7 个 Hook。安装或启用不等于信任；Hook 文件发生变化后应重新审查。该入口已在 Codex Desktop bundled CLI `0.146.0-alpha.3.1` 对应宿主验证；其他版本应以该版本实际提供的 Hook 审查入口为准。若终端中存在多个 Codex 安装，必须使用实际运行 Codex Desktop 的同一套 CLI/配置完成安装与状态确认。

2026-07-24 已在 macOS arm64、Codex Desktop bundled CLI `0.146.0-alpha.3.1` 上完成安装、Hook 信任、脱敏、私有权限、正常结束清理，以及手动和自动压缩的恢复上下文生命周期实测。该结果证明目标宿主确实触发并接收了恢复上下文，不代表模型必然恢复唯一语义目标；其他 Codex 版本仍需重新实测。细节见 [插件 README](plugins/sliver-session-continuity/README.md) 和 [COMPATIBILITY.md](COMPATIBILITY.md)。

### Claude Code

```bash
python3 scripts/build_runtime_bundle.py --target claude-code --output ~/.claude/skills/sliver-vibe-coding --force
python3 scripts/validate_runtime_bundle.py ~/.claude/skills/sliver-vibe-coding --target claude-code --source-root .
```

### Gemini CLI

```bash
python3 scripts/build_runtime_bundle.py --target gemini-cli --output ~/.gemini/skills/sliver-vibe-coding --force
python3 scripts/validate_runtime_bundle.py ~/.gemini/skills/sliver-vibe-coding --target gemini-cli --source-root .
```

升级时在源码目录执行 `git pull --ff-only`，阅读 [CHANGELOG.md](CHANGELOG.md)，然后重新生成并覆盖对应 runtime bundle。完整平台状态、固定版本、排障与证据边界见 [COMPATIBILITY.md](COMPATIBILITY.md)。

## 源码、运行包和平台适配

| 层 | 作用 |
| --- | --- |
| 源码仓 | 核心真源、测试、验证器、CI、README、CHANGELOG、社区二维码和发布资料 |
| runtime bundle | `SKILL.md`、专业 references、项目模板、guardrail、VERSION 和 LICENSE |
| platform adapter | 注入宿主专属发现 metadata 与能力映射；Codex 包含 `agents/openai.yaml` 和工作室任务工具合同 |

`references/routes-index.md` 是内部 route、operation、lens 到专业 reference 的唯一注册表。README 不复制内部映射，用户也不需要学习这些名称。

## 验证边界

- 源码合同测试可以证明结构、路由注册表、selector 语料、执行骨架和变异防退化。
- runtime 验证可以证明安装包与源码 owner 一致，没有混入测试、海报、二维码或其他平台 metadata。
- Task Decision live 静态入口只校验“小活不大干、危险不漏控、领域名词不改变深度、Studio 不滥建议”的案例与结果格式；正式结果的每个样例必须来自不同的新任务，绑定 Skill 版本、runtime target/digest、源码 revision、真实任务标识和时间，并逐条校验原始 JSON 与结构化判定完全一致。
- foundation live 静态入口只校验版本化 fixture、schema 和行为 rubric，明确不运行模型。正式结果要保留实际 runner、宿主/模型、当前源码和原始工具/网络证据；单个自述 JSON 不能形成 live pass。
- UI live 静态入口只校验 Delivery Shape v3、原型与设计转代码行为合同。正式结果必须来自新会话，绑定当前 runtime target、digest、源码 revision、前置设计锁和验收记录；参考/候选截图必须形成同 viewport、state、theme 的视觉对，DOM/无障碍与交互证据不能由同一张截图代替。只写 VERSION 或由候选 record 自证 stable reference 不能证明测的是当前候选。
- Studio live 静态入口校验推荐、确认、零误创建、独立验收、返工和 Codex 任务工具序列。正式结果绑定当前 runtime digest 与源码 revision，并直接关联 `case_id`、用户确认事件、真实 `threadId/hostId`、工具事件和原始结果路径；静态规则不能证明真实任务调度。
- Studio 本地 checkout 只允许只读房间；任何 writer 必须使用独立 worktree，并把实际 `create_thread` 参数、有效起点 revision 和验收后的成果回收合同写入 live evidence。自由文本声称“已隔离”不算证据。
- `--contract-only` 发包前静态门禁要求源码合同、插件确定性安全测试和三个 runtime target 的重建校验，允许在开发中的脏树上运行。真正的可发布候选和完整 live 聚合仍必须是干净 Git 候选；目标宿主 fresh-session 按本次行为变化选择最少的代表性 smoke，并单独记录已验证与未验证边界。
- Task Decision、foundation、UI 与 Studio 四组结果属于完整 live 行为证据。只有明确声明完整 live 行为通过时，四组结果才必须指向同一候选并全部通过；缺少任一组时该层保持 `UNVERIFIED`，不把静态或 bundle 结果包装成模型行为证明。
- 当前 Delivery Shape v3 的合成源码指向 smoke 覆盖了用户心智、完整旅程、字段减法、数据不等于展示授权、成熟参考约束、无同角色参考时形成一个视觉目标，以及局部修正保持轻量；它没有更新本机安装，也不是可信隔离 producer 生成的正式 live package，因此安装后自然命中与 release-grade UI 行为仍为 `UNVERIFIED`。

源码验证命令：

```bash
python3 scripts/validate_skill.py
python3 scripts/evaluate_routes.py
python3 scripts/evaluate_task_decision_contract.py
python3 scripts/evaluate_task_decision_live_behavior.py --contract-only
python3 scripts/evaluate_selector_pressure.py
python3 scripts/evaluate_execution_backbone.py
python3 scripts/evaluate_ui_design_lifecycle.py
python3 scripts/evaluate_ui_design_live_behavior.py --contract-only
python3 scripts/evaluate_foundation_live_behavior.py --contract-only
python3 scripts/evaluate_studio_live_behavior.py --contract-only
python3 scripts/test_validation_contracts.py
python3 scripts/test_stage_v2_contracts.py
python3 scripts/test_foundation_guardrail_contracts.py
python3 scripts/test_task_decision_live_contracts.py
python3 scripts/test_ui_design_live_contracts.py
python3 scripts/test_studio_live_contracts.py
python3 scripts/test_runtime_bundle_safety.py
python3 scripts/test_session_continuity.py
python3 scripts/test_release_candidate_contracts.py
python3 scripts/validate_release_candidate.py --contract-only
```

需要做完整 live 行为验证时，任务分级、技术栈/架构、UI 与工作室调度由目标宿主在新任务中保存各自 schema 要求的原始结果和工具证据：

```bash
python3 scripts/evaluate_task_decision_live_behavior.py --results /path/to/task-decision-live-results.json
python3 scripts/evaluate_foundation_live_behavior.py --results /path/to/fresh-session-results.json
python3 scripts/evaluate_ui_design_live_behavior.py --results /path/to/ui-design-live-results.json
python3 scripts/evaluate_studio_live_behavior.py --results /path/to/studio-live-results.json
python3 scripts/validate_release_candidate.py --task-decision-results /path/to/task-decision-live-results.json --foundation-results /path/to/foundation-live-results.json --ui-results /path/to/ui-design-live-results.json --studio-results /path/to/studio-live-results.json --expected-producer-run-id <run-id> --expected-producer-repository <owner/repository> --expected-producer-workflow-path .github/workflows/<authorized-producer>.yml
```

以上命令示例使用 macOS/Linux 的 POSIX 路径。Python 验证 Owner 不依赖 GitHub；Windows 尚未完成同等级安装与 fresh-session 实测，本版不声明一等支持。

## 版本与许可证

- 行为变化：[CHANGELOG.md](CHANGELOG.md)
- 安装与兼容：[COMPATIBILITY.md](COMPATIBILITY.md)
- 打包边界：[packaging/README.md](packaging/README.md)
- 许可证：[Apache License 2.0](LICENSE)
