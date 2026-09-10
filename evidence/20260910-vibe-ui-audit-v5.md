# Vibe UI/许可证组 独立交叉审计证据（Luna 独立审计员 v5）

审计人标识：luna_vibe_ui_audit_v5（新标识，独立于任何 v3/v4 回执）
审计日期：2026-09-10
基线 commit：`7a76866`（`git log -1 --oneline` → `7a76866 docs: add continuation handoff`）
审计方式：本审计员独立执行命令逐项复核；未采信主 Agent 结论，仅以其产出为比对对象。
约束：全程只读，未修改任何文件（除本证据文件本身）；未安装依赖；未写入 sources/ 快照。

---

## 1. 仓库基线

```
$ git -C 'F:\skiils工具\feisheng-vibe-coding' log -1 --oneline
7a76866 docs: add continuation handoff
```

工作区状态（只读观测）：`legal/`、`docs/HANDOFF.md` 等未跟踪；`packaging/runtime-projection.json`、`provenance/LICENSE-MAP.json` 有未提交修改。仅作状态记录，不影响本审计。

## 2. 目录抽取（source=vibe-coding-skills ∧ status=source-only-ui）

执行 Python 解析 `provenance/CANONICAL-CATALOG.json`：

- **实际抽取到 16 项**，不是任务描述中的 17 项。
- 差异来源：主 Agent 本地证据（`20260910-vibe-ui-audit-local.md`）的 17 项清单包含
  `ui-system-guardian`，但 catalog 中 `ui-system-guardian` 的实际状态是
  `source-only-product-or-checker`（**非** `source-only-ui`）。
- 严格按「source=vibe-coding-skills ∧ status=source-only-ui」过滤，结果为 16 项（见 §3 表）。

## 3. 17/16 项 SKILL.md SHA-256 比对表

对 catalog 中全部 16 个 source-only-ui 记录逐个计算 `SKILL.md` SHA-256 并与 `sourceSha256` 比对：

