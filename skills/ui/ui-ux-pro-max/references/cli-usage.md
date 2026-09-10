# UI/UX Pro Max CLI Usage

> 读取时机：需要完整命令、domain / stack 列表、持久化设计系统或输出格式时。

## 基本原则

- 数据文件位于 `skills/ui-ux-pro-max/data/`，默认不全文读取。
- 查询入口是 `skills/ui-ux-pro-max/scripts/search.py`。
- 设计建议先用 `--design-system` 得到整体方向，再用 `--domain` 或 `--stack` 针对性补充。
- 只把命中的查询结果带回当前任务上下文。
- `--persist` 会把 project / page 规范化为 portable 单路径段 slug，并把所有输出限制在 `<output-dir>/design-system` 内；空值、逃逸路径或不可移植名称必须失败，不得回退到任意文件路径。

## 常用命令

```bash
python skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system -p "<Project Name>"
python skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "<Project Name>"
python skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "<Project Name>" --page "<page-name>"
python skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> -n 3
python skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack <stack> -n 3
python skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -f markdown
```

## 推荐流程

1. 分析用户需求：产品类型、受众、情绪关键词、视觉偏好、当前技术栈。
2. 运行 `--design-system`，得到 pattern、style、colors、typography、effects 和 anti-patterns。
3. 对不确定维度追加 domain 查询，例如 color、typography、ux、chart。
4. 对实现栈追加 stack 查询，例如 nextjs、shadcn、swiftui、flutter。
5. 如果要沉淀到项目文档，用 `--persist` 写入 `design-system/MASTER.md` 或页面 override。

## Domains

| Domain | 用途 | 示例 |
| --- | --- | --- |
| `product` | 产品类型模式 | `--domain product "entertainment social"` |
| `style` | UI 风格、效果、视觉语言 | `--domain style "glassmorphism dark"` |
| `color` | 产品 / 行业配色 | `--domain color "fintech trustworthy"` |
| `typography` | 字体组合与字体气质 | `--domain typography "playful modern"` |
| `google-fonts` | Google Fonts 候选 | `--domain google-fonts "sans serif variable"` |
| `ux` | UX guideline、交互、可访问性 | `--domain ux "animation accessibility"` |
| `landing` | landing structure、CTA、social proof | `--domain landing "hero pricing testimonial"` |
| `chart` | 图表类型与数据可视化 | `--domain chart "real-time dashboard"` |
| `react` | React / Next.js 性能与 UI 实践 | `--domain react "rerender memo list"` |
| `web` | Web / app interface guideline | `--domain web "touch target safe area"` |
| `prompt` | AI prompt / CSS visual keywords | `--domain prompt "minimalism"` |

## Stacks

可用 stack 包括：`react`、`nextjs`、`vue`、`svelte`、`astro`、`html-tailwind`、`shadcn`、`nuxtjs`、`nuxt-ui`、`react-native`、`flutter`、`swiftui`、`jetpack-compose`、`threejs`、`angular`、`laravel`。

## 示例

```bash
python skills/ui-ux-pro-max/scripts/search.py "AI search tool modern minimal" --design-system -p "AI Search"
python skills/ui-ux-pro-max/scripts/search.py "minimalism dark mode" --domain style
python skills/ui-ux-pro-max/scripts/search.py "search loading animation" --domain ux
python skills/ui-ux-pro-max/scripts/search.py "layout rendering navigation" --stack nextjs
```
