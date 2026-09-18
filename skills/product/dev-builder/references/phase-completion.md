# Phase 完成度判断

> 来源：dev-builder/SKILL.md 的 [Phase 完成度判断]。
> 读取时机：Task/Phase 收口、四步走验证、人工验收提醒和用户确认前。

[Phase 完成度判断]
    每个 Phase 完成时，必须通过以下全部检查：

    **四步走**（必须全部通过才能确认 Phase 完成）：

    第一步：Code Review
    - Phase 收口至少使用 `independent-two-stage`：独立 Spec Reviewer 对照交付清单，独立 Quality Reviewer 检查累计实现质量；两个 fresh 实例不继承彼此结论
    - 审查本 Phase 的累计 `BASE...HEAD` diff、所有 Task finding ledger 与 review receipt，发现单 Task 审查看不到的跨 Task 契约、状态、重复实现和回归问题
    - 合并形成 Phase ledger：只去重、不丢项，保留各 Task 的 findingId、证据、裁决与 reverified 历史；新增集成 finding 继续按同一状态机闭环
    - 检查代码质量：命名规范、类型安全、无 any、无循环依赖
    - 检查术语一致性：代码标识、模块名、状态名和公开文案是否符合目标项目需求文档的“术语与命名规范”和开发计划的“术语对齐”
    - 检查接口契约一致性：真实 endpoint、service、public entry、server action、IPC / event 通道和 schema 是否登记到 `接口契约.md`，同一业务能力是否复用统一入口
    - 检查有没有超出 Phase 范围的改动（scope creep）：对照当前 Phase 的交付清单与「不做边界/停止条件」逐条核对；`## Spec Compliance` 必须包含固定行「超出计划的内容：无 / <清单>」，不为“无”时逐项列出文件、功能与处理方式（回退 / 用户批准计入需求变更）
    - 输出证据：`## Spec Compliance`、`## Code Quality`、累计 diff hash、Phase ledger 终态与两个 review receipt

    第二步：验证完整性
    - 该 Phase 计划的所有功能都已实现
    - 每个新增或改变的可观察行为都有时间顺序可信的本轮 RED 正确失败证据、最小 GREEN 通过证据和相关回归结果
    - REFACTOR 只发生在全绿后，未增加新行为，整理后仍保持全绿
    - 原型、生成代码或配置文件的例外，已有写生产代码前的用户明确批准、替代验证、风险和恢复方案；无法自动化本身不构成例外资格
    - 无遗漏、无半成品、无“看起来对”的软性完成声明
    - Critical / Important 已 reverified 或有用户明确 accepted-risk；Minor 已修复或明确 accepted-risk / deferred / rejected-with-reason
    - 输出证据：功能清单打勾 + 测试 / 手动验证清单 + finding ledger

    第三步：构建与静态验证
    - 先按 platform profile、language adapter 和项目已有脚本选择 build / typecheck / lint / test 命令；不得把 `tsc` 写成全平台硬门禁
    - TypeScript / Node 仅在项目已有 typecheck 脚本或 `tsconfig.json` + 本地 CLI 时运行；Python、Go、Rust、Java / Kotlin、C#、Swift、Dart 使用各自生态或项目现有入口
    - 无缺失依赖；缺少工具时按依赖授权规则处理，不临时安装后伪报通过
    - 输出证据：实际执行的命令、结果，以及未执行项的 `不适用 + 原因`

    第四步：功能测试
    - 按 architecture profile 选择 smoke：Web / service 仅在存在可启动入口时检查进程、页面或 endpoint；CLI 检查命令、输出与退出码；Library 检查 build、导入或 public entry；worker / Mobile 使用项目已有入口
    - 新功能可用，现有功能未被破坏；不存在的 dev server、API、浏览器或端口记录为 `不适用 + 原因`
    - Web / Desktop 且仓库存在 `tools/check-project-structure.sh` 时才运行结构校验。Windows PowerShell 先执行 `$bash = (Get-Command bash).Source`，再用 `& $bash ./tools/check-project-structure.sh --root "<project-dir>" --platform <web|desktop> --strategy <feature-first|legacy-incremental>`；POSIX shell 使用仓库现有 Bash 入口
    - 仓库存在 `tools/check-terminology-consistency.sh` 时沿用同一 shell 选择规则；存在 `tools/check-api-contracts.mjs` 时运行 `node "tools/check-api-contracts.mjs" "<project-dir>"`
    - Web / Desktop 已有 Playwright 时用现有浏览器自动化覆盖核心交互；没有浏览器路径或项目不是 UI 形态时不强加
    - HTTP smoke 在 Windows PowerShell 使用 `Invoke-WebRequest -Uri "<url>"` 或项目已有脚本；其他 shell 使用项目现有 HTTP 工具。只有真实 endpoint 存在时才检查状态码
    - 输出证据：当前 profile 实际产生的启动日志、命令输出、退出码、API 响应、设计数值或结构校验结果

    **冒烟测试**（四步走之外的额外检查）：
    - 依赖安全：只运行项目现有生态的审计脚本；npm 项目还必须已有 lockfile / 审计入口，不为其他语言强加 `npm audit`
    - 无暴露密钥：优先复用项目现有 checker 或 `rg`，不新增扫描依赖
    - 进程正常：只有存在长运行 Web / service / Desktop 入口时才检查本轮进程实例，CLI / Library 记为不适用
    - Web / Desktop 结构检查：`feature-first` 项目必须通过结构校验；`legacy-incremental` 项目至少不能出现阻断级错误

    **验证时效性规则**：
    四步走中的每一步验证命令必须在汇报的同一消息中执行。不接受"前面已经验证过了"。如果中间有任何代码修改，所有四步重新来。
    相同类型 finding 连续两轮仍未消除时，停止机械复审，判断根因是需求、计划、架构还是验证设计；确实阻塞时再请求用户裁决。

    **全部通过后**：
    - 向用户汇报结果（附证据）
    - 如果人工验收状态为 `待用户验收` 或 `需回归复验`，先提醒用户按限定路径真实点击 / 操作 / 观察；用户明确确认后写入 `验收记录.md`
    - 用户确认 → Phase 完成
    - 不通过不允许确认 Phase 完成
    - 如验证过程中发现问题并修复，修复的 commit 用 `fix:` 前缀（per-Task commit 已在第二步完成）
