# ui-system-guardian audit rules

[DocMap]
    层级：L4 / UI 系统治理参考
    模块：UI 债务审计规则
    依赖：
    - `skills/ui-system-guardian/SKILL.md`
    - `tools/check-ui-reuse.mjs`
    输出：
    - UI 债务分类
    - 优先级
    - 修复建议

## 1. 扫描对象

- 页面层：`app/**`、`pages/**`、`src/app/**`、`src/pages/**`，以及 `src/features/**` 下的 `*page*`、`*screen*`、`*view*` 文件。
- UI root：`packages/ui`、`packages/design-system`、`src/shared/ui`、`src/ui`、`src/components/ui`、`libs/ui`、`libs/components`，以及已被页面引用的非标准 UI / design-system / components 包。
- token/theme：`tokens.css`、`theme.css`、`design-tokens.*`、`tailwind.config.*`。
- 文档：`.vibe-docs.json`、`设计令牌.md`、`组件盘点.md`、`复审报告.md`、`界面治理.md`。

## 2. P0 必修问题

- 正式页面没有 UI root，却已经开始手搓基础视觉件。
- monorepo / 多 app 项目没有执行 UI root 决策协议，就新建第二套 `src/shared/ui`。
- 非 UI root 中声明 `Button`、`Input`、`Modal`、`Dialog`、`Card`、`Badge`、`Tabs`、`Toast`、`Popover` 等基础组件。
- `check-ui-reuse` 缺失、被绕过，或 build 不再运行 `check:ui-reuse`。
- 大面积页面层复制同一套视觉基础样式，导致后续主题或组件调整无法集中修改。

处理：先建立或修复 UI root 和门禁，再迁移页面消费。

## 3. P1 高优先问题

- 页面层裸 `#hex`、`rgb()`、`hsl()`、`oklch()` 颜色。
- 页面层 Tailwind 任意视觉值：`bg-[#...]`、`text-[rgb(...)]`、`rounded-[...]`、`shadow-[...]`。
- 页面层 `box-shadow`、`border-radius` 或临时 CSS 视觉基础值。
- 页面层直接使用 `<button>`、`<input>`、`<select>`、`<textarea>`、`<dialog>`，且没有明确 allow reason。

处理：优先迁到 token、variant 或 UI 组件；确需例外时补 allow 注释和文档说明。

## 4. P2 中优先问题

- token 命名偏具体页面，缺少语义层。
- 组件已有但缺少必要 variant / size / state，导致页面用 className 覆盖组件视觉。
- `组件盘点.md` 没有记录新增组件、props、variant 或消费位置。
- `复审报告.md` 没有记录设计源、前端预览或旧标准裁撤。

处理：补文档和组件 API，减少页面层覆盖。

## 5. P3 整洁问题

- UI 包 README 或使用示例缺失。
- 组件命名大小写、导出路径或目录组织不统一。
- 旧样式文件已经不再使用但未清理。
- 治理报告缺少剩余债务、后续回归触发条件或人工验收状态。

处理：随本轮治理收口，不为 P3 单独扩大改动面。

## 6. allow 注释判断

- `vibe-ui-allow-next-line: <reason>` 只允许豁免下一行。
- `vibe-ui-allow-file: <reason>` 只允许豁免当前文件。
- reason 不能为空，也不能只写 `todo`、`temp`、`fix later` 这类无解释文字。
- allow 不能替代系统缺口修复；同类 allow 反复出现时，应升级为 token 或组件缺口。

## 7. 审计输出格式

审计报告按这个顺序输出：

1. UI 系统现状：workspace / apps / packages / libs、UI root、token、文档、门禁是否存在。
2. P0-P3 问题清单：每项带文件路径、证据和影响。
3. 推荐治理顺序：先门禁和 UI root，再 token / 组件，再页面迁移。
4. 本轮可自动化验证：`check-ui-reuse`、build、类型检查、截图或人工验收。
5. 文档同步项：设计令牌、组件盘点、复审报告、界面治理。
