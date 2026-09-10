# Professional UI Checklist

> 读取时机：交付前做视觉质量、交互、主题、布局或 accessibility checklist 时。

## Visual Quality

- 图标来自同一图标族，stroke、filled / outline 层级一致。
- 品牌资产使用官方比例、留白和颜色，不猜 logo、不随意改色。
- 色彩通过 semantic tokens 表达，不在页面层散落临时 raw hex。
- 圆角、阴影、描边、blur 和 elevation 有统一层级。
- 文本层级使用稳定 type scale，正文不低于可读尺寸。

## Interaction

- 所有可点击元素有 hover / pressed / disabled / loading 状态。
- 触控目标至少 44px（iOS）或 48dp（Android / Material）。
- loading 不造成布局跳动；异步按钮禁用并显示进度。
- 动画时长通常在 150-300ms，表达因果，不阻断输入。
- 键盘焦点顺序与视觉顺序一致，focus ring 可见。

## Light / Dark Mode

- 主文本对比度 >= 4.5:1，辅助文本 >= 3:1。
- border、divider、disabled、hover、pressed 状态在双主题下都可区分。
- Modal / drawer scrim 足以隔离背景，通常 40-60% black 起步。
- 不只验证一个主题后推断另一个主题。

## Layout

- 小屏、宽屏和横屏都不出现非预期横向滚动。
- fixed / sticky header、tab bar、CTA bar 不遮挡滚动内容。
- gutter 随断点调整，正文行长保持可读。
- 组件尺寸、按钮、tile、toolbar、board 等固定格式 UI 有稳定尺寸约束，状态变化不改布局。
- 页面 section 不靠卡片套卡片堆层级；重复项、modal 和 framed tool 才用 card。

## Accessibility

- 交互元素有语义角色和可理解 label。
- 表单字段有 label、hint、error，错误靠近字段。
- 颜色不是唯一状态编码；必要时用 icon、文字、pattern 或 shape 补充。
- meaningful image / icon 有替代文本或 accessibility label。
- reduced motion 下不丢功能，动态文字或缩放不破版。

## Handoff

- 每个建议说明落点：design token、UI 包、组件 variant、页面组合或文档。
- 自动化无法证明的视觉质量、真实点击、平台感受或品牌观感，交付时标记 `待用户验收`。
- 如果目标项目有 `check-ui-reuse.mjs`，正式 UI 变更后必须运行或说明环境阻塞。
