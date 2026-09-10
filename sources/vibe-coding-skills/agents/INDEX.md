# Agents Index

## 模块职责

`agents/` 保存子 Agent 的唯一源码，用于把实现、审查、反馈和进化扫描拆成有界任务。这里的任务隔离默认是逻辑职责和输入范围隔离，不等于物理进程隔离。
同步后 Claude 运行时读取 `.claude/agents/*.md`，Codex 运行时读取 `.codex/agents/*.toml`。

## 成员清单

| Agent | 关联 Skill | 主要职责 | 上游输入 | 下游输出 |
| --- | --- | --- | --- | --- |
| `implementer.md` | `dev-builder` | 达到“≥3 模块 AND ≥5 文件”门槛时执行编码与自检；DONE 不是完成证据 | Phase / Task 上下文 | 代码修改与验证结果，供主 Agent核验 |
| `code-reviewer.md` | `code-review` | 按 review profile 作为 fresh 只读 Spec 或 Quality Reviewer；不得递归派发 Reviewer | 最小审查包、reviewStage、finding ledger | Finding Ledger Delta + Review Receipt |
| `feedback-observer.md` | `feedback-writer` | 记录用户反馈与行为修正 | 主 Agent 提供的反馈上下文 | feedback 文档 |
| `evolution-runner.md` | `evolution-engine` | 扫描改进建议 | feedback 目录、进化规则 | 进化提案 |

## 维护规则

- 改子 Agent 的职责或使用的 Skill 时，同时更新本索引、Codex 真入口 `AGENTS.md` 和 Claude 真入口 `.claude/CLAUDE.md` 的调度规则；根 `CLAUDE.md` 只是重定向占位。
- implementer 派发门槛不限制独立 Reviewer；`independent-two-stage` / `hazard-review` 由主 Agent派两个互不继承结论的 fresh `code-reviewer` 实例，每个实例只执行一个 stage。这里的实例是逻辑审查角色，不默认要求独立进程或物理隔离。
- 不直接手改 `.claude/agents/*.md` 或 `.codex/agents/*.toml`；先改 `agents/*.md`，再运行 `tools/sync-compat.ps1`
- `tools/sync-compat.ps1` 会排除 `agents/INDEX.md`，从每个 Agent frontmatter 的 `name` / `description` 和正文生成 Codex TOML 的 `developer_instructions`
