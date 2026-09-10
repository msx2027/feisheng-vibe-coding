# Matt 工程原语接入证据

## 结论

任务 `20260910-matt-primitive-adoption` 为 **accepted**。从已绑定 revision `9fe7e7a3bb352851b986725bab1c7cfb17610a97` 的只读快照接入三个不拥有项目级写入权的工程原语：

| 原语 | 目标路径 | 接入判断 |
| --- | --- | --- |
| `diagnosing-bugs` | `skills/engineering/diagnosing-bugs` | 保留；只提供 tight feedback loop 与诊断纪律 |
| `codebase-design` | `skills/engineering/codebase-design` | 保留；只提供 deep module、interface、seam 等共享词汇 |
| `domain-modeling` | `skills/engineering/domain-modeling` | 保留；只维护目标项目 glossary/ADR，写入仍受 target-truth 约束 |

`tdd` 与 `code-review` 未接入。它们所在源目录的 4 个未提交文件包含 `code-review` 重命名及引用变化，来源和意图未被证明；继续保持 blocked。

## 主 Agent 重跑的检查

- 三个正式技能目录均存在 `SKILL.md`，且与 Matt snapshot 对应文件 SHA-256 一致。
- `diagnosing-bugs` 未声明 project route、runtime projection 或 Hook writer。
- `codebase-design` 明确以 interface/seam 为术语，不创建第二个项目入口。
- `domain-modeling` 明确把 `CONTEXT.md` 作为 glossary，将 ADR 创建限定为难逆、意外且有真实权衡的决策；统一仓库仍由 `target-truth` owner 约束写入。
- 目标仓库 JSON 契约解析通过，Git 工作树只包含本任务允许的新增文件。

## 未验证项

- 尚未生成 Codex/Claude runtime projection。
- 尚未执行 fresh-session skill discovery 或宿主 Hook smoke。
- 尚未接入 `tdd`、`code-review`、`implement` 等依赖未决命名的技能。