| id | catalog path | catalog sourceSha256 | 本地计算 SHA-256 | 比对 |
|---|---|---|---|---|
| adapt | sources/vibe-coding-skills/skills/adapt/SKILL.md | 82c247cb56f5848fd925a16bc8ea381e5ba863836aadae48f312b79df63134a3 | 82c247cb56f5848fd925a16bc8ea381e5ba863836aadae48f312b79df63134a3 | ✅ 一致 |
| animate | sources/vibe-coding-skills/skills/animate/SKILL.md | a5ad08839100f08ee9ef834d0fb94e118abd08b50ec97c965c53db6616a1000b | a5ad08839100f08ee9ef834d0fb94e118abd08b50ec97c965c53db6616a1000b | ✅ 一致 |
| bolder | sources/vibe-coding-skills/skills/bolder/SKILL.md | 12881916d4a53ffe96c4de76d9a1e2288f169d2fe5026ca7d75003dfaa44ce4e | 12881916d4a53ffe96c4de76d9a1e2288f169d2fe5026ca7d75003dfaa44ce4e | ✅ 一致 |
| brand | sources/vibe-coding-skills/skills/brand/SKILL.md | 5edf51ecedf9d526a945d48048baa1c0a07ebe236ed7a86363c7f013cb197561 | 5edf51ecedf9d526a945d48048baa1c0a07ebe236ed7a86363c7f013cb197561 | ✅ 一致 |
| colorize | sources/vibe-coding-skills/skills/colorize/SKILL.md | 187d6e6edf24cda182b7d791af0208aa932d2962727615de9fbe2129c4461812 | 187d6e6edf24cda182b7d791af0208aa932d2962727615de9fbe2129c4461812 | ✅ 一致 |
| delight | sources/vibe-coding-skills/skills/delight/SKILL.md | dfed53ef2904c01dc63b49158986e1af2efd763d659d7b711985fff9920bd54b | dfed53ef2904c01dc63b49158986e1af2efd763d659d7b711985fff9920bd54b | ✅ 一致 |
| design-system | sources/vibe-coding-skills/skills/design-system/SKILL.md | 282babfcb4cee93c49016bb7f1e5225f7e997848c9b387af554af1c7e2a1ca0a | 282babfcb4cee93c49016bb7f1e5225f7e997848c9b387af554af1c7e2a1ca0a | ✅ 一致 |
| distill | sources/vibe-coding-skills/skills/distill/SKILL.md | c74c55bd1e048d5ac5048b404f88acdbad211d753124f0e0f4e8ee7e5b2dbdfb | c74c55bd1e048d5ac5048b404f88acdbad211d753124f0e0f4e8ee7e5b2dbdfb | ✅ 一致 |
| impeccable | sources/vibe-coding-skills/skills/impeccable/SKILL.md | 1e0fd9983d37c09717d5385587d0c185e301a5be61657f373dd1aa7715bd7198 | 1e0fd9983d37c09717d5385587d0c185e301a5be61657f373dd1aa7715bd7198 | ✅ 一致 |
| layout | sources/vibe-coding-skills/skills/layout/SKILL.md | 00b65ae42c08e9935d8f9aeb1c92fc5f5b659935a4f925c050401319f76a616d | 00b65ae42c08e9935d8f9aeb1c92fc5f5b659935a4f925c050401319f76a616d | ✅ 一致 |
| overdrive | sources/vibe-coding-skills/skills/overdrive/SKILL.md | 384a7e063939f398d70ae9626033200c9f1eca866db9717a95cb37cc8576e537 | 384a7e063939f398d70ae9626033200c9f1eca866db9717a95cb37cc8576e537 | ✅ 一致 |
| polish | sources/vibe-coding-skills/skills/polish/SKILL.md | 920ea94ad76ccb813708d27e9818c30c45ea1905dc5dc5966eb8d1f42faaeb9c | 920ea94ad76ccb813708d27e9818c30c45ea1905dc5dc5966eb8d1f42faaeb9c | ✅ 一致 |
| quieter | sources/vibe-coding-skills/skills/quieter/SKILL.md | 12b3c296d5c2961f37891a88307712c9a4a5c03740563b728023c499c31739d1 | 12b3c296d5c2961f37891a88307712c9a4a5c03740563b728023c499c31739d1 | ✅ 一致 |
| typeset | sources/vibe-coding-skills/skills/typeset/SKILL.md | 38d08ba0d1aee8c7b98790f45e736678bae72b9a903a01b0815ed30ef7d9698a | 38d08ba0d1aee8c7b98790f45e736678bae72b9a903a01b0815ed30ef7d9698a | ✅ 一致 |
| ui-styling | sources/vibe-coding-skills/skills/ui-styling/SKILL.md | 5d41668df70b3b00656b06baed8a08539b67d4dbb3ede21a71d711f0f22cf007 | 5d41668df70b3b00656b06baed8a08539b67d4dbb3ede21a71d711f0f22cf007 | ✅ 一致 |
| ui-ux-pro-max | sources/vibe-coding-skills/skills/ui-ux-pro-max/SKILL.md | 7122d04d0558a20240832de1c89af83665c3f3663c133baa975d68b43c95fd7a | 7122d04d0558a20240832de1c89af83665c3f3663c133baa975d68b43c95fd7a | ✅ 一致 |

**结果：16/16 全部一致，无不一致项。** catalog 中不存在第二个 `source-only-ui` 记录。

### ui-system-guardian 的独立核实（本地证据把它计入 17 项）

| 字段 | catalog 值 |
|---|---|
| id | ui-system-guardian |
| source | vibe-coding-skills |
| status | **source-only-product-or-checker**（不是 source-only-ui） |
| sourceSha256 | 0cc78518d7fab13b94bceec8a0e625aa836c296e1c266d41ce8e7f6b0e970375 |

## 4. 字体缺口修复核对

### 4.1 快照内 6 个字体仍无同目录 OFL（事实确认）

