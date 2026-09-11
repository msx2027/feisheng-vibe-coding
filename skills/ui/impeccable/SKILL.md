---
name: impeccable
description: '仅当用户先明确调用 `feisheng-vibe-coding` 总入口并指定 `impeccable`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；Create distinctive, production-grade frontend interfaces...'
version: 2.1.1
user-invocable: false
argument-hint: "[craft|teach|extract]"
license: Apache 2.0. Based on Anthropic's frontend-design skill. See NOTICE.md for attribution.
disable-model-invocation: true
---
[Vibe Coding Adapter]
    本 Skill 可被显式点名，但仍必须继承本包主控纪律，不得绕过 `AGENTS.md` / `CLAUDE.md`。
    - 先判定 `execution tier`；涉及 Skill / Hook / Tool / Agent、发布、权限、安全、数据、文件系统、shell、network 或外部 MCP 时，按 T3+ hazard mode 执行。
    - 目标项目生命周期文档先读 `.vibe-docs.json`，再按角色映射读写四字中文 `.md`；legacy 英文文档只作为迁移输入。
    - 正式前端页面先识别 UI 包、design tokens、组件盘点、设计复审报告和设计系统复用门禁；页面层优先复用 UI / token / 组件。
    - UI 精修、复刻、image-to-code、截图 / 设计稿还原或视觉 polish 时，若项目没有对应功能真源，只做呈现层和必要纯 UI 状态，不补业务逻辑；占位范围必须在交付中说明。
    - 需要用户真实点击、操作或观察时，输出人工验收状态；只有用户明确确认后才能记录为 `用户已确认`。
    - 涉及 `.pen` 或 Pencil 时，必须使用 Pencil desktop 客户端和 desktop MCP server；不得 fallback 到 VS Code。
    - `reference/` 是本 Skill 的历史资料目录；只按 Reference Navigation 命中读取，不默认全量读取。

This skill creates distinctive, production-grade frontend interfaces that avoid generic AI aesthetics. Implement real working code with strong aesthetic direction and refined details. For UI-only polish or replica tasks, "working" means visually and interactively coherent presentation with safe placeholders unless the user explicitly asks for real business behavior.

## Context Gathering Protocol

Design work requires confirmed context. Code can show what exists; it cannot reliably infer audience, use case, or brand feeling.

Required context:
- Target audience and usage context.
- Jobs/users are trying to get done.
- Brand personality, emotional tone, references, anti-references, theme preference, and accessibility constraints.

Gathering order:
1. If loaded instructions already contain `## Design Context`, proceed.
2. Else read `.vibe-docs.json`, resolve its `designBrief` role (new-project default: `docs/设计简报.md`), and proceed if that document has the required context.
3. Else run `/impeccable teach` before design work. Do not infer the missing context from codebase structure.

Fast-path: if the request is a named T0/T1 visual tweak with clear file/component/screenshot, low risk, and no missing design direction decision, prefer the UI micro-tweak fast lane instead of this Skill. If this Skill was explicitly invoked, use existing context and proceed.

## Design Direction

Commit to a clear point of view:
- Purpose: what problem the interface solves and who uses it.
- Tone: choose a specific aesthetic, not generic "modern/elegant".
- Constraints: framework, performance, accessibility, responsive behavior.
- Differentiation: the one visual or interaction idea someone remembers.

Distinctive does not always mean loud. Bold maximalism and refined minimalism both work when choices are intentional, cohesive, and specific to the brief.

## Hard Design Rules

Keep these in the working context by default. Use the reference files only for deeper methods, examples, and implementation details.

### Typography
- Use a modular type scale. Marketing/content headings may use `clamp`; app UIs and dashboards should prefer fixed `rem` scales for predictable density.
- Use fewer sizes with stronger contrast; avoid flat hierarchies.
- Cap body copy around 65-75ch; tune line-height to line length and theme.
- Pair a distinctive display face with a refined body face when the brief supports it.
- Pick fonts from brand/audience/context, not category reflexes. Avoid monoculture defaults such as Inter, Roboto, Arial, Open Sans, system stacks, and the usual decorative fallback set.
- Do not use monospace as lazy shorthand for "technical"; do not set long passages in uppercase.

