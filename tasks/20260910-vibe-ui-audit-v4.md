# Task 20260910-vibe-ui-audit-v4

状态：dispatched-failed（宿主 503，无回执，未补标 accepted）

## 派发记录

- 2026-09-10：派发 `luna_vibe_ui_audit_v4`，agent 再次因宿主 `503 Service Unavailable` 中断，未产出 `evidence/20260910-vibe-ui-audit-v4.md`。
- 处置：宿主 Luna 模型不可用，子 Agent 审计暂不可行；主 Agent 按交接文档规则不得把中断当独立审计通过。后续重派需新任务标识（v5），或在宿主恢复后重试。

## 来源

本任务由 `20260910-vibe-ui-audit-v3` 重派而来（v3 因宿主 503 中断，无回执）。目标、边界、允许读取/写入与验收命令与 v3 完全一致，仅任务标识更新；先读取 v3 任务包确认清单。

## 目标

只读审计 Vibe 来源中「UI / 第三方 LICENSE」类技能（catalog 中 `source-only-ui` 分组），逐项核对：

1. 来源 revision / 快照证据：记录每个技能目录 `SKILL.md` 的实际 SHA-256 与 catalog `sourceSha256` 是否一致；
2. 许可证 / NOTICE 逐项映射：技能目录内 LICENSE/NOTICE、`docs/legal/` 的 bundled LICENSE/NOTICE、`ui-styling/canvas-fonts/*.txt` 字体 OFL 许可证、scripts/package.json 里的第三方声明；确认每个文件（或每个有法律意义的目录）都能落到具体许可证；
3. 调用类型与触发边界（frontmatter、cmd）；
4. 写入目标与写入器：UI 技能会写哪些项目文件（如 components、tokens、theme、canvas-fonts），是否越权拥有 route/truth/runtime/Hook 权限；
5. 依赖：是否依赖第三方 CLI/库/在线服务（只记录，不安装、不联网调用）；
6. 分组结论：许可证映射完整且写入边界明确的，建议登记 `adapter-candidate`；映射不完整或有第三方字体/LICENSE 缺口者保持 `source-only-ui`。

目标技能清单：

- `ui-ux-pro-max`、`ui-styling`、`ui-system-guardian`、`impeccable`、`design-system`、`brand`、`adapt`、`animate`、`bolder`、`colorize`、`delight`、`distill`、`layout`、`overdrive`、`polish`、`quieter`、`typeset`

特别核对（HANDOFF 点名的三项）：

- `impeccable`：`skills/impeccable/LICENSE`、`NOTICE.md`、`docs/legal/LICENSE-impeccable-bundled.txt`、`NOTICE-impeccable-bundled.txt` 与上游 `pbakaus/impeccable`（Apache-2.0）及 Anthropic frontend-design NOTICE 是否对齐。
- `ui-ux-pro-max`：`docs/legal/LICENSE-ui-ux-pro-max-bundled.txt`（MIT, Next Level Builder）是否覆盖其 bundled 数据/脚本。
- `ui-styling`：`skills/ui-styling/LICENSE.txt` 与 `canvas-fonts/*.txt` 字体 OFL 许可证清单是否完整覆盖每个字体文件；`references/` 与 `scripts/` 是否有额外第三方来源。

## 不做事项

- 不修改三个源项目。
- 不安装任何依赖。
- 不把任何技能写入 Codex/Claude runtime projection。
- 不改写 `provenance/CANONICAL-CATALOG.json`、`LICENSE-MAP.json`、`OWNER-LEDGER.json` 等台账（只在证据中给出建议 diff，由主 Agent 决定）。
- 不把 bundled 第三方许可证合并成一个根许可证。

## 允许读取

- `sources/vibe-coding-skills/skills/` 下 UI 分组目录全部文件。
- `sources/vibe-coding-skills/docs/legal/`。
- `sources/vibe-coding-skills/package.json`、README、settings.json 等来源快照。
- 目标仓库 `provenance/`、`docs/`、`tasks/`、`evidence/`、`adapters/`、`tests/`。

## 允许写入

- `tasks/20260910-vibe-ui-audit-v4.md`（仅补充审计说明）。
- `evidence/20260910-vibe-ui-audit-v4.md`。

## 必须回执

1. 实际读取/修改的文件清单；
2. 执行过的命令与退出码；
3. 逐项许可证映射表：技能 -> 文件 -> 许可证/来源 -> 是否覆盖；
4. 字体/脚本/数据文件清单与缺口；
5. 写入目标与是否有第二控制面风险；
6. 建议状态分组（保持 source-only-ui 或 adapter-candidate 候选）；
7. 未验证项/阻塞项和下一步建议。

## 验收命令（主 Agent 会重跑）

```powershell
git -C 'F:\skiils工具\feisheng-vibe-coding' status --short
Get-Content -Raw -Encoding UTF8 'F:\skiils工具\feisheng-vibe-coding\evidence\20260910-vibe-ui-audit-v4.md'
```

若发现许可证缺口、第三方法律文件无法对应具体文件、写入越权或试图拥有 route/truth/runtime/Hook 权限，任务标记 `rework-required`。
