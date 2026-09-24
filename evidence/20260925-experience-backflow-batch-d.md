# 经验回流批 D：fs-agent 2026-09-23 后新教训八条（教材内容增补）

- 时间：2026-09-25
- 基线 revision：249f060（批 A/B/首次升格之后的干净树，verify 16/16 全绿）
- 触发：owner 要求对 fs-agent（E:\fs-agent @ cd5258a）做「工程配置与门禁策略吸收审计」；三只读子代理（fs-agent 门禁盘点 / 工厂现有门禁盘点 / 教训↔门禁配对）审计后，owner 对 A 档八条教训拍板「都执行」。
- 上游依据：全部为 2026-09-23 回流批**之后** fs-agent 新产生的实弹事故（commit 级证据见各条）。

## 变更物（8 条教训 → 5 个文件，全部为已有已验收技能的内容增补）

| # | 教训（一句话） | 上游证据 | 落点 |
|---|---|---|---|
| 1 | WebView2 浏览器级 CDP attach 会挂起，真壳验收走页面级 WS 直连 | fs-agent 057 批（b959326/5544345/b1a64c4） | browser-acceptance.md §6 |
| 2 | 取证用独立 `WEBVIEW2_USER_DATA_FOLDER`：默认数据目录被占时探针静默起不来 | 同上 | 同上 |
| 3 | 取证临时改动（壳 devUrl/调试口）必须还原并核对零 diff | 同上 | 同上 |
| 4 | 环境干扰读数化：并发会话压屏等环境问题写进验收读数，不伪装成功能缺陷 | fs-agent 顶栏拖拽批 | 同上 |
| 5 | 合并解冲突后、`git add` 前先跑可再生 metadata 再生工具（过期指纹绊倒下一笔无关提交） | fs-agent 6d95138 | multi-session-git.md §4 |
| 6 | 基线红障按归属处置（非本批失败留痕→快进→补证），不在红基线上宣称 GREEN | fs-agent 051（执行光标） | 同上 |
| 7 | 门禁按宿主分别登记（ZCode 不读 `.claude/settings.json`）+ hook 不热加载、装完实弹验证 | fs-agent 归位规范（2026-09-19 实弹） | multi-session-git.md 新增 §6 |
| 8 | 画布是视觉真源、方案文本不是（054 返工根因）；`.pen` 引用资产改名即空白不报错 | fs-agent 054（dafa250/c2e2820）、归位规范 §三 | pencil-pitfalls.md 新增 §6 |
| 附 | `--no-verify` 带因留痕 + 导航类门禁拦到并行线文件不代改 | fs-agent 多笔惯例（03661dc 等 6+ 笔） | multi-session-git.md §3 |
| 附 | finding 处置补第四种诚实出口「留证不修（指认既有拍板依据）」 | fs-agent 057 审计批（0dd7da1） | dev-builder SKILL.md finding 闭环 + phase-completion.md |
| 附 | 方案冻结是用户显式动作/冻结前不写实现码/修完不合并等复核/状态封顶「已验证待安全审查」禁「已完成」 | fs-agent 055 全稿作废（1cfd2e9）、宪法设计「代码动工拍板门禁」 | dev-builder SKILL.md [第一性原则] 新增「方案冻结与状态措辞」 |

文件清单与登记：

- 新文件直接加节（快照无对应物，不经补丁登记，catalog 再生覆盖哈希）：
  `skills/ui/polish/references/browser-acceptance.md`（+§6）、
  `skills/product/dev-builder/references/multi-session-git.md`（§3 +2 条、§4 +2 条、新增 §6）、
  `skills/product/design-maker/references/pencil-pitfalls.md`（+§6）。
- 登记过的补丁文件（LOCAL-PATCHES 同步更新，one-active-registration-per-path 遵守）：
  - `skills/product/dev-builder/SKILL.md`：登记 `vibe-dev-builder-multi-session-git-pointer`，
    patchedSha256 `eef17025…` → `44423df1…`，linesChanged 4 → 7（新增「方案冻结与状态措辞」1 行 + finding 闭环改写 1 行）。
  - `skills/product/dev-builder/references/phase-completion.md`：登记 `anti-bloat-plan-boundary-minimal`（files[] 该项），
    patchedSha256 `1016ae53…` → `7ea29b4e…`，linesChanged 1 → 2（Minor 处置清单改写）。

## 明确不做

- 不立新技能/新 reference 文件（catalog 对 accepted 技能要求冻结快照对应物，fail-closed；按 hotspot-governor/tools 与批 A 先例走既有文件增补）。
- 不改契约（adapters/vibe-hooks/contract.json v7 schema 不动——本批是技能内容，不涉 hook 契约）。
- 不碰 `sources/` 快照；不碰 fs-agent 仓库任何文件（活跃并行线）。
- 审计建议里「review-profiles.md 顺带补留证不修」：该文件在工厂仓不存在（为审计口径的统称），实际落点改为 phase-completion.md 的 finding 处置清单，随 `anti-bloat-plan-boundary-minimal` 登记更新。

## 新鲜验证

- `build-canonical-catalog.ps1` 再生：82 records（新增内容哈希进 bundle）。
- `build-capability-index.ps1` 再生：82 records。
- `verify.ps1` 默认档全绿（17/17，含本日新增的「提交关卡清单自检」步）——见 evidence/20260925-gate-hardening.md 的同一验证轮。

## 遗留

- 三份 reference 的新增节均为条款层知识，未配脚本化检查（与批 A 口径一致：手法类教训不机器化）。
- fs-agent 侧经验台账的对应 EXP 条目消化（dismiss/mark consumed）由 fs-agent 会话按其自身流程处理，本批不代做。
