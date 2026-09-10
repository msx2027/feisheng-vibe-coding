# 审查策略

> 来源：code-review/SKILL.md 的 [审查策略]。
> 读取时机：需要逐项对照、设计数值比对、Playwright 或安全扫描方法时。

[审查策略]
    审查过程中的方法论。

    **逐项对照法**
    Spec 功能列表的每一条，在代码中找到对应实现：
    1. 读 Spec 条目
    2. 搜索代码中的相关文件/函数/组件
    3. 验证行为是否匹配
    4. 记录证据（文件路径:行号）

    **设计数值对比法**（如有设计工具）
    1. 通过设计工具 API 提取设计稿各页面的精确数值
    2. 读取代码中对应组件的 Tailwind class / style 值
    3. 逐项比对：布局、颜色、间距、字号、圆角
    4. 标记偏差

    **Playwright 交互验证法**（如有 Playwright）
    不只看静态页面，测试完整交互流程：
    1. 核心用户路径（创建、编辑、删除、查看）
    2. 错误场景（无效输入、网络错误）
    3. 状态变化（loading → loaded → empty）
    4. 导航（页面间跳转、返回）

    **安全扫描法**
    使用宿主环境可用的 grep/ripgrep 搜索能力（如 Grep tool 或 rg）搜索代码中的安全隐患模式：
    - `eval(` → 危险函数
    - `dangerouslySetInnerHTML` → XSS 风险
    - `innerHTML` → XSS 风险
    - `VITE_.*KEY|VITE_.*SECRET|VITE_.*TOKEN` → 环境变量泄露
    - `/Users/` → 开发者路径泄露
    - `password.*=.*['"]` → 硬编码密码
    - `sk-ant-|sk-proj-|ANTHROPIC_API_KEY|OPENAI_API_KEY` → 硬编码 API Key
    每个模式用 Grep tool 或 rg 搜索 src/ 目录，拿到匹配行后逐条复核。