`sources/vibe-coding-skills/skills/ui-styling/canvas-fonts/`：
- 54 个 `.ttf`、27 个 `*-OFL.txt`。
- `IBMPlexSerif-*.ttf` ×4（Bold/BoldItalic/Italic/Regular）→ 目录内**无** `IBMPlexSerif-OFL.txt`（仅有 `IBMPlexMono-OFL.txt`）。
- `InstrumentSerif-*.ttf` ×2（Italic/Regular）→ 目录内**无** `InstrumentSerif-OFL.txt`（仅有 `InstrumentSans-OFL.txt`）。
- **结论：快照内缺口依然存在（6 个字体文件、2 个家族无同目录许可证文件），未把 OFL 文本写回 sources/ 快照（符合快照只读规则）。**

### 4.2 legal/fonts/ 补齐文件（存在 + 有效 OFL-1.1 + SHA-256）

| 文件 | 存在 | SHA-256（本审计独立计算） | OFL-1.1 有效性 |
|---|---|---|---|
| legal/fonts/IBMPlexSerif-OFL.txt | ✅ | `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da` | ✅ 有效 |
| legal/fonts/InstrumentSerif-OFL.txt | ✅ | `129ed7618959716959f2941fdd5b49e0ad6e6c1d78726761786a00253d865521` | ✅ 有效 |
| legal/fonts/NOTICE.md | ✅ | `36e632ba2435498f012eb6fb742b8f910dd4d4944f8b2bd6b78e44717c759f70` | —（NOTICE 映射文档） |

**OFL-1.1 有效性独立核对**：两个文件头部均含 `SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007`，正文含标准章节
PREAMBLE / DEFINITIONS / PERMISSION & CONDITIONS / TERMINATION / DISCLAIMER，并以标准结尾
「...FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.」收尾（各 93 行），
为完整 OFL-1.1 标准文本。IBMPlexSerif 头部声明「Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"」；
InstrumentSerif 头部声明「Copyright 2022 The Instrument Serif Project Authors」。

NOTICE.md 记录的来源 revision：IBMPlexSerif 上游 `IBM/plex` `c5f949677f6f163e8dfe98ca2c326bd48b42fa1b`；
InstrumentSerif 上游 `google/fonts` `5e0122a40050ed2cc20e9d5c387d19dd13c6c69f`（本审计未联网复核，见未验证项）。

## 5. ui-system-guardian 来源声明核对

`legal/ui-system-guardian/SOURCE-DECLARATION.md`：**存在** ✅，内容含：

- 状态声明：source-only，仅解除来源缺口，不构成 adapter-candidate 提升。
- 上游发布：`F:\skiils工具\vibe-coding-skills`，引用 `MANIFEST.json`：
  `name: "vibe coding skills"`、`sourceCommit: 635c54f9abb091c1293de346407663ad6af0862b`、`sourceBranch: master`。
- 判定为 vibe 自研（product/checker），非第三方 bundled；license 记录为
  `vibe-distribution; see upstream package.json (private) + README license section`，`runtimeEligible: false`。

**本审计独立复核**：读取上游 `F:\skiils工具\vibe-coding-skills\MANIFEST.json`，确认
`name: "vibe coding skills"`、`sourceCommit: "635c54f9abb091c1293de346407663ad6af0862b"`、`sourceBranch: "master"`，
与 SOURCE-DECLARATION 引用一致 ✅。声明文件明确写入所要求的 sourceCommit。

## 6. frontmatter 抽查与第二入口检查

对 **16/16** 个 source-only-ui 技能全部抽查（覆盖并超过要求的 6 个）SKILL.md frontmatter：

| 技能 | user-invocable | disable-model-invocation |
|---|---|---|
| adapt / animate / bolder / brand / colorize / delight / design-system / distill / impeccable / layout / overdrive / polish / quieter / typeset / ui-styling / ui-ux-pro-max | 全部 `false` | 全部 `true` |

