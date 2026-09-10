# Claude Hooks Index

## 模块职责

`hooks/` 保存 Claude 运行时会用到的 Hook 脚本。

默认保留的是对这套包有价值、且风险可控的自动化：

- feedback 信号检测
- 进化建议提醒
- 编辑后的 T2 check、review / doc sync 状态标记（普通 T2 在 split-self-review 后写轻量快照，strict source changes 才要求 full review snapshot / doc-sync；snapshot 不保存 finding ledger）
- commit 前接共享 pre-commit gate
- Stop 时提醒未完成状态

## 成员清单

| Hook | 触发点 | 主要职责 | 关键依赖 |
| --- | --- | --- | --- |
| `detect-feedback-signal.sh` | `UserPromptSubmit` | 调用当前 Skills root 的统一 Node 信号入口识别显性纠错；支持源码/镜像/目标项目安装位置，Bash 包装不依赖 jq | `tools/detect-experience-signal.mjs`、`VIBE_CODING_SKILLS_HOME` |
| `check-routing-session.sh` | `UserPromptSubmit` | 按 session id 记录当前对话是否由用户打开 `vibe-coding-skills`；关闭时给宿主返回 `no-skill` 闸门上下文 | `tools/routing-session-gate.mjs`、`VIBE_ROUTING_STATE_DIR` |
| `check-evolution.sh` | `SessionStart` | 提醒是否有可处理的 feedback 索引 | `.claude/feedback/FEEDBACK-INDEX.md` |
| `pre-commit-check.sh` | `PreToolUse Bash` | 从结构化 Hook input 中识别分隔符、环境变量前缀和 `command git ... commit` 等 commit 变体，再把提交前检查交给共享 gate；缺少 Node 时 fail closed | `tools/pre-commit-gate.sh` |
| `mark-source-change-needed.sh` | `PostToolUse Edit|Write` | 只按当前文件快速写 dirty / T2 check / review / doc-sync marker，并让对应 snapshot 失效；不做全量 Git / doc-sync 覆盖扫描 | `.claude/.source-change-touched`、`.claude/.needs-t2-check`、`.claude/.needs-review`、`.claude/.needs-doc-sync` |
| `auto-sync-target-doc-index.sh` | 目标项目 `PostToolUse Edit|Write` | 仅当写入命中 manifest 已登记文档时调用 `auto-sync-target-doc-index.mjs`，事务刷新 metadata / `文档索引.md`；旧 `sourceRevision` 保持不变并由 drift 门禁判过期 | `.vibe-docs.json`、`文档索引.md` |
| `mark-review-needed.sh` | 兼容入口 | 旧版 review 状态标记入口，保留给既有配置；同样只按当前文件快速写 dirty / review marker | `.claude/.source-change-touched`、`.claude/.needs-review` |
| `mark-doc-sync-needed.sh` | 兼容入口 | 旧版 doc-sync 状态标记入口，保留给既有配置；同样只按当前文件快速写 dirty / doc-sync marker | `.claude/.source-change-touched`、`.claude/.needs-doc-sync` |
| `stop-gate.sh` | `Stop` | 每次都从当前 Git 重算 staged / unstaged / untracked source changes，即使没有 dirty marker、state 或 snapshot 也不跳过；阻止 stale T2/review/doc-sync 状态放行，snapshot 绑定 staged diff 内容 | `.claude/.source-change-touched`、`.claude/.needs-t2-check`、`.claude/.t2-check-snapshot`、`.claude/.needs-review`、`.claude/.needs-doc-sync`、`.claude/.review-snapshot` |

## 说明

- Hook 状态文件可以缺失，首次运行时按需要生成；`.claude/.source-change-touched` 是内部 dirty marker，不是用户验收状态
- PostToolUse 默认使用 `mark-source-change-needed.sh` 合并 T2 check、review / doc-sync 标记，并只检查当前文件；全量 Git diff、untracked 扫描和 doc-sync 覆盖检查延后到 Stop 或 commit；旧的独立脚本只作为兼容入口，也不得恢复每次 Edit / Write 后的全量扫描
- `source change` 包含 behavior path 和 protected source doc；主控、真源和各 `INDEX.md` 默认至少 T2，规则口径、高影响或跨模块变更进入 strict
- UI 文件只有 visual-only、局部、数据无关、不改变用户路径的 diff 才能走 T1；主 CTA、导航、表单顺序、布局结构、响应式结构、危险操作和数据提交相关 UI 必须升级
- Stop hook 不只信状态文件；无论 dirty marker、T2/review/doc-sync state 或 snapshot 是否存在，都会从当前 Git 重新计算 source changes、T2/review staged diff snapshot 和 strict doc-sync 覆盖关系
- commit 检测不依赖 settings 中狭窄的 `Bash(git commit*)` filter；Hook 脚本自身解析命令边界，覆盖命令分隔符、环境变量赋值与 `command git` 变体，避免简单字符串变体绕过共享 gate
- 这层是运行时辅助，不替代仓库级 `.githooks/pre-commit`
