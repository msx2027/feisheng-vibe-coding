# Vibe 独立交叉审计（v5）合并与 adapter-candidate 登记决策

日期：2026-09-10
主 Agent 目标：G2（独立审查）+ G2b（登记决策）
关联任务包：tasks/20260910-vibe-independent-audit-v5.md

## 一、独立审查结果（v5，宿主恢复后重派，新标识）

宿主恢复后按交接要求以 v5 新标识重派两个独立只读审计；两个都产出回执：

| 审计 | 标识 | 覆盖 | 结论 |
|---|---|---|---|
| 产品/checker 组 | `luna_vibe_product_audit_v5c` | 29 项 | 29/29 SHA 与 catalog 一致；29/29 调用类型均为 `user-invocable:false` + `disable-model-invocation:true`；控制面关键字（CANONICAL-CATALOG/OWNER-LEDGER/runtime-projection/route-catalog/target-truth）在候选目录 152 文件及全树 550 文件中 0 命中；与本地证据全维度一致 |
| UI/许可证组 | `luna_vibe_ui_audit_v5` | 16 项（严格过滤） | 16/16 SHA 一致；54 ttf / 27 OFL，6 个缺口字体事实成立且已由 `legal/fonts/` 补齐有效 OFL-1.1；ui-system-guardian 来源声明 sourceCommit 与上游 MANIFEST 一致；16/16 frontmatter 合规；无第二入口 |

证据：`evidence/20260910-vibe-product-audit-v5.md`、`evidence/20260910-vibe-ui-audit-v5.md`。

## 二、独立审查发现并已更正的事实（16 vs 17）

UI 组本地证据把范围写成「17 个 UI 技能」，但 catalog 中 `status=source-only-ui` 实际为 **16 项**：

- 差异项：`ui-system-guardian`，catalog 实际状态 `source-only-product-or-checker`。
- 主 Agent 本地复算确认 16 项；已在 `evidence/20260910-vibe-ui-audit-local.md` 顶部追加 v5 更正说明。
- 该更正不影响：字体缺口事实、ui-system-guardian 来源缺口、frontmatter、无第二入口等结论。
- 许可证台账 `provenance/LICENSE-MAP.json` 的 `vibePerSkill` 已把 `ui-system-guardian` 归入 `vibe-original-product-checker` 族，与 catalog 状态一致。

## 三、adapter-candidate 登记决策

### 决策

**本轮不把任何 Vibe 技能从 `source-only-*` 改为 `adapter-candidate`；保持全部 Vibe 状态不变。**

### 理由

1. `AGENTS.md` 验收规则：「发现重复入口、重复写入者、manifest drift、来源不明或**宿主证据缺失时停止迁移**」。Vibe 技能的真实宿主（Codex/Claude）discovery / trust / 触发行为均为 `UNVERIFIED`，宿主证据缺失。
2. `AGENTS.md`：「没有新鲜验证不得声明完成、可发布或宿主 Hook 已强制生效」。v5 独立审查覆盖的是快照/逻辑/许可证层，明确声明不做宿主行为验证，不足以支撑向运行时方向的状态迁移。
3. `evidence/20260910-canonical-catalog.md` 未验证项仍成立：Vibe UI/产品技能「行为 smoke」未完成；行为 smoke 需真实宿主执行。
4. 状态迁移在本仓库是按 `scripts/build-canonical-catalog.ps1` 生成器硬编码分类完成的；在宿主证据缺失时改动生成器分类属于迁移动作，按第 1 条应停止。

### 已完成的前置条件（不再构成阻塞）

| 前置条件 | 状态 | 证据 |
|---|---|---|
| 逐技能许可证映射 | ✅ 完成（46/46，8 族） | `provenance/LICENSE-MAP.json` `vibePerSkill` |
| 字体许可证缺口 | ✅ 完成（IBMPlexSerif/InstrumentSerif OFL-1.1 + 上游 revision） | `legal/fonts/NOTICE.md` |
| ui-system-guardian 来源声明 | ✅ 完成 | `legal/ui-system-guardian/SOURCE-DECLARATION.md` |
| 独立交叉审查（快照/逻辑层） | ✅ 完成（v5 双组） | v5 evidence ×2 |
| 无第二入口 / 无越权 | ✅ 确认 | v5 双组 + 本地审计 |
| 宿主 discovery/trust/行为 smoke | ❌ 缺失（P1 未解锁） | 未验证项 |

### 解除本决策所需的下一步

1. 真实宿主（Codex/Claude）授权安装 + discovery/fresh-session smoke，产出宿主证据；
2. 或由 owner 在 `provenance/OWNER-LEDGER.json` 显式授权「仅分类登记、不进入运行时」的有界迁移；
3. 满足后，按「一个有界能力组」分批改 `scripts/build-canonical-catalog.ps1` 的分类列表并重生成 catalog，每批运行投影/NOTICE/Hook 全套 smoke。

### 安全边界（本次已确认）

- 未修改 `CANONICAL-CATALOG.json`、生成器分类、`packaging/runtime-projection.json`、`OWNER-LEDGER.json`。
- 全部 Vibe 技能仍未进入任何 runtime projection；`runtimeEligible=false` 未变。
- 事件类三技能保持 `event-only-source-only`；`vibe-coding-skills` 保持 `compatibility-alias`。

## 四、未验证项

- 真实宿主发现/触发/trust；fresh-session smoke（`UNVERIFIED`）。
- ui-ux-pro-max data CSV 上游数据许可的在线核对（bundled MIT 声明覆盖，但未在线比对）。
- 字体 OFL 上游 revision 的在线复核（v5 审计未联网；本轮主 Agent 抓取过 raw 文本与 commit，见 `legal/fonts/NOTICE.md`）。
