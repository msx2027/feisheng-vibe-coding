---
name: design-system
description: 仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `design-system`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发。Token architecture, component specifications, CSS variables, and design-to-code handoff for front-end pages. Use for design tokens, semantic color systems, spacing and typography scales, component states, and Tailwind integration.
argument-hint: "[component or token]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
user-invocable: false
disable-model-invocation: true
---
[Vibe Coding Adapter]
    本 Skill 可被显式点名，但仍必须先继承本包主控纪律，不得绕过 `AGENTS.md` / `CLAUDE.md`。
    - 先判定 `execution tier`；涉及 Skill / Hook / Tool / Agent、发布、权限、安全、数据、文件系统、shell、network 或外部 MCP 时，按 T3+ hazard mode 执行。
    - 目标项目生命周期文档先读 `.vibe-docs.json`，再按角色映射读写四字中文 `.md`；legacy 英文文档只作为迁移输入。
    - 正式前端页面先识别 UI 包、design tokens、组件盘点、设计复审报告和设计系统复用门禁；页面层优先复用 UI / token / 组件。
    - 需要用户真实点击、操作或观察时，输出人工验收状态；只有用户明确确认后才能记录为 `用户已确认`。
    - 涉及 `.pen` 或 Pencil 时，必须使用 Pencil desktop 客户端和 desktop MCP server；不得 fallback 到 VS Code。
    - references 只按 [按需加载 references] 或本文件 Reference Navigation 命中场景读取，不默认全量读取。
    - 新增依赖前先检查标准库、平台自带能力和项目已安装依赖；确实不够时说明缺口，等待用户明确同意后才能安装。

# Design System

Design tokens, component specs, and systematic front-end handoff for page UI.

## When to Use

- Design token creation and cleanup
- Primitive -> semantic -> component token architecture
- Component states and variants
- CSS variable systems
- Spacing and typography scales
- Tailwind theme integration
- Design-to-code handoff for reusable UI parts

## Skip

- Slide or presentation generation
- Banner, poster, or campaign creative production

## Token Architecture

Only load `references/token-architecture.md` when the current task needs token architecture detail. Do not default-load every reference.

### Three-Layer Structure

```text
Primitive (raw values)
       -> Semantic (purpose aliases)
       -> Component (component-specific)
```

**Example:**
```css
/* Primitive */
--color-blue-600: #2563EB;

/* Semantic */
--color-primary: var(--color-blue-600);

/* Component */
--button-bg: var(--color-primary);
```

## Quick Start

**Generate tokens:**
```bash
node skills/design-system/scripts/generate-tokens.cjs --config assets/design-tokens.json -o assets/design-tokens.css
```

**Validate token usage in code:**
```bash
node skills/design-system/scripts/validate-tokens.cjs --dir src/
```

**Embed tokens into standalone HTML prototypes when needed:**
```bash
node skills/design-system/scripts/embed-tokens.cjs --minimal --style
```

## 按需加载 references

Do not load all references by default. Read only the file matching the active task.

| 场景 | 读取 |
|------|------|
| Token architecture | `references/token-architecture.md` |
| Primitive token definition | `references/primitive-tokens.md` |
| Semantic token mapping | `references/semantic-tokens.md` |
| Component-level token design | `references/component-tokens.md` |
| Component specs | `references/component-specs.md` |
| States and variants | `references/states-and-variants.md` |
| Tailwind integration | `references/tailwind-integration.md` |

## Component Spec Pattern

| Property | Default | Hover | Active | Disabled |
|----------|---------|-------|--------|----------|
| Background | primary | primary-dark | primary-darker | muted |
| Text | white | white | white | muted-fg |
| Border | none | none | none | muted-border |
| Shadow | sm | md | none | none |

## Scripts

| Script | Purpose |
|--------|---------|
| `skills/design-system/scripts/generate-tokens.cjs` | Generate CSS from JSON token config |
| `skills/design-system/scripts/validate-tokens.cjs` | Check for hardcoded values in code |
| `skills/design-system/scripts/embed-tokens.cjs` | Inline tokens for standalone HTML prototypes |

## Templates

| Template | Purpose |
|----------|---------|
| `templates/design-tokens-starter.json` | Starter JSON with the three-layer structure |

## Integration

**With brand:** extract primitives from brand colors and typography
**With ui-styling:** map semantic/component tokens into Tailwind or component styling

**Skill Dependencies:** brand, ui-styling
**Primary Agents:** ui-ux-designer, frontend-developer

## Best Practices

1. Never use raw hex values in components when a token should exist.
2. Keep semantic tokens usage-driven, not palette-driven.
3. Component tokens should express component intent, not duplicate primitives blindly.
4. Document each token's purpose and its allowed usage.
5. Validate code regularly so hardcoded styles do not creep back in.
