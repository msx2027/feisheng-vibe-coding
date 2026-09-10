---
name: skill-template
description: 新 Skill 的骨架模板。创建新 Skill 时，复制此模板并替换 [占位符] 为实际内容。必须有的 Section 不可删除，推荐有的根据需要保留或删除，按需有的按实际情况添加。
---

# Skill 骨架模板

创建新 Skill 时，复制以下内容，替换 [占位符]，删除不需要的可选 Section。

---

## 必须有的 Section

```markdown
---
name: [skill-name]
description: [一句话描述：什么时候用、做什么、产出什么]
---

[任务]
    [一句话说清楚这个 Skill 做什么。如有多种模式则分别说明。]

[依赖检测]
    Skill 启动时第一步自动执行。

    必需：
    - [前置文件] → 缺失则提示引导操作
    - [系统工具] → 缺失则记录阻塞并说明所缺能力

    可选：
    - [可选依赖] → 缺失则标记降级模式继续工作

    安装策略：
    - 新增依赖前先检查标准库、平台自带能力和项目已安装依赖；确实不够时说明缺口，等待用户明确同意后才能安装
    - 未获用户明确同意时，不执行任何安装命令；必需依赖记为阻塞，可选依赖进入降级模式
    - 需要用户权限或用户交互时，提示用户操作
    - 可选依赖缺失时，标记降级模式，不阻塞流程

[本包治理继承]
    创建或执行本 Skill 时必须继承本包主控纪律：
    - 先判定 `execution tier`；命中 Skill / Hook / Tool / Agent、发布、权限、安全、数据、文件系统、shell、network 等风险时按 T3+ hazard mode 执行
    - 目标项目生命周期文档先读 `.vibe-docs.json`，再按角色映射读写四字中文 `.md`；新生成文档必须符合 `^[\u4e00-\u9fff]{4}\.md$`
    - 需要用户真实点击、操作或观察时，输出人工验收状态；只有用户明确确认后才能记录为 `用户已确认`
    - 涉及真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 时，先读 `.vibe-docs.json.interfaceContracts` 映射的 `接口契约.md`，同一业务能力只复用或扩展一个统一入口
    - 正式前端页面先识别 UI 包、design tokens、组件盘点、设计复审报告和设计系统复用门禁；页面层优先复用 UI / token / 组件
    - references 采用 progressive references：先读 `SKILL.md`，只在下方 [按需加载 references] 表命中时读取对应 reference
    - 涉及 `.pen` 或 Pencil 时，必须使用 Pencil desktop 客户端和 desktop MCP server；不得 fallback 到 VS Code

[第一性原则]
    **不编造**：涉及外部知识、第三方 API、CLI、模型名、端点、参数、版本或命令语法时，先查文档再执行；不确定就明确说不确定。
    **不隐瞒**：测试失败、未验证、权限不足、环境缺失、无法复现时直接说明，不用软性措辞粉饰结果。
    **主动纠偏**：发现用户前提错误、方向风险、需求冲突或约束矛盾时，必须指出并说明影响。
    **验证门禁**：没有完成最小必要验证，不得声明完成；无法验证时明确写“未验证”及原因。
    **尊重现有结构**：改动前先读现有目录、接口、计划和文档，不随意重组结构，不覆盖既有约定。
    **联网优先**：涉及外部知识时先 WebSearch 确认再动手。

[文件结构]
    ```
    [skill-name]/
    └── SKILL.md
    ```

[按需加载 references]
    不默认全量读取 references；只在当前任务命中下表场景时读取对应文件。

    | 场景 | 读取 |
    | --- | --- |
    | [场景 A] | `references/[file-a].md` |
    | [场景 B] | `references/[file-b].md` |
    | 无 references | 写明“无，保持按需加载策略” |

[工作流程]
    [第一步：XXX]
        [具体操作]

    [第二步：XXX]
        [具体操作]

    [第N步：XXX]
        [具体操作]

[初始化]
    执行 [第一步：XXX]
```

## 推荐有的 Section

```markdown
[输出风格]
    **语态**：
    - 用户未指定其他语言时，默认中文；技术名词保留英文，必要时补中文说明
    - 简洁直接，先说结果，再说风险和未验证项

    **原则**：
    - x 用“应该可以”“大概率没问题”“看起来正确”替代验证结果
    - x 把关键决策丢给开放题
    - v 需要用户决策时给 2-3 个具体选项和取舍
    - v 汇报优先说功能变化、当前可见结果、风险和未验证项
    - v 无法验证时明确写“未验证：原因”

    **典型表达**：
    - "这轮先完成 X，当前能看到 Y；剩余风险是 Z。"
    - "这项还未验证，原因是 A；要验证需要 B。"

[XXX维度清单]
    [根据领域命名：需求维度清单 / 审查维度清单 / 开发规则清单 / ...]
    [列出这个 Skill 需要关注的所有维度或规则]

[XXX策略]
    [根据领域命名：对话策略 / 审查策略 / 开发策略 / ...]
    [描述执行方法论——怎么做]
```

## 按需有的 Section

```markdown
[信息充足度判断]
    收集/分析型 Skill 使用。判断何时信息足够可以输出。

    必须满足：
    - [条件]
    尽量满足：
    - [条件]

[回退策略]
    发布/部署类 Skill 使用。出问题时怎么回退。

[Phase 完成度判断]
    开发类 Skill 使用。Phase 完成的验证标准。

[多模式工作流程]
    如 Skill 有多种执行模式，分别写：
    [工作流程（模式A）]
    [工作流程（模式B）]
```

---

## 规范速查

| 项 | 规范 |
|----|------|
| Skill 名 | kebab-case（如 skill-builder、dev-planner） |
| 目录位置 | skills/[skill-name]/（同步到 .claude/skills/[skill-name]/ 和 .agents/skills/[skill-name]/） |
| 主文件 | SKILL.md |
| 模板文件 | templates/ 子目录（如有） |
| Section 标题 | [标题] 格式 |
| 内容缩进 | 四空格 |
| frontmatter | 只有 name 和 description |
| 语言 | 中文 |
| 治理继承 | 必须包含 `execution tier`、`.vibe-docs.json`、四字中文文档、人工验收、接口契约治理、UI / token / 组件复用、Pencil desktop 条件约束 |
| references | 必须有 [按需加载 references]；不默认全量读取 |
