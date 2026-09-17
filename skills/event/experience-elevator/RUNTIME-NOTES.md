# RUNTIME NOTES（能力定批评次 2026-09-11；auto-record 批次 2026-09-17；autonomous 批次同日；hard-gate 批次同日）

本技能已按「轻量形态」接入统一运行包；自动记账（auto-record）、**零触发词自治（autonomous-v1）**
与 **Stop 硬门禁（hard-gate-v1）** 均已接线：

- **autoRecord 闭环（契约 `enabled-experience-auto-record-v1` 起）**：
  Hook 捕获纠错信号（UserPromptSubmit）→ 以 `hookSpecificOutput.additionalContext` 注入结构化
  autoRecord 路由（eventId / signalType / scope / promptHash / occurredAt / 记录命令模板）→
  会话 AI 自主判断是否可复用 → 调用目标项目 `.feisheng/vibe-hooks/experience-recorder.mjs`
  落账 L0（ledger v2：revision CAS、eventId 幂等重放/collision、原子写）。
  SessionStart 注入常备记账契约 + 未消化提醒。记录与 dismiss 都会自动消化源信号。
- **零触发词自检（`enabled-experience-autonomous-v1` 起）+ 硬门禁（`enabled-experience-hard-gate-v1` 起）**：
  注入契约含自检义务——AI 在任务完成前自检自身返工/重试、推翻重来的方案、修掉的自身错误、
  用户重复请求、用户手动改写或撤销产出、用户放弃转向等行为信号，可复用即**自行记录**
  （`--prompt-material` 自造确定性事件身份，不依赖 hook 信号与用户纠错词）。
  该义务由 **Stop 硬门禁强制**（owner 授权 2026-09-17，解除原「Stop 与控制面重复」禁用）：
  会话结束时若有未消化纠错信号或本会话未 `selfcheck` 留痕，结束请求被拦截并给出处理指令；
  每会话最多拦截 3 次，超限 fail-open 放行并写审计日志（`stop-gate-audit.log`）；
  宿主 `stop_hook_active` 直接放行；门禁自身异常放行但留审计（状态目录不可用时退系统 TEMP），
  拦截前先确保状态目录存在，绝不困住会话。
  无新教训时 `--action selfcheck --session <id> --finding none` 留痕即可正常结束。
- **政策制治理（autonomous 批次）**：owner 会话确认一次清扫政策（`policy-add`，政策存台账文件的政策围栏
  `vibe-experience-policies`，含 confirmedBy/source 凭据），此后 AI 按政策自治执行 `govern` 清扫；
  清扫条目完整进清扫日志（台账同名 `-清扫.md`），ID 永不复用、可恢复。`check` 输出
  `governance.dueForReview` 驱动治理时机（超过 14 天未治理或台账增长 ≥5）。
  重放命中已清扫/已退役经验的 `record` 幂等成功（只消化源信号，不恢复计数；恢复走清扫日志人工流程）。
- **Digest 兜底（修复批次 2026-09-18）**：注入的 record 模板必带 `--source-dedup-key`（record 即消化源信号，
  不会死循环卡 Stop 门禁）；无 dedupKey 的旧/损坏索引行由 Digest 维护命令按行内容哈希打 `legacy-` 标记消化，
  不再永久 pending。
- **不自动做的事（红线不变）**：升档（L1/L2/L3）、退役、adopt-anchor 一律必须用户逐次确认凭据；
  recorder 达到阈值只输出 `atThreshold=true` 供 AI 向用户报告；无登记政策绝不执行清扫。
- **工具等价性**：正文引用的 `tools/experience-governance.mjs`（源快照）的 `record` 动作
  在目标项目由 `experience-recorder.mjs` 等价承载（台账 v2 形状与快照
  `experience-ledger-core.mjs` 镜像一致）；elevate / retire / adopt-anchor 仍无自动化层，
  遇到这些步骤时如实报告「自动化层未接入」，不得假装完成，也不得手写台账 JSON。
- **宿主差异**：Claude Code 与 ZCode 注册全部启用事件（含 Stop 门禁）；**Codex 为 capture-only**
  （注入与 Stop 语义未验证，显式跳过 Stop），常备规则由项目 AGENTS.md 的经验治理文本承载。
- **既有轻量形态条款仍然有效**：`.vibe-docs.json` 治理基础设施与其余 `tools/*.mjs`
  自动化脚本族仍留在源快照，未来以独立批次裁决接入。
