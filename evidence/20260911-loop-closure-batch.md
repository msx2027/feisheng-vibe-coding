# 证据：闭环补全批——29 个能力接入，vibe coding 全链路闭环

- 日期：2026-09-11
- 决策授权：owner 指示「确认这一整套技能可以在 vibe coding 时闭环；按第一性原理决策搬哪些；自己用不管许可证；目标是新手小白靠这一个包能开发商用级产品」
- 提交：`8c800d7` + 本证据提交

## 闭环决策（按新手 → 商用级产品的旅程推演）

| 旅程阶段 | 接入能力 | 补上的空白 |
|---|---|---|
| 想法 → 产品规格 | product-spec-builder（0-1 深挖对话 → 开发可直接用的 Product Spec） | 小白写不了 PRD |
| 想法 → 视觉方向 | design-brief-builder（设计师采访式收设计需求 → 设计简报） | 小白说不出设计需求 |
| 开发前定架构 | architecture-foundation（范围/边界/数据/权限/部署决定落真源，PASS 才进开发） | 商用级架构不烂的门 |
| 规格 → 计划 | dev-planner（读需求和设计简报 → 分阶段开发计划） | 多阶段交付的路线图 |
| 计划 → 编码 | dev-builder（初始化骨架/装依赖/按 Phase 编码/集成验证/用户确认，65 文件） | 小白不会写代码——这是真正动手开发的主手（补录发现，design-brief-builder 明确喂给它） |
| 需求 → 验收 | requirements-test-designer（PRD/用户故事 → 生产级测试设计） | 商用级验收标准 |
| UI 实现 | impeccable（12 技能族：craft 工作流 + adapt/animate/bolder/colorize/delight/distill/layout/overdrive/polish/quieter/typeset） | 小白完全不会做 UI |
| UI 体系 | design-system、ui-styling、brand、ui-ux-pro-max | 商用级一致性（token/组件/品牌） |
| UI 治理 | ui-system-guardian（组件库初始化、token 补齐、UI 债务审计，自带检查工具） | 长期迭代 UI 不烂 |
| 缺陷修复 | bug-fixer（大白话报障 → 分级修复流程） | 小白只会说"坏了" |
| 测试 | test-automation（E2E/回归/Playwright/Vitest + fresh 证据） | 自动化测试接入 |
| 发布 | release-builder（构建-打包-测试-发布，隐私与漏洞检查） | 商用级上线 |
| 沉淀 | rule-harvester（规则淘金）、doc-sync-guardian（文档防漂移）、hotspot-governor（热区治理） | 长期项目不烂 |

**决策不搬（13 个）及理由**：design-maker、codebase-memory-scout（依赖外部 MCP，未配置即死代码）；
clarify、shape、beginner-flow-guide（语义未审查，且边缘场景）；skill-builder、evolution-engine、
experience-elevator、feedback-writer（Hook/子 Agent 结构化事件驱动，须等 T6 Hook 解锁，搬了也是死代码）；
target-constitution-setup、target-runtime-setup（与控制面自带 bootstrap/adoption 模板重叠，避免第二真源写入者）；
vibe-code-review（与已接入 code-review 职能重叠）；vibe-coding-skills 别名（旧总入口，已退役）。

## 实施记录

1. **许可证策略（owner 豁免）**：`vibe-original-product-checker` 族 `runtimeEligible` false→true，
   reason 记录 owner 2026-09-11 豁免（仅本机自用、不对再分发；再分发前仍需上游逐技能许可证或独立法律审查）。
   这是 owner 对既定策略的显式修改，不是绕过。
2. **新运行时状态**：statusPolicy 增加 `product-or-checker|accepted → accepted-product`、`ui|accepted → accepted-ui`；
   runtimePolicy.acceptedStatuses 同步纳入；reasonsByStatus 补两条。
3. **目录约定扩展**：generator `Get-RecordPath` 与导入脚本按 domain 分组落点
   （checker→`skills/checker/`，product-or-checker→`skills/product/`，ui→`skills/ui/`），未定义 domain fail-closed；
   导入脚本改为幂等（已入 VIBE-IMPORTS 台账的记录跳过，支持分批晋升）。
4. **物理导入**：27 个技能目录从快照逐字节复制（含 agents/ 排除策略），逐文件 SHA 复核，
   台账 `VIBE-IMPORTS.json` 累计 31 条（4 + 27），副本与快照一致性门禁覆盖 **244 文件全对**。
5. **路由绑定**：engineering-execution.md 委托表新增 27 行（36 个 provider 各自唯一命中；
   vendored CRLF 逐字节插入，0 混入 LF；LOCAL-PATCHES 更新 patchedSha256，完整性重算通过）。

## 验证

- 本机门禁 **13/13**：runtime include 94→**399 文件**；路由绑定 admitted=**38** bound=**38**；NOTICE runtime items=40
- fresh clone 四组合（autocrlf true/false × pwsh/PS5.1）**全部 13/13**（最终 HEAD `698ba42` 复测）
- 共享根重装：**401 文件**（sourceRevision=`698ba42`，builder Validate 通过）；目录 checker/engineering/product/ui 四组
- Codex `debug prompt-input`：注入总条目 229+，包内 40 个 SKILL.md 全部可见（抽查 product-spec-builder/impeccable/
  bug-fixer/release-builder/rule-harvester/ui-ux-pro-max 均在包内路径）

## UNVERIFIED / 遗留

- 27 个新能力的**逐技能宿主行为 smoke**：UNVERIFIED——统一入口链路（D2/D3）已实测可达包内任意技能，
  但每个技能在真实任务中的产出质量未被逐一检验，按「用一次验一次」推进
- `.vibe-docs.json` 定位器语义：新接入技能优先读该索引、缺省回落默认文档路径（实测为读取式而非强制依赖），
  与全局路由块「不再创建 .vibe-docs.json」的兼容性在真实任务中观察
- ui-styling 含 93 文件（含字体资产，OFL 许可证映射已在 legal/fonts/NOTICE.md），包体变大属预期
- Hook 自动沉淀三件套（experience-elevator/evolution-engine/feedback-writer）：等 T6
