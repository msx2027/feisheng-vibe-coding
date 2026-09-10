# 字体许可证映射（ui-styling/canvas-fonts 缺口补齐）

审计日期：2026-09-10
审计人：主 Agent（G1 目标）
关联证据：`evidence/20260910-vibe-ui-audit-local.md`（UI 组本地审计，缺口记录）

## 背景

`provenance/CANONICAL-CATALOG.json` 中 `ui-styling` 为 `source-only-ui`，其
`sources/vibe-coding-skills/skills/ui-styling/canvas-fonts/` 下 54 个字体文件中，
6 个字体（2 个家族）没有对应 OFL 许可证文件：

- IBMPlexSerif-Bold.ttf / IBMPlexSerif-BoldItalic.ttf / IBMPlexSerif-Italic.ttf / IBMPlexSerif-Regular.ttf
- InstrumentSerif-Italic.ttf / InstrumentSerif-Regular.ttf

按仓库规则「许可证映射完整且 NOTICE 逐项复核后才能 adapter-candidate」，这 6 个
文件构成许可证缺口。本目录补齐上游 OFL 许可证文本与来源 revision，供
`provenance/LICENSE-MAP.json` 映射。

## 来源与许可证（来自上游官方仓库）

| 字体家族 | 上游来源 | 许可证 | 上游文件 | 来源 revision（commit） | 日期 |
|---|---|---|---|---|---|
| IBMPlexSerif | github.com/IBM/plex | SIL OFL 1.1 | `packages/plex-serif/LICENSE.txt`（master 分支） | `c5f949677f6f163e8dfe98ca2c326bd48b42fa1b` | 2024-06-12 |
| InstrumentSerif | github.com/google/fonts | SIL OFL 1.1 | `ofl/instrumentserif/OFL.txt`（main 分支） | `5e0122a40050ed2cc20e9d5c387d19dd13c6c69f` | 2023-03-22 |

## 本地副本（本目录，SHA-256）

| 文件 | SHA-256 | 说明 |
|---|---|---|
| IBMPlexSerif-OFL.txt | `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da` | 上游 `packages/plex-serif/LICENSE.txt` 原文（OFL-1.1，Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"） |
| InstrumentSerif-OFL.txt | `129ed7618959716959f2941fdd5b49e0ad6e6c1d78726761786a00253d865521` | 上游 `ofl/instrumentserif/OFL.txt` 原文（OFL-1.1，Copyright 2022 The Instrument Serif Project Authors） |

## 与快照内既有 OFL 的一致性

- InstrumentSerif 上游文本与快照内 `InstrumentSans-OFL.txt` 仅 Copyright 持有人行不同
  （Instrument Serif / Instrument Sans 为同一 Instrument 项目家族），OFL-1.1 正文一致。
- IBMPlexSerif 上游文本与快照内 `IBMPlexMono-OFL.txt` 为同一 IBM Plex 家族、同一
  OFL-1.1 正文，仅排版（空行、FAQ URL 写法）差异；Copyright 持有人一致
  （IBM Corp.，Reserved Font Name "Plex"）。

## 映射结论

1. 6 个缺许可证字体家族（IBMPlexSerif、InstrumentSerif）均为 SIL OFL 1.1，与
   ui-styling 目录内其余 27 个家族一致（OFL 家族）。
2. 许可证文本已补齐于本目录，来源 revision 已记录；可合并入
   `provenance/LICENSE-MAP.json` 的 ui-styling 条目（runtimeEligible 保持 false；
   本映射仅解除许可证缺口，不构成 adapter-candidate 提升）。
3. 快照 `sources/vibe-coding-skills/` 未做任何手工修改（550/550 SHA 闭包保持）。

## 未验证项

- 独立 Luna 交叉审查仍不可用；本映射为本地逻辑审查，需独立复核后再据此做
  adapter-candidate 决定。
