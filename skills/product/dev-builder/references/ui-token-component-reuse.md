# UI / Token / 组件复用护栏

> 读取时机：目标项目涉及正式前端页面、Electron renderer、PWA、官网、后台、设计稿落地、组件库、样式体系、design token、theme、Tailwind config、全局 CSS 变量或页面层视觉样式时。

## 核心模式

正式 UI 开发默认遵守这条链路：

`设计源 -> token 文档 -> 组件盘点 -> UI 包 -> 复审证据 -> 门禁脚本`

不要只加一条“注意复用组件”的软提醒。目标是让后续开发不会在页面层长出第二套按钮、输入、弹窗、卡片、状态、颜色、圆角和阴影。

## 开工前识别

1. 先读目标项目 `.vibe-docs.json`，优先定位这些角色：
   - `designBrief`
   - `designLanguageTokens`
   - `componentInventory`
   - `designReviewReport`
2. 扫描目标项目是否已有 UI 包或设计系统入口：
   - 常见路径：`packages/ui`、`src/shared/ui`、`src/ui`、`src/components/ui`、`libs/ui`
   - 常见包名：`@<project>/ui`、`@app/ui`
   - 常见样式入口：`styles.css`、`tokens.css`、`theme.css`
3. 扫描是否已有门禁或检查脚本：
   - `check-ui-design-system-usage`
   - `check-ui-reuse`
   - `check-design-token`
   - `check-token`
   - `component parity`
   - `visual audit`
4. 如果没有现成 UI 包，但本轮要做正式前端页面，先建立最小 `src/shared/ui` / UI 目录和 token 入口，再写页面。

## 硬规则

- 正式前端页面层只负责业务布局、数据绑定和组件组合。
- 按钮、输入、弹窗、导航、标签、列表行、卡片、状态、颜色、圆角、阴影等视觉基础件，优先从目标项目 UI 包复用。
- 缺少组件、slot、variant 或 token 时，先扩展 UI 包和 token 文档，再在页面中消费。
- 不在正式页面层直接声明新的设计 token、全局 CSS 变量或 theme 变量。
- 不在正式页面层使用裸 hex/rgb/hsl 色值、临时 box-shadow、临时 border-radius 或重复基础组件样式。
- 不手搓 `Button`、`Input`、`Modal`、`Dialog`、`Card`、`Badge`、`Tabs`、`Toast`、`Popover` 等基础组件名；需要新语义时先放到 UI 包。
- 如确需原生控件、裸色值或局部视觉样式，必须写清原因，并使用 `vibe-ui-allow-next-line: <reason>` / `vibe-ui-allow-file: <reason>` 或目标项目等价豁免机制。

## UI 精修 / 复刻边界

- 精修 UI、复刻 UI、image-to-code、截图 / 设计稿还原和视觉 polish 默认只实现呈现层和必要纯 UI 状态。
- 如果目标项目没有对应功能、接口、状态流、数据模型或业务流程，不得为了让 UI 看起来完整而新增真实业务逻辑、接口调用、持久化、权限、提交、支付、删除或后台任务。
- 允许使用占位符、mock 数据、disabled 状态、noop 回调、TODO、静态 UI 状态或“待接入”标记；这些内容必须在交付时说明，不能伪装成真实完成。
- 用户明确要求开发对应功能、接入接口、补齐逻辑或让操作真实生效时，才进入业务开发链路，并按 `execution tier` 重新分类、规划和验证。

## 文档同步

改动 UI 包、token、组件或正式页面视觉体系时，同步检查并更新：

- token 文档：目标项目 `.vibe-docs.json.designLanguageTokens`，默认可为 `设计令牌.md`
- 组件盘点：目标项目 `.vibe-docs.json.componentInventory`，默认可为 `组件盘点.md`
- 复审报告：目标项目 `.vibe-docs.json.designReviewReport`，默认可为 `复审报告.md`
- UI 包 README 或组件索引
- 预览页、组件验收页或截图证据目录
- 门禁脚本或测试说明

## 验证优先级

按目标项目已有能力选择最轻但足够的验证：

1. UI 包类型检查 / 构建，例如 `pnpm --filter <ui-package> typecheck`
2. UI 预览构建，例如 `pnpm --filter <ui-package> preview:build`
3. token parity / component export parity 测试
4. 正式前端设计系统复用门禁
   - 优先运行 `node tools/check-ui-reuse.mjs . --all` 或目标项目的 `npm run check:ui-reuse`
5. 组件级截图 / 设计源局部截图 / 左右对照图

只有整页截图不够证明组件级通过。组件、token 或视觉基础件变更时，优先补组件级证据。

## 可迁移范式

如果目标项目没有现成命名，不要硬编码 `@ddzj/ui` 或 `--ddzj-*`；应按项目名生成自己的 UI 包名和 token 前缀。但治理结构保持一致：

- 一个 UI 包或 UI 目录承载唯一设计系统。
- 一个 token 文档记录唯一参数口径。
- 一个组件盘点记录真实组件族和尺寸收口。
- 一个复审报告记录设计源、前端预览、组件级证据和旧标准裁撤。
- 一个门禁脚本阻止页面层绕过 UI 包和 token；新 Web / Desktop 脚手架默认使用 `tools/check-ui-reuse.mjs`。
