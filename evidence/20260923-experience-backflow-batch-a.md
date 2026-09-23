# 经验回流批 A：fs-agent 教训 → 技能 reference 增补（2026-09-23）

## 事件

owner 2026-09-23 会话指令：把 fs-agent 经验治理台账（`docs/项目治理/经验治理.md`，115 条 L0）对照本仓库 52 条 runtime 技能做覆盖审计，并落地回流（会话拍板「同意」）。本批为回流第一批（批次 A）：三个最大空白主题以「现有已验收技能新增 reference + SKILL.md 指针」形态落地。

## 覆盖审计结论（2026-09-23，三路并行探查）

- UI/设计/浏览器验收类 44 条：已覆盖 4、部分覆盖 33、未覆盖 7（浏览器/CDP 通道类另涉 6 条部分覆盖）。
- 工程/checker 类 45 条：已覆盖 1、部分覆盖 19、未覆盖 25（最大空白：多会话/共享工区 Git 纪律约 13 条；门禁操作纪律约 6 条）。
- product/event 类 21 条：已覆盖 1、部分覆盖 10、未覆盖 10（其中 fs-agent 专属交互拍板按 scope 设计应留目标项目台账，不回流）。
- 合计约 110 条去重后：明确覆盖 6 条，其余为部分覆盖或空白。结构性空白四大块：多会话 Git 纪律、浏览器/CDP 验收通道、Pencil 画布操作语义、门禁工具操作纪律。

## 落点裁决：为什么不是新技能

新独立技能必须在 `provenance/SKILL-CLASSIFICATION.json` 定编且通过 catalog 构建的 fail-closed 门禁（accepted 的 Vibe 记录必须声明与 `sources/vibe-coding-skills` 快照目录对应的 `sourceDir`）；快照为冻结真源，本地全新创作无对应物，当前治理下无立新技能通道。故按 `evidence/20260917-hotspot-governor-tool-sync.md` 先例（快照无对应物的新增文件属新增而非副本偏差，不经 LOCAL-PATCHES 登记，以本文件 + 提交说明为凭证），将知识落为现有已验收技能目录内的新增 reference 文件；SKILL.md 指针行按 `runtime-import` 命名空间登记本地补丁。dev-builder 既有登记 `retired-capability-reference-text-fix` 因「同一路径只允许一条活登记」移交其 dev-builder/SKILL.md 文件记录（其 change 字段已注明移交与累积 diff 口径）。

## 变更物

| 变更 | 说明 |
| --- | --- |
| `skills/product/design-maker/references/pencil-pitfalls.md` | 新增。Pencil 画布操作暗礁：节点 id 生命周期（EXP-021/024/109）、替换区先枚举（EXP-020）、母件化先盘点/先查母件默认值（EXP-026/100）、坐标系换算（EXP-083/084/102/113）、2x 核验与 CJK 光学校准（EXP-021/025）、幽灵缝排障（EXP-103）。 |
| `skills/product/design-maker/SKILL.md` | [技能] 清单末尾 +1 行指针。登记 `vibe-design-maker-pencil-pitfalls-pointer`。 |
| `skills/product/dev-builder/references/multi-session-git.md` | 新增。多会话共享仓库纪律：写前核归属（EXP-055/018）、逐文件 add / 路径限定提交 / 绝对 SHA（EXP-058/064/114）、show --stat 复核（EXP-104）、--staged 门禁联动（EXP-096/071）、merge-tree 预查（EXP-068）、绿证据落已提交树（EXP-107）、审计窗口冻结（EXP-060）。 |
| `skills/product/dev-builder/SKILL.md` | references 表 +1 行。登记 `vibe-dev-builder-multi-session-git-pointer`（承接该路径活登记）。 |
| `skills/ui/polish/references/browser-acceptance.md` | 新增。浏览器验收防骗：通道选择（EXP-017/101）、端口归属探测（EXP-050/066/099）、CDP 语义（EXP-075/095/062）、假阴假阳（EXP-067/004/036/041）、证据纪律（EXP-074/115）。 |
| `skills/ui/polish/SKILL.md` | Final Verification +1 条指针。登记 `vibe-polish-browser-acceptance-pointer`。 |
| `provenance/LOCAL-PATCHES.json` | +3 条 runtime-import 登记；`retired-capability-reference-text-fix` 移出 dev-builder/SKILL.md 文件记录并注明。 |
| `provenance/CANONICAL-CATALOG.json` / `docs/CAPABILITY-INDEX.md` | 再生（82 records；runtime files 439）。 |

## 新鲜验证

- `scripts/build-canonical-catalog.ps1`：82 records 再生成功（bundle files 431 → 439，+8 = 3 个新 reference + 其余为目录内既有文件的清单修正）。
- `scripts/verify.ps1`：**16/16 全绿**（导入副本一致性 318 files / 46 登记补丁；Matt 24 files / 3 补丁；补丁结构不变量 50）。
- 三条新指针均为「按需加载」命中场景式指针，不改变任何技能的触发条件、执行强度与写入范围。

## 遗留（批次 B，同日推进）

- fs-agent 115 条的主题（「疼的部位」）记账：`experience-recorder.mjs` 加 theme 字段与 classify 动作、`check` 输出主题热度，主题满 6 可打包提议升格。
- 升格工具实物化：`sources/vibe-coding-skills/tools/experience-governance.mjs` 工具族从未随发行包分发（fs-agent 台账人工登记区已注明「当前发行包未提供登记工具」），按 hotspot-governor/tools 先例编入 `skills/event/experience-elevator/tools/` 发行；含两处部署副本修正（theme 字段 + 台账围栏外内容保护，见批次 B 证据）。
- EXP-010（负向结论双通道交叉验证，count=3 已达 L0→L1 阈值）首次升格实弹。
