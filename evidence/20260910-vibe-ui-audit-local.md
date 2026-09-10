# Vibe UI/第三方 LICENSE 组本地审计证据（主 Agent 逻辑审查）

> **v5 独立审计更正（2026-09-10，主 Agent 追加）**
>
> 本文件标题与「范围与方法」把范围写成「17 个 UI 技能」，但 `provenance/CANONICAL-CATALOG.json`
> 中 `status=source-only-ui` 的实际记录是 **16 项**。差异项为 `ui-system-guardian`：其 catalog
> 实际状态是 `source-only-product-or-checker`（不是 `source-only-ui`），不应计入本 UI 组。
> 该更正经 `evidence/20260910-vibe-ui-audit-v5.md`（luna_vibe_ui_audit_v5）独立复核并由主 Agent
> 本地复算确认（16 项：ui-ux-pro-max、ui-styling、typeset、design-system、delight、colorize、brand、
> bolder、animate、adapt、quieter、polish、overdrive、layout、impeccable、distill）。
> 本文件其余结论（字体缺口、ui-system-guardian 来源缺口、frontmatter、无第二入口）不受影响。

审计日期：2026-09-10
任务包：tasks/20260910-vibe-ui-audit-v3.md、tasks/20260910-vibe-ui-audit-v4.md
审计人：主 Agent（本地只读逻辑审查）
状态：review-unavailable（独立 Luna 审计因宿主 503 中断，无回执；不得视为独立交叉审查通过）

## 范围与方法

