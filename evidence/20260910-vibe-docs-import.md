# Vibe 被引为权威的文档补齐（任务 2）

日期：2026-09-10
关联任务包：tasks/20260910-vibe-docs-import.md（accepted）

## 缺口

Vibe 快照此前为 550 文件，被排除的 792 个里有 4 个 docs。其中
`docs/runtime-loading-policy.md` **被 Vibe 自己的 `AGENTS.md`/`README.md` 引为权威**
（"完整 tier、路由、Hook、接口、UI、生命周期和 rollback 规则以 AGENTS.md、docs/runtime-loading-policy.md 与各具体 Skill 为准"），
但文件本身**不在包里** —— 这是「引用了但不存在」的真实缺口，不是无关产物。

## 处置：一次有界导入（3 个 md）

| 文件 | 大小 | 源/snapshot SHA-256 |
|---|---|---|
| `docs/runtime-loading-policy.md` | 18310 B | `cf0d3144305f…`（字节一致） |
| `docs/language-platform-profiles.md` | 9584 B | `f0378283b61b…`（字节一致） |
| `docs/reference-main-chain.md` | 573 B | `802b5049b95c…`（字节一致） |

`docs/vibe-coding-skills-lifecycle.html` **不导入**（演示物，非能力性文档）。

## 记录更新

`provenance/VIBE-IMPORT.json`：`fileSha256` 550 → **553**（按 path 排序，保持确定性）；
`snapshotFiles`/`approvedAllowlistFiles`/`sha256CheckedFiles` 同步 553；`sourceFilesOutsideAllowlist` 792 → 789；
`note` 追加本次补录原因。

## 验证

```text
来源快照完整性 — vibe-coding-skills=553, mattpocock-skills=136, sliver-core=220
背书: 754 文件逐字节一致 + 4 按记录 revision + 3 已登记本地补丁 + 148 白名单 = 909 = 553+136+220
verify.ps1 -IncludePackage: 8/8 PASS
```

## 未导入（有意）

| 项 | 原因 |
|---|---|
| `docs/vibe-coding-skills-lifecycle.html` | 演示/展示物，非能力性文档 |
| Vibe `.claude`/`.agents`/`.codex`（711 个） | 宿主镜像，正是「不把镜像当源码」规则的执行 |
| Vibe `plans/`（71 个） | 开发计划产物 |
| Matt `.skills/translate-skill` + 4 个翻译维护脚本 | 自持后无上游翻译需求，非用户能力 |
| Matt `.out-of-scope/`（3 个） | 上游明确标注超出范围 |
| Sliver 5 张营销图 + 3 个 `__pycache__` | 展示物与构建产物（Sliver 自己的 manifest 亦禁止） |
