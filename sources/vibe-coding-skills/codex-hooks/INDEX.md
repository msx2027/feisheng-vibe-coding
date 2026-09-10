# Codex Hooks Index

## 模块职责

`codex-hooks/` 保存 Codex 运行时的 Hook 脚本。
这里保留的是与 Claude 侧同类的轻量自动化能力，不包含高侵入的自动 push 行为。

## 成员清单

| Hook / Helper | 触发点 | 主要职责 | 关键依赖 |
| --- | --- | --- | --- |
| `run-hook.ps1` | 内部入口 | 在 Windows / PowerShell 环境里按固定 allowlist 分发到对应 Hook；未知 Hook 或缺失实现 fail closed | 同目录 `*.ps1` |
| `shared.ps1` | 兼容聚合入口 | 保留公共 Hook input、最近 `.git` 祖先定位和可信 Git executable 解析，并加载拆分后的 `shared-paths.ps1`、`shared-changes.ps1`、`shared-docs.ps1`，既有 Hook 继续只 dot-source 此入口 | `shared-*.ps1` |
| `shared-paths.ps1` | 内部辅助 | 路径标准化、generated / protected / behavior path 分类，以及 execution tier / hazard 映射 | `AGENTS.md` |
| `shared-changes.ps1` | 内部辅助 | staged / unstaged / untracked Git change record、内容感知 diff 分类与当前 source change 计算 | `shared-paths.ps1` |
| `shared-docs.ps1` | 内部辅助 | 相关文档 coverage、review / T2 snapshot hash 与 `.claude/` 状态读写 | `shared-paths.ps1`、`shared-changes.ps1`、`.claude/` |
| `check-evolution.sh` / `check-evolution.ps1` | `SessionStart` | 提醒是否有可处理的 feedback 索引 | `.claude/feedback/FEEDBACK-INDEX.md` |
| `detect-feedback-signal.sh` / `detect-feedback-signal.ps1` | `UserPromptSubmit` | 从源码/镜像/目标项目安装位置调用当前 Skills root 的统一 Node 信号入口；PowerShell 5.1 由配置包装层显式按 UTF-8 转交 Hook input，并与 Claude 保持同一 signal schema | `tools/detect-experience-signal.mjs`、`VIBE_CODING_SKILLS_HOME` |
| `check-routing-session.ps1` | `UserPromptSubmit` | 按 session id 记录当前对话是否由用户打开 `vibe-coding-skills`；关闭时给宿主返回 `no-skill` 闸门上下文 | `tools/routing-session-gate.mjs`、`VIBE_ROUTING_STATE_DIR` |
| `pre-commit-check.sh` / `pre-commit-check.ps1` | `PreToolUse Bash` | 识别命令分隔符、环境变量前缀和 `command git ... commit` 等 commit 变体；命中后按 gate level 检查 staged diff T2/review snapshot 和 strict doc-sync 覆盖，有 `bash` 时委托共享 gate，无 Bash fallback 时保持同一 T2/strict 分流 | `tools/pre-commit-gate.sh`、`.claude/.needs-t2-check`、`.claude/.t2-check-snapshot`、`.claude/.needs-review`、`.claude/.needs-doc-sync`、`.claude/.review-snapshot` |
| `mark-source-change-needed.sh` / `mark-source-change-needed.ps1` | `PostToolUse Edit|Write` | 只按当前文件快速写 dirty / T2 check / review / doc-sync marker，并让对应 snapshot 失效；不做全量 Git / doc-sync 覆盖扫描 | `.claude/.source-change-touched`、`.claude/.needs-t2-check`、`.claude/.needs-review`、`.claude/.needs-doc-sync` |
| `auto-sync-target-doc-index.ps1` | 目标项目 `PostToolUse Edit|Write` | 仅当写入命中 manifest 已登记文档时调用自动同步工具；只刷新 metadata / `文档索引.md`，不修改正文、暂存区或旧 `sourceRevision` | `.vibe-docs.json`、`文档索引.md` |
| `mark-review-needed.sh` / `mark-review-needed.ps1` | 兼容入口 | 旧版 review 状态标记入口，保留给既有配置；同样只按当前文件快速写 dirty / review marker | `.claude/.source-change-touched`、`.claude/.needs-review` |
| `mark-doc-sync-needed.sh` / `mark-doc-sync-needed.ps1` | 兼容入口 | 旧版 doc-sync 状态标记入口，保留给既有配置；同样只按当前文件快速写 dirty / doc-sync marker | `.claude/.source-change-touched`、`.claude/.needs-doc-sync` |
| `stop-gate.sh` / `stop-gate.ps1` | `Stop` | 每次都从当前 Git 重算 staged / unstaged / untracked source changes，即使没有 dirty marker、state 或 snapshot 也不跳过；阻止 stale T2/review/doc-sync 状态放行，snapshot 绑定 staged diff 内容 | `.claude/.source-change-touched`、`.claude/.needs-t2-check`、`.claude/.t2-check-snapshot`、`.claude/.needs-review`、`.claude/.needs-doc-sync`、`.claude/.review-snapshot` |