- 目标：provenance/CANONICAL-CATALOG.json 中 source=vibe-coding-skills 且状态为 source-only-ui 的 17 个技能：ui-ux-pro-max、ui-styling、ui-system-guardian、impeccable、design-system、brand、adapt、animate、bolder、colorize、delight、distill、layout、overdrive、polish、quieter、typeset。
- 方法：盘点每个技能目录文件与 LICENSE/NOTICE/*.txt；读取 docs/legal/ 的 bundled 来源与许可证；对 ui-styling/canvas-fonts 做字体文件与 OFL 许可证文件一一映射；读取 scripts/requirements.txt、SKILL.md frontmatter（license 字段、依赖与写入边界）。
- 来源快照：sources/vibe-coding-skills/ 是非 git checkout，本轮验证快照文件存在性与 SHA（SHA 详见产品组证据，UI 组关键文件见下文）。

## docs/legal 与 bundled 上游

| 文件 | 内容 | 上游 |
|---|---|---|
| docs/legal/BUNDLED-DESIGN-SKILLS-SOURCES.md | 记录 ui-ux-pro-max 侧与 impeccable 侧 bundled 来源 | ui-ux-pro-max-skill（skill.json v2.5.0）、impeccable（package.json v2.1.7） |
| docs/legal/LICENSE-ui-ux-pro-max-bundled.txt | MIT License | Copyright (c) 2024 Next Level Builder |
| docs/legal/LICENSE-impeccable-bundled.txt | Apache License 2.0 | pbakaus/impeccable |
| docs/legal/NOTICE-impeccable-bundled.txt | Anthropic frontend-design NOTICE（Apache-2.0, Copyright 2025 Anthropic, PBC） | anthropics/skills frontend-design |

## 逐技能许可证映射

| 技能 | 目录内 LICENSE/NOTICE | docs/legal 覆盖 | 结论 |
|---|---|---|---|
| impeccable | LICENSE（Apache-2.0）+ NOTICE.md（Paul Bakaus + Anthropic frontend-design） | LICENSE-impeccable-bundled + NOTICE-impeccable-bundled 对齐 | 覆盖完整 |
| ui-styling | LICENSE.txt（Apache-2.0）+ canvas-fonts/*-OFL.txt ×27 | docs/legal 未单独列字体 | 见字体缺口：6 个字体无许可证文件 |
| ui-ux-pro-max | 无 | LICENSE-ui-ux-pro-max-bundled.txt（MIT, Next Level Builder）覆盖其 data/scripts/references 侧来源 | 覆盖（bundled 声明） |
| design-system | 无 | 由 LICENSE-ui-ux-pro-max-bundled.txt 的 bundled 技能清单覆盖（ui-ux-pro-max 侧） | 覆盖（bundled 声明） |
| brand | 无 | 由 LICENSE-ui-ux-pro-max-bundled.txt 的 bundled 技能清单覆盖（ui-ux-pro-max 侧） | 覆盖（bundled 声明） |
| ui-system-guardian | 无 | 无直接法律文件 | 需来源声明（目录内无 LICENSE/NOTICE；建议登记 adapter-candidate 前补充来源） |
| adapt、animate、bolder、colorize、delight、distill、layout、overdrive、polish、quieter、typeset | 无 | 单文件技能；由 LICENSE-impeccable-bundled.txt（impeccable 侧 bundled 清单）覆盖 | 覆盖（bundled 声明，单 SKILL.md） |

注：impeccable 侧 bundled 清单（BUNDLED-DESIGN-SKILLS-SOURCES.md）列出 adapt、animate、audit、bolder、clarify、colorize、critique、delight、distill、harden、layout、optimize、overdrive、polish、quieter、shape、typeset、impeccable；audit/clarify/critique/harden/optimize/shape 在 catalog 中归入产品/checker/unreviewed 分组，但许可证上同属 impeccable 侧 bundled 来源。

## ui-styling 字体许可证缺口（阻断项）

canvas-fonts/ 共 54 个字体文件（.ttf）、27 个 *-OFL.txt。逐家族映射结果：

- 有许可证：ArsenalSC、BigShoulders、Boldonse、BricolageGrotesque、CrimsonPro、DMMono、EricaOne、GeistMono、Gloock、IBMPlexMono、InstrumentSans、Italiana、JetBrainsMono、Jura、LibreBaskerville、Lora、NationalPark、NothingYouCouldDo、Outfit、PixelifySans、PoiretOne、RedHatMono、Silkscreen、SmoochSans、Tektur、WorkSans、YoungSerif（27 个家族）。

- 无许可证文件（6 个字体文件，2 个家族）：
  - IBMPlexSerif-Bold.ttf、IBMPlexSerif-BoldItalic.ttf、IBMPlexSerif-Italic.ttf、IBMPlexSerif-Regular.ttf
  - InstrumentSerif-Italic.ttf、InstrumentSerif-Regular.ttf

这 6 个文件很可能同为 OFL（IBM Plex Serif 与 Instrument Serif 均为 OFL 字体），但快照目录内没有对应许可证文本，docs/legal 也未单独列出。按仓库规则「许可证映射完整且 NOTICE 逐项复核后才能 adapter-candidate」，这 6 个文件构成真实许可证缺口，必须先补齐来源与许可证证据（如上游 OFL 文本、来源 revision、NOTICE 映射），否则 ui-styling 不得转 adapter-candidate。

## 依赖与写入边界

- ui-styling：依赖 Python 3.10+（标准库）、Node.js 18+、项目内锁定的 shadcn CLI（必须 pinned exact 版本并提交 lock file；脚本绝不调用 npx/.cmd shim）；安装命令仅在用户明确同意后执行。写入目标：目标项目 UI 组件/tokens/tailwind 配置/字体资产。
- ui-ux-pro-max：scripts/data 为本地 CSV/脚本（core.py、design_system.py、search.py、_sync_all.py）；无网络安装；写入目标为目标项目设计系统/组件建议。
- impeccable：scripts/cleanup-deprecated.mjs 为包内维护脚本；不安装依赖。
- 其余单文件 UI 技能：无脚本、无外部依赖声明。
- 所有 UI 技能 frontmatter 均 user-invocable: false、disable-model-invocation: true，只能由总入口路由触发；未发现任何 UI 技能声明拥有仓库级 route/truth/runtime/Hook 权限。

## 分组结论（建议，未改写 catalog）

1. 可登记 adapter-candidate 候选（许可证映射相对完整、写入边界明确）：impeccable、ui-ux-pro-max、design-system、brand、adapt、animate、bolder、colorize、delight、distill、layout、overdrive、polish、quieter、typeset。
2. 保持 source-only-ui（许可证缺口）：ui-styling——必须先补齐 IBMPlexSerif/InstrumentSerif 的 OFL 许可证与来源证据。
3. ui-system-guardian：目录内无 LICENSE/NOTICE、docs/legal 未直接覆盖；建议保持 source-only，并补充来源/许可证声明后再转候选。

## 未验证项 / 阻塞项

- 独立 Luna 交叉审查不可用（宿主 503 × 2 轮），本证据只能记为逻辑审查 / review-unavailable，不得作为独立审计 PASS。
- 未验证 ui-styling 6 个无许可证字体的上游确切许可证文本（未联网核对 Google Fonts / 上游仓库）；需要来源 revision + 许可证文本证据。
- 未验证 ui-ux-pro-max 的 data CSV（google-fonts.csv 等）是否含第三方数据许可证要求；仅记录 bundled MIT 声明。
- 未验证真实宿主发现/触发行为；未做 fresh-session smoke。
- 未改写 CANONICAL-CATALOG.json、LICENSE-MAP.json、OWNER-LEDGER.json。

## 下一步建议

1. 补 ui-styling 6 个字体（IBMPlexSerif、InstrumentSerif）的 OFL 许可证文本与来源 revision，映射到 docs/legal 或技能目录，再复评。
2. 为 ui-system-guardian 补充来源与许可证声明。
3. 宿主恢复后重派独立 Luna 交叉审查（新任务标识），再合并产品组证据，更新 LICENSE-MAP.json 并决定 adapter-candidate 登记。
4. 对建议候选组做宿主 adapter 行为 smoke 前，保持 source-only，不写入 runtime projection。
