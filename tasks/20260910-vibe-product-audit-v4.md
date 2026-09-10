# Task 20260910-vibe-product-audit-v4

状态：dispatched-failed（宿主 503，无回执，未补标 accepted）

## 派发记录

- 2026-09-10：派发 `luna_vibe_product_audit_v4`，agent 再次因宿主 `503 Service Unavailable` 中断，未产出 `evidence/20260910-vibe-product-audit-v4.md`。
- 处置：宿主 Luna 模型不可用，子 Agent 审计暂不可行；主 Agent 按交接文档规则不得把中断当独立审计通过。后续重派需新任务标识（v5），或在宿主恢复后重试。

## 来源

本任务由 `20260910-vibe-product-audit-v3` 重派而来（v3 因宿主 503 中断，无回执）。目标、边界、允许读取/写入与验收命令与 v3 完全一致，仅任务标识更新；先读取 v3 任务包确认清单。

## 目标

只读审计 Vibe 来源中「产品 / checker / user-tool」类技能（catalog 中 `source-only-product-or-checker`、`source-only-checker`、`source-only-unreviewed`、`event-only-source-only` 分组），逐项记录：

1. 来源 revision / 快照证据（`sources/vibe-coding-skills` 是非 git 快照，需记录快照文件 SHA-256 与 catalog `sourceSha256` 是否一致）；
2. 许可证 / NOTICE：技能目录内是否有 LICENSE/NOTICE，若无则引用 `docs/legal/` 或明确记录「目录内无独立许可证文件」；
3. 调用类型（frontmatter 的 invocation / cmd / 触发边界）；
4. 写入目标与写入器：会写哪些路径、谁是唯一写入器、是否试图拥有 route/truth/runtime/Hook 权限；
5. 依赖：脚本或 SKILL 是否引用第三方 CLI/库（只记录，不安装）；
6. 分组结论：保持 `source-only-*`、还是可作为 `adapter-candidate`（仅登记候选，不直接改写 catalog）。

目标技能清单（以 `provenance/CANONICAL-CATALOG.json` 的 Vibe 记录为准）：

- `architecture-foundation`、`audit`、`bug-fixer`、`codebase-memory-scout`、`critique`、`design-brief-builder`、`design-maker`、`dev-builder`、`dev-planner`、`doc-sync-guardian`、`harden`、`hotspot-governor`、`optimize`、`product-spec-builder`、`release-builder`、`requirements-test-designer`、`rule-harvester`、`skill-builder`、`target-constitution-setup`、`target-runtime-setup`、`test-automation`、`ui-system-guardian`、`vibe-code-review`、`beginner-flow-guide`、`clarify`、`shape`、`evolution-engine`、`experience-elevator`、`feedback-writer`

其中 `architecture-foundation`、`target-constitution-setup`、`target-runtime-setup`、`doc-sync-guardian` 已有 `evidence/20260910-vibe-foundation-audit.md`，直接引用结论并复核，不重复展开。

## 不做事项

- 不修改三个源项目。
- 不安装任何依赖。
- 不把任何技能写入 Codex/Claude runtime projection。
- 不改写 `provenance/CANONICAL-CATALOG.json`、`LICENSE-MAP.json`、`OWNER-LEDGER.json` 等台账（只在证据中给出建议 diff，由主 Agent 决定）。
- 不把事件类技能（`evolution-engine`、`experience-elevator`、`feedback-writer`）当作普通 user-tool。

## 允许读取

- `sources/vibe-coding-skills/`（技能目录、docs/legal、codex-hooks、hooks、tools、package.json、settings.json 等来源快照）。
- 目标仓库 `provenance/`、`governance/`、`docs/`、`tasks/`、`evidence/`、`adapters/`、`tests/`。

## 允许写入

- `tasks/20260910-vibe-product-audit-v4.md`（仅补充审计说明）。
- `evidence/20260910-vibe-product-audit-v4.md`。

## 必须回执

1. 实际读取/修改的文件清单；
2. 执行过的命令与退出码；
3. 逐项审计表（来源、许可证、调用类型、写入目标、依赖、是否试图拥有 route/truth/runtime/Hook）；
4. 建议状态分组（保持 source-only 或 adapter-candidate 候选）；
5. 未验证项/阻塞项；
6. 可复现的下一步建议。

## 验收命令（主 Agent 会重跑）

```powershell
git -C 'F:\skiils工具\feisheng-vibe-coding' status --short
Get-Content -Raw -Encoding UTF8 'F:\skiils工具\feisheng-vibe-coding\evidence\20260910-vibe-product-audit-v4.md'
```

若发现写入越权、第二控制面、许可证无法证明或事件类技能被错误归为普通工具，任务标记 `rework-required`。
