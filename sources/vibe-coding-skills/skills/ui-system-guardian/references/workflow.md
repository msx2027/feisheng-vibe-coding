# ui-system-guardian workflow

[DocMap]
    层级：L4 / UI 系统治理参考
    模块：初始化、扩展、迁移和门禁流程
    依赖：
    - `skills/ui-system-guardian/SKILL.md`
    - 目标项目 UI root
    - 目标项目 `.vibe-docs.json`
    - 目标项目设计令牌 / 组件盘点 / 复审报告
    输出：
    - 可执行治理步骤
    - 文档同步点
    - 验证命令

## 1. 通用起手

1. 识别目标项目根目录、前端栈、包管理器和源码入口。
2. 执行 UI root 决策协议：枚举 `package.json` workspaces、`pnpm-workspace.yaml`、Turbo / Nx 配置、`apps/`、`packages/`、`libs/`、目标 app 入口、`package.json` exports、`tsconfig` paths 和构建 alias。
3. 查找 UI root：`packages/ui`、`packages/design-system`、`src/shared/ui`、`src/ui`、`src/components/ui`、`libs/ui`、`libs/components`，以及已被页面引用的非标准 UI / design-system / components 包。
4. 查找 token/theme 文件：`tokens.css`、`theme.css`、`design-tokens.*`、`tailwind.config.*`。
5. 读取 `.vibe-docs.json`，确认 `designLanguageTokens`、`componentInventory`、`designReviewReport`、`uiGovernanceReport` 映射。
6. 查找门禁：`tools/check-ui-reuse.mjs`、`package.json` 的 `check:ui-reuse`、build 前置脚本。
7. 判定本轮是 `init`、`extend`、`migrate` 还是 `gate`。
8. 多候选、非标准 root 或已有大量引用时，优先复用既有入口；未证明不可复用前不得创建新的 `src/shared/ui`。

## 2. init 流程

适用：目标项目缺少 UI root、token 入口、组件盘点或 UI 复用门禁。

1. 先完成 UI root 决策协议；只有证明没有可复用 UI root 后，才在目标 app 内创建最小 `src/shared/ui`。
2. 创建或补齐 `tokens.css`，只放语义 token 和最小基础比例。
3. 创建或补齐基础组件入口：`Button`、`Card`、必要的 `index.ts`。
4. 让应用入口导入 token 文件，页面从 UI root 消费组件。
5. 补 `.vibe-docs.json` 映射：`designLanguageTokens`、`componentInventory`、`designReviewReport`，需要长期治理时再补 `uiGovernanceReport = 界面治理.md`。
6. 复制或接入 `tools/check-ui-reuse.mjs`，在 `package.json` 增加 `check:ui-reuse`；如有 build，build 先跑该脚本。
7. 运行 `npm run check:ui-reuse` 或 `node tools/check-ui-reuse.mjs . --all`。

## 3. extend 流程

适用：页面需要的组件、slot、variant 或 token 不存在。

1. 先把需求翻译成系统缺口：是 token、组件、variant、slot、状态还是布局容器。
2. token 缺口写入 token 文件和 `设计令牌.md`，避免把一次性页面颜色升格为长期主题。
3. 组件缺口写入 UI root，并在 `组件盘点.md` 记录用途、props、variant、状态和消费页面。
4. 页面改为引用 UI root，不保留重复基础视觉代码。
5. 更新 `复审报告.md` 或 `界面治理.md`，记录设计源、前端证据、旧实现裁撤情况。
6. 运行 UI 复用门禁和项目最小构建 / 类型检查。

## 4. migrate 流程

适用：页面层已经散落基础组件或裸视觉值。

1. 先按页面 / 组件族分组，不一次性跨太多业务路径。
2. 把本地 `Button`、`Input`、`Modal`、`Card`、`Badge`、`Tabs` 等迁到 UI root，保留页面业务 props。
3. 把裸色值、圆角、阴影、间距比例迁到 token 或组件 variant。
4. 页面层只保留布局、数据绑定、事件连接和组件组合。
5. 如要删除迁移后不再使用的本地基础组件和重复样式，先列出候选文件、引用扫描命令、构建 / 类型检查或等价验证、rollback 方案。
6. 无法证明 unused 或无法提供 rollback 时，不删除；只标记 deprecated，并把后续清理写入 `界面治理.md`。
7. 运行 `check-ui-reuse`；如涉及视觉体验，补截图、预览或人工验收提醒。

## 5. gate 流程

适用：门禁缺失、失败、误报或需要解释。

1. 确认是否已有 `tools/check-ui-reuse.mjs`，优先复用本分发包版本。
2. 确认 `package.json` 是否有 `check:ui-reuse`，正式项目 build 是否先执行它。
3. 对失败项逐条分类：页面层裸视觉值、基础组件重复声明、原生控件、allow 注释缺 reason、UI root 识别错误。
4. 能回到 UI 包的必须修；确需例外时加 allow 注释并写清 reason。
5. 复跑门禁并记录命令、结果和残余例外。

## 6. 收口证据

- 必选：本轮改动后的文件清单、UI root 决策证据、token / 文档同步说明。
- 优先：`npm run check:ui-reuse` 或 `node tools/check-ui-reuse.mjs . --all`。
- 按需：类型检查、build、组件预览、Playwright 截图、unused 证明、rollback 方案或人工验收提醒。
- 文档：`设计令牌.md`、`组件盘点.md`、`复审报告.md`、`界面治理.md` 只在本轮对应内容发生变化时更新。