### Color & Theme
- Use OKLCH or other perceptually uniform color methods when authoring palettes.
- Tint neutrals toward the actual brand hue; avoid pure black and pure white.
- Choose light/dark from audience and viewing context, not from a default habit.
- Use accents sparingly by visual weight.
- Do not use gray text on colored backgrounds, gradient text, cyan-on-dark/purple-blue AI palettes, or glowing dark-mode defaults unless the product context truly demands it.

### Layout & Space
- Use a 4pt spacing scale and semantic spacing tokens.
- Use `gap` for sibling spacing, varied rhythm for hierarchy, and asymmetry only when it supports the message.
- Use container queries for components and viewport queries for page layout.
- Do not wrap everything in cards, nest cards inside cards, repeat identical icon-card grids, center everything, or use the hero metric template by reflex.
- Keep body text line length readable and fixed-format UI elements dimensionally stable.

### Absolute Bans
- No side-stripe card/list/callout accents: `border-left` or `border-right` wider than 1px as a colored accent is forbidden. Use a different structure instead.
- No gradient text: `background-clip: text` combined with gradients is forbidden. Use weight, size, or solid color for emphasis.

### Motion
- Use motion to communicate state changes, entrances, exits, and feedback.
- Prefer transform/opacity and natural ease-out timing; respect `prefers-reduced-motion`.
- Do not animate layout properties, bounce/elastic by default, or scatter motion everywhere.

### Interaction, Responsive, UX Writing
- Make interactions feel fast and intentional; use optimistic UI where appropriate.
- Use progressive disclosure, helpful empty states, clear loading and error states, and visible focus.
- Adapt functionality for mobile; do not hide critical actions just to fit.
- Every word should earn its place; avoid labels and intro text that repeat what users already see.

## AI Slop Test

Before finishing, ask: if someone saw this and was told "AI made this", would they believe it immediately? If yes, add specificity: stronger concept, better hierarchy, less templated composition, more context-aware imagery, sharper interaction detail, or quieter restraint.

## Reference Navigation

Read only the files needed by the current task:

| Reference | Read When |
| --- | --- |
| `reference/typography.md` | Font selection, OpenType, scales, hierarchy, loading strategy. |
| `reference/color-and-contrast.md` | OKLCH palette construction, contrast, theme and accessibility detail. |
| `reference/spatial-design.md` | Grids, rhythm, container queries, optical layout corrections. |
| `reference/motion-design.md` | Timing, easing, reduced motion, performance. |
| `reference/interaction-design.md` | Forms, focus, loading, empty states, overlays, interaction polish. |
| `reference/responsive-design.md` | Mobile-first adaptation, fluid layout, container-query patterns. |
| `reference/ux-writing.md` | Labels, errors, empty states, concise microcopy. |
| `reference/craft.md` | `/impeccable craft ...` shape-then-build flow. |
| `reference/extract.md` | `/impeccable extract ...` reusable components and token extraction flow. |

## Modes

**Default / build mode**
- Confirm design context, choose a clear direction, implement working UI, and verify the result with the target project's normal checks.
- Match implementation complexity to the aesthetic vision; do not overbuild restrained designs or underbuild ambitious ones.

**Craft mode**
- If invoked as `/impeccable craft [feature description]`, read `reference/craft.md` and pass the remaining argument as the feature description.

**Teach mode**
- If invoked as `/impeccable teach`, skip design work and gather design context.
- Explore README/docs, package/config, components, brand assets, tokens, and style guides first.
- Ask only for missing audience/use case/brand/aesthetic/accessibility facts.
- Write or update the `.vibe-docs.json.designBrief` document with `## Design Context` (new-project default: `docs/设计简报.md`), then refresh its manifest metadata and document index. Do not create a second design-state file or append duplicate state to `CLAUDE.md`.

**Extract mode**
- If invoked as `/impeccable extract [target]`, read `reference/extract.md` and extract reusable components, design tokens, and patterns only when repeated use justifies consolidation.
