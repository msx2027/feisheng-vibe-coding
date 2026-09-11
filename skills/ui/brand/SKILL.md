---
name: brand
description: '仅当用户先明确调用 `feisheng-vibe-coding` 总入口并指定 `brand`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发；Brand voice, visual identity, messaging frameworks, UI token...'
argument-hint: "[update|review|create] [args]"
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

# Brand

Brand identity, voice, messaging, asset management, and consistency frameworks for product-facing design work.

## When to Use

- Brand voice definition and content tone guidance
- Visual identity standards and style guide development
- Messaging framework creation
- Brand consistency review and audit
- Asset organization, naming, and approval
- Color palette management and typography specs

## Quick Start

**Inject brand context into prompts (Windows PowerShell default):**
```powershell
node "<skills-root>/skills/brand/scripts/inject-brand-context.cjs"
node "<skills-root>/skills/brand/scripts/inject-brand-context.cjs" --json
```

**Validate an asset:**
```powershell
node "<skills-root>/skills/brand/scripts/validate-asset.cjs" "<asset-path>"
```

**Extract/compare colors:**
```powershell
node "<skills-root>/skills/brand/scripts/extract-colors.cjs" --palette
node "<skills-root>/skills/brand/scripts/extract-colors.cjs" "<image-path>"
```

## Brand Sync Workflow

```powershell
# 1. Edit docs/brand-guidelines.md (or use /brand update)
# 2. Sync to design tokens
node "<skills-root>/skills/brand/scripts/sync-brand-to-tokens.cjs"
# 3. Verify
node "<skills-root>/skills/brand/scripts/inject-brand-context.cjs" --json | Select-Object -First 20
```

Resolve `<skills-root>` using the package runtime rule before running these commands; do not assume the current working directory is the skills package. Keep all path arguments quoted so Windows paths containing spaces remain one argument. On POSIX, the same quoted `node` commands work unchanged; only the optional output-truncation command is shell-specific.

**Files synced:**
- `docs/brand-guidelines.md` → Source of truth
- `assets/design-tokens.json` → Token definitions
- `assets/design-tokens.css` → CSS variables

The token sync is transactional: it generates temporary JSON/CSS outputs first, validates them, then replaces both targets as one commit. Generator failure, unsafe paths, concurrent target changes, or a partial replacement must exit non-zero and preserve or restore both original files.

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `update` | Update brand identity and sync to all design systems | `references/update.md` |

## 按需加载 references

Do not load all references by default. Read only the file matching the active task.

| 场景 | 读取 |
|------|------|
| `/brand update` or full brand refresh | `references/update.md` |
| Voice and tone rules | `references/voice-framework.md` |
| Visual identity standards | `references/visual-identity.md` |
| Messaging framework | `references/messaging-framework.md` |
| Brand consistency review | `references/consistency-checklist.md` |
| New guideline document | `references/brand-guideline-template.md` |
| Asset naming and storage | `references/asset-organization.md` |
| Color palette management | `references/color-palette-management.md` |
| Typography standards | `references/typography-specifications.md` |
| Logo usage rules | `references/logo-usage-rules.md` |
| Approval workflow | `references/approval-checklist.md` |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/inject-brand-context.cjs` | Extract brand context for prompt injection |
| `scripts/sync-brand-to-tokens.cjs` | Transactionally sync brand-guidelines.md → design-tokens.json/css with path checks, CAS and rollback |
| `scripts/validate-asset.cjs` | Validate asset naming, size, format |
| `scripts/extract-colors.cjs` | Extract and compare colors against palette |

## Templates

| Template | Purpose |
|----------|---------|
| `templates/brand-guidelines-starter.md` | Complete starter template for new brands |

## Routing

1. Parse subcommand from `$ARGUMENTS` (first word)
2. Load corresponding `references/{subcommand}.md`
3. Execute with remaining arguments
