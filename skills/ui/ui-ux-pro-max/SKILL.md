---
name: ui-ux-pro-max
description: '仅当用户先明确调用 `feisheng-vibe-coding` 总入口并指定 `ui-ux-pro-max`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发。UI/UX design intelligence for explicit design enhancement requests: visual direction, color, typography, tokens, design system, UX quality, accessibility, layout, chart, and stack-specific UI guidance. Use only when the user asks for design enhancement or another Skill routes here; ordinary page design stays on the product/design main chain.'
user-invocable: false
disable-model-invocation: true
---
[Vibe Coding Adapter]
    本 Skill 继承 `AGENTS.md` / `CLAUDE.md` 主控纪律，不绕过 execution tier、四字中文目标项目文档、人工验收、接口契约、UI / token / 组件复用和按需加载规则。

    本 Skill 是设计增强层，不是普通页面设计默认入口。用户只说“前端页面设计 / 页面方案 / 做个页面”时，先走 `product-spec-builder -> design-brief-builder -> design-maker -> dev-planner / dev-builder`；只有明确提到配色、字体、tokens、design system、样式体系、视觉方向、UX 质量、可访问性、图表或 stack-specific UI guidance 时才进入本 Skill。

[任务]
    **设计系统建议**：根据产品类型、行业、情绪关键词和技术栈，用本 Skill 的查询脚本生成或补充视觉方向、颜色、字体、布局、效果和反模式建议。

    **专项深挖**：当用户明确要配色、字体、图表、landing structure、UX guideline、stack best practices 或 Google Fonts 候选时，按 domain / stack 查询，只返回当前任务需要的结果。

    **UI 质量复核**：当用户明确要求 UI/UX review、accessibility、visual consistency 或 pre-delivery polish 时，读取命中的 checklist reference，并把结论绑定当前代码 / 设计证据。

[触发边界]
    进入本 Skill：
    - 用户显式点名 `ui-ux-pro-max`。
    - 用户明确说配色、字体、tokens、design system、样式体系、视觉方向、UX、accessibility、chart、stack UI best practices。
    - 其他 Skill 已经完成产品 / 设计主链路，并需要增强层补充设计决策。

    不进入本 Skill：
    - 普通前端页面设计、需求梳理、开发计划或实际编码任务。
    - 初始化组件库、补 token、补组件、治理 UI 债务或 `check-ui-reuse` 失败；这些进入 `ui-system-guardian`。
    - 只要求 critique、audit、polish、布局、排版等质量层时，优先进入对应专门 Skill；本 Skill 只作为资料查询辅助。

[第一性原则]
    **数据留在磁盘**：`data/*.csv` 和字体 / 资料资产不进入模型上下文；需要建议时运行 `scripts/search.py`，只读取小结果。

    **先产品语境，后视觉建议**：没有产品类型、目标用户、使用场景和技术栈时，先从已有需求 / 设计文档或用户上下文提取；仍缺关键项时只问一个会改变设计方向的问题。

    **增强不替代主链路**：本 Skill 输出视觉和 UX 建议，不替代需求文档、设计简报、开发计划、代码实现或人工验收。

    **组件与 token 优先**：正式前端页面落地时，优先复用目标项目 UI 包、design tokens、组件盘点和 `check-ui-reuse` 门禁；缺基础组件时回到 `ui-system-guardian`，不要在页面层手搓第二套。

[最小使用流程]
    1. 明确 query：产品类型 + 行业 / 受众 + 设计关键词 + 当前 stack。
    2. 首选生成设计系统：
       `python skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "<Project Name>"`
    3. 需要专项补充时再查 domain 或 stack：
       `python skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> -n 3`
       `python skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack <stack> -n 3`
    4. 只把命中的小结果用于当前任务；不要打开整份 CSV。

[按需加载 references]
    本 Skill 的 `SKILL.md` 只保留触发边界、查询入口和输出契约。不要默认读取全部 references。

    | Reference | 读取时机 |
    | --- | --- |
    | `references/cli-usage.md` | 需要完整命令、domain / stack 列表、持久化设计系统或输出格式时。 |
    | `references/quick-reference.md` | 需要 UI/UX 规则分类、优先级、常见问题定位或专项复核时。 |
    | `references/professional-ui-checklist.md` | 交付前做视觉质量、交互、主题、布局或 accessibility checklist 时。 |

[输出契约]
    - 先说明为什么本轮需要设计增强层，而不是普通页面主链路或 `ui-system-guardian`。
    - 给出当前 query、使用的 domain / stack 和查询命令。
    - 输出 3-7 条当前任务可执行的设计决策，避免泛泛列百科规则。
    - 如果建议会影响真实页面实现，说明应落到 design tokens、UI 包、组件 variant 还是页面组合层。
    - 如需要用户肉眼确认视觉质量，交付时标记人工验收状态为 `待用户验收`。

[初始化]
    1. 判断是否命中 [触发边界]。
    2. 如果只是普通页面设计或 UI 债务治理，交回主链路或 `ui-system-guardian`。
    3. 命中后先用查询脚本获取小结果；只有需要完整细则时才读取对应 reference。
