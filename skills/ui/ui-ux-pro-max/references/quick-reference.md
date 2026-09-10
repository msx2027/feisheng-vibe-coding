# UI/UX Pro Max Quick Reference

> 读取时机：需要 UI/UX 规则分类、优先级、常见问题定位或专项复核时。

## 优先级

1. Accessibility：键盘、语义、焦点、对比度、动态文字和 reduced motion。
2. Touch & Interaction：44px / 48dp 触控目标、清晰 pressed / disabled / loading 状态。
3. Performance：避免 jank、布局跳动、字体阻塞、过重第三方脚本和无意义动画。
4. Style Selection：风格匹配产品类型，统一图标、阴影、圆角、主题和状态语言。
5. Layout & Responsive：mobile-first、无横向滚动、稳定断点、合理行长和 gutter。
6. Typography & Color：一致 type scale、语义色 token、暗色模式配套、可读 contrast。
7. Animation：150-300ms、可中断、表达状态变化、尊重 reduced motion。
8. Forms & Feedback：真实 label、就近 error、helper text、loading / empty / success 状态。
9. Navigation Patterns：层级清晰、返回行为一致、移动端底栏数量受控。
10. Charts & Data：图表有表格替代、空态 / loading、legend 就近、颜色不作唯一编码。

## 常见问题定位

| 现象 | 优先检查 |
| --- | --- |
| 看起来不专业 | style-match、spacing rhythm、type scale、icon consistency |
| 配色不稳 | semantic tokens、contrast、dark-mode pairing、color purpose |
| 字体不舒服 | font pairing、line-height、weight hierarchy、font loading |
| 布局小屏破 | mobile-first、breakpoint consistency、no horizontal scroll |
| 表单难用 | visible label、inline validation、error clarity、focus management |
| 动画廉价 | motion meaning、easing、interruptible、reduced motion |
| 图表难读 | legend visible、table alternative、empty state、non-color indicators |

## 不可妥协规则

- 不用 emoji 作为结构性图标；使用 Lucide、Heroicons、平台 vector icon 或项目现有图标库。
- 不在组件里散落 raw hex、任意圆角、任意阴影；优先映射到 design tokens。
- 不让 hover / pressed / loading 改变布局尺寸或造成 jitter。
- 不用 placeholder 代替 label。
- 不把暗色模式简单反色；暗色主题需要单独对比度和状态检查。
- 不把 UI polish 扩大成真实业务逻辑；没有业务真源时只做占位、disabled、noop 或静态状态。
- 不为“高级感”默认套单一紫蓝渐变、玻璃卡片或大面积深蓝；风格必须服务产品语境。

## 设计决策输出模板

```md
设计增强判断：本轮命中 <color / typography / tokens / UX / stack>。
查询：<命令或 domain / stack>
建议：
1. <决策> -> 落点：token / UI 包 / component variant / 页面组合
2. <决策> -> 落点：...
风险：
- <需要人工验收或实现前确认的点>
```