第二入口检查：
- CANONICAL-CATALOG 全库 82 条记录无重复 id（`duplicateGroups` 中 UI 技能不在任何组内）。
- 不存在其他 source/status 记录使用这 16 个 id。
- `packaging/runtime-projection.json` 不含任何 UI 技能 id（独立解析确认）。
- **结论：未发现第二入口；UI 技能只能由总入口路由触发。** 与本地证据「所有 UI 技能 frontmatter 均 user-invocable: false、disable-model-invocation: true，只能由总入口路由触发」一致。

## 7. 独立结论

### 与本地证据 `20260910-vibe-ui-audit-local.md` 的一致性

| 项目 | 本地证据 | 本独立审计 | 是否一致 |
|---|---|---|---|
| source-only-ui 技能数 | 17（含 ui-system-guardian） | **16**（严格过滤，ui-system-guardian 实际为 source-only-product-or-checker） | ⚠️ **不一致（计数/范围差异）** |
| SKILL.md SHA 比对 | 未逐项列 16 项 SHA | 16/16 全部与 catalog 一致 | 可对比项一致 |
| 字体缺口 | 6 个字体（2 家族）无许可证 | 快照内 6 个字体仍无同目录 OFL；legal/fonts 已补齐有效 OFL-1.1 | ✅ 一致（缺口事实 + 已修补证据） |
| ui-system-guardian | 目录内无 LICENSE/NOTICE，需来源声明 | SOURCE-DECLARATION.md 已存在且 sourceCommit 与上游 MANIFEST 核对一致 | ✅ 一致（缺口已修补） |
| frontmatter | 均 user-invocable: false、disable-model-invocation: true | 16/16 抽查全部符合 | ✅ 一致 |
| 第二入口 | 未发现 | 无重复 id、runtime projection 无 UI id | ✅ 一致 |

### 关键差异说明

1. **17 vs 16**：本地证据把 `ui-system-guardian` 计入「source-only-ui 17 项」清单，但
   `provenance/CANONICAL-CATALOG.json` 中该技能状态为 `source-only-product-or-checker`。
   按任务定义的严格过滤条件（source=vibe-coding-skills ∧ status=source-only-ui），结果为 **16 项**。
   这是范围定义差异而非 catalog 漂移；ui-system-guardian 属 UI 组的判断成立（许可证/来源审查有据），
   但不应被计为 source-only-ui 状态记录。
2. 其余可对比结论与本地证据一致：16 个 SKILL.md 哈希全部匹配；字体缺口已通过 `legal/fonts/`
   补齐 OFL-1.1 文本；ui-system-guardian 来源声明已存在；无第二入口。

### 独立判定（本审计）

- 16 个 source-only-ui 技能文件哈希：全部通过。
- 字体许可证缺口（6 个 ttf 无同目录 OFL）：**缺口事实成立**，且已通过 `legal/fonts/` 补齐
  有效 OFL-1.1 文本（快照内未做修改，符合只读快照规则）。
- ui-system-guardian 来源声明：已补齐，sourceCommit 与上游一致。
- **本审计不声称通过真实宿主安装/fresh-session 验证；不引任何旧任务（v3/v4）回执。**

## 8. 未验证项

- 未联网核对 IBMPlexSerif/InstrumentSerif 上游 OFL 文本与 NOTICE.md 所记 revision
  （`c5f949677f6f163e8dfe98ca2c326bd48b42fa1b`、`5e0122a40050ed2cc20e9d5c387d19dd13c6c69f`）；
  仅验证了本地文本为完整 OFL-1.1 且头部与家族声明自洽。
- 未执行真实宿主发现/触发行为验证、无 fresh-session smoke；runtime 投影排除 UI 技能仅经静态解析确认。
- 未重算 sources/ 快照 550/550 SHA 闭包（NOTICE.md 声明，非本任务范围）。
- 未审查 ui-ux-pro-max 侧 data CSV 的第三方数据许可（本地证据同列未验证项，本审计未展开）。
- 未修改任何 catalog/LICENSE-MAP/OWNER-LEDGER/packaging/legal/sources 文件（全程只读）。

---

*审计结束。本证据由独立审计员 luna_vibe_ui_audit_v5 出具，直接回执主 Agent。*