## 说明

- Hook 状态文件可以缺失，首次运行时按需要生成；`.claude/.source-change-touched` 是内部 dirty marker，不是用户验收状态
- Codex 默认通过 PowerShell 入口调用 `.ps1` 版本，避免 Windows 分发包硬依赖 `bash -lc` 和 `jq`
- `codex-hooks.json` 不从 ambient `PATH` 执行 Git，而是从当前目录向上寻找最近 `.git` marker 后调用该根下的固定 runner；`run-hook.ps1` 只接受 allowlist 中的 Hook 名，禁止越过最近仓库边界误命中或用任意 Hook 名拼接脚本路径
- `shared.ps1` 是稳定兼容入口；职责已拆到 `shared-paths.ps1`、`shared-changes.ps1`、`shared-docs.ps1`，现有 Hook 不需要改 dot-source 路径
- PowerShell runtime 需要 Git 时统一通过 `Get-TrustedGitCommand` 解析 application candidate：拒绝目标仓库内、普通 PATH 平铺目录和 PATH junction 中的 fake `git.exe`，拒绝 executable 或任一祖先是 symlink / junction / reparse point 的候选；Windows 只接受能派生同一 Git-for-Windows 发行版 `bin/bash.exe` 的布局。所有 Git 调用统一禁用 pager、`core.fsmonitor`、external diff 与 textconv；没有可信 Git 时 fail closed，具体 Hook 或拆分 helper 不得恢复直接 `Get-Command git` 后执行
- PowerShell 版本必须与 Bash helper 保持等价：`source change = behavior path OR protected source doc`，普通 T2 与 strict gate level 分流，staged snapshot 内容和 hash 与 Bash / Node 绑定同一 diff 内容，unstaged / untracked 做内容感知分类，并使用 UTF-8 no BOM 写状态文件，避免跨运行时状态值漂移
- T2 check snapshot 只绑定 diff 与轻量证据；调用方必须先完成 split-self-review。它不是 finding ledger 或 Review Receipt，不能覆盖未闭环 finding。
- UI 文件的 T1 轻量分类必须与 Bash helper 等价：`*.tsx`、`*.jsx`、`*.vue`、`*.svelte`、`*.html`、`*.css`、`*.scss` 只有在 diff 全部是 visual-only 行时才放行；auth、permission、security、payment、database、delete、danger、api、fetch、mutation、onSubmit、sql 等路径或 diff 信号必须升级
- `current change recomputation` 在每次 Stop 都执行，不能因 marker / state / snapshot 全部缺失而跳过；必须同时对 staged 和 unstaged diff 做分级，untracked 新 behavior 文件默认至少 T2，未 staged / untracked 的普通 UI 文件不能只按路径 T1 放行
- commit 检测覆盖命令分隔符、环境变量赋值与 `command git` 变体，Bash / PowerShell 入口保持相同防绕过口径
- PostToolUse 默认使用 `mark-source-change-needed.*` 合并 T2 check、review / doc-sync 标记，并只检查当前文件；全量 Git diff、untracked 扫描和 doc-sync 覆盖检查延后到 Stop 或 commit，减少每次 Edit / Write 后固定 PowerShell / shell 成本；旧独立脚本只作为兼容入口，也不得恢复每次 Edit / Write 后的全量扫描
- 保留同名 `.sh` 文件，是为了兼容现有 shell 场景和镜像结构
- 这层是运行时辅助，不替代仓库级 `.githooks/pre-commit`
