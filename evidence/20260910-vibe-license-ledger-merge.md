# Vibe 许可证台账合并证据（G1）

日期：2026-09-10
目标：G1（P0-A：Vibe 逐项许可证归类与缺口补齐）
任务包：tasks/20260910-vibe-license-ledger-merge.md（accepted）
审计人：主 Agent

## 结论

`provenance/LICENSE-MAP.json` 已合并逐技能许可证台账（新增 `vibePerSkill` 字段），
ui-styling 6 个字体许可证缺口已补齐（上游 OFL 文本 + 来源 revision），
ui-system-guardian 已补来源声明。catalog 状态未改变，runtime projection 未含 Vibe 技能。

## 完成的变更

| 变更 | 内容 |
|---|---|
| `legal/fonts/IBMPlexSerif-OFL.txt` | 上游 `github.com/IBM/plex` `packages/plex-serif/LICENSE.txt`（master）原文，OFL-1.1，Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"；来源 commit `c5f949677f6f163e8dfe98ca2c326bd48b42fa1b`（2024-06-12） |
| `legal/fonts/InstrumentSerif-OFL.txt` | 上游 `github.com/google/fonts` `ofl/instrumentserif/OFL.txt`（main）原文，OFL-1.1，Copyright 2022 The Instrument Serif Project Authors；来源 commit `5e0122a40050ed2cc20e9d5c387d19dd13c6c69f`（2023-03-22） |
| `legal/fonts/NOTICE.md` | 字体缺口映射说明（上游来源 + revision + SHA-256 + 与快照内既有 OFL 的一致性） |
| `legal/ui-system-guardian/SOURCE-DECLARATION.md` | ui-system-guardian 来源声明：vibe 自研产品/checker 技能，非 bundled 第三方；上游分发包 sourceCommit `635c54f9abb091c1293de346407663ad6af0862b` |
| `provenance/LICENSE-MAP.json` | 新增 `vibePerSkill` 台账：8 个许可证族覆盖 46 个 Vibe 技能；`fontGapResolved.ui-styling` 记录字体映射；`entries` 聚合结构不变 |

## 许可证族划分（46 项，无重复无遗漏）

| 族 | 许可证 | 技能数 |
|---|---|---|
| ui-ux-pro-max-bundled | MIT（nextlevelbuilder/ui-ux-pro-max-skill v2.5.0） | 4（ui-ux-pro-max、design-system、ui-styling、brand） |
| impeccable-bundled | Apache-2.0（pbakaus/impeccable v2.1.7） | 12 UI 技能 |
| impeccable-bundled-product-checker-overlap | Apache-2.0（同 impeccable 声明） | 4（audit、critique、harden、optimize） |
| impeccable-bundled-unreviewed-overlap | Apache-2.0（同 impeccable 声明） | 2（clarify、shape） |
| vibe-original-product-checker | vibe 分发包（private） | 18 |
| vibe-original-checker | vibe 分发包（private） | 1（vibe-code-review） |
| vibe-original-unreviewed | vibe 分发包（private） | 1（beginner-flow-guide） |
| vibe-event-only | vibe 分发包（private） | 3（evolution-engine、experience-elevator、feedback-writer） |
| vibe-compatibility-alias | vibe 分发包（private） | 1（vibe-coding-skills） |

## 复验命令与结果

```powershell
# 1) 台账完整性（46 覆盖、无重复、无多余）
python -c "import json; m=json.load(open('provenance/LICENSE-MAP.json',encoding='utf-8')); ..."

# 2) NOTICE 门禁正例
pwsh -NoProfile -Command "& './scripts/validate-release-notices.ps1' -RepositoryRoot 'F:\skiils工具\feisheng-vibe-coding'"
# => exitCode 0, status PASS（5 个 runtime 项全部映射）

# 3) NOTICE 门禁负例（Vibe runtimeEligible=true）
pwsh -NoProfile -Command "& './scripts/validate-release-notices.ps1' -RepositoryRoot '...' -LicenseMapOverride <翻转副本>"
# => 抛错拒绝：'LICENSE-MAP 的 Vibe 条目必须保持 runtimeEligible=false'
```

## 边界确认

- 三个源项目未修改；`sources/vibe-coding-skills/` 快照未修改（550/550 SHA 闭包保持）。
- 许可证文本来自上游官方仓库 raw 文件，非手工抄录；来源 commit 已记录（provenance 齐备）。
- 未把混合第三方许可证并入统一根许可证；Vibe 保持 `runtimeEligible=false`。
- 未更新 CANONICAL-CATALOG.json 中任何 Vibe 状态；runtime projection 不含 Vibe 技能。

## 未验证项（后续目标）

- 独立 Luna 交叉审查（宿主 503 后恢复与否需重派）——adapter-candidate 提升仍受阻。
- 真实宿主发现/触发 smoke；fresh-session 验证 UNVERIFIED。
