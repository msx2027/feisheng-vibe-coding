# 统一唯一称呼改名：feisheng-vibe-coding → vibe-coding-skills（2026-09-30）

## 决策

owner 2026-09-30 指令：项目统一为唯一称呼 `vibe-coding-skills`——GitHub 仓库、本地文件夹、宿主技能名、文档叙事全部同名；不再有「本仓库 vs 上游包」的双重身份叙事（受管块上的 `vibe-coding-skills:target-runtime` 门牌从「上游署名」变为「自我署名」，正是本次动机）。历史记录（evidence/tasks/docs-archive/legal/provenance 旧条目）按 owner 裁决保持原样，只追加不涂改。

## 改动清单（实测落地）

**代码/守卫硬编码（漏改=守卫静默失效）**：`guard-worktree-path.mjs`（白名单根 `F:\skiils\vibe-coding-skills-worktrees`）及测试、`install-vibe-hooks.ps1`（含自装拒绝哨兵）、`collect-host-skill-evidence.ps1`×3、`verify.ps1`×2（宿主证据前缀 + 文档对账锚点）、`build-release-package.ps1`、`install-runtime-projection.ps1`、`runtime-projection-guard.ps1`、`audit-host-legacy-links.ps1`、`init-doc-governance.mjs`、`release-gate.yml`、本机 `.claude/settings.json` hook 路径。

**身份/叙事**：根 `SKILL.md`（name 字段 = 宿主调用名 → `vibe-coding-skills`、标题）、`README.md`（badge/入口句/目录树/英文段）、35 个技能门控短语（`调用 \`vibe-coding-skills\` 总入口`）、`docs/HANDOFF-NEXT.md`、`skills/README.md`、doc-sync-guardian 两文件、`architecture.mjs`+4 张 SVG 重生成、`flow-and-lifecycle.html`、`packaging/runtime-projection.json`、collector 测试夹具×6。

**「上游」→「源项目」**：活文档全改（HANDOFF-NEXT×6 处、CAPABILITY-INDEX 经重生成、skills/README、doc-sync、生成器注释与报错文案、`SKILL-CLASSIFICATION.json` 9 处后重生成 catalog/index）。provenance 旧记录与 import 脚本按历史保持原样。

**状态目录 `.feisheng/` → `.vibe-coding-skills/`（owner 拍板一并改）**：contract.json 路径×6 + `contractVersion` v7.1→**v8**（lineage 续写）；`experience-recorder.mjs`、`invoke-vibe-hook-adapter.ps1`、`install-vibe-hooks.ps1`、`test-vibe-hook-adapter.ps1`、hotspot-gate、RUNTIME-NOTES。

**线协议常量保留（裁定）**：`eventNamespace: feisheng.vibe`（幂等键材料，改动使存量 `.digested` 标记全部失配）、`feisheng-vibe-hook-adapter/v2`、`feisheng-vibe-hook-install/v1`、`feisheng-local-patches/v1`、`feisheng-runtime-projection/v1` 等数据格式标识——它们是不可见的数据格式常量，非身份叙事。

## 台账手术（LOCAL-PATCHES）

35 个已登记门控短语文件 sha256 重录 + 追加说明；改名后 **23 个 vibe 源文件与快照重新字节一致**（门控短语本来就是快照原文，2026-09-18 批改名造成偏离、本次改回消除偏离），按「无偏离不登记」剪除悬空登记；`document-surfaces.md` 因「上游真源→真源」改写新入登记（快照原文在 `sources/vibe-coding-skills/skills/doc-sync-guardian/references/`）。校验链全绿。

## 过程事故与修复（如实登记）

1. **`sed -i` 行尾篡改**：Git Bash `sed -i` 对 CRLF 技能文件整文件按 LF 重写（13 个文件，含 10 个不含改名串的 engineering 技能）——正是根 AGENTS.md 保真树行尾规则禁止的事故。抢救：Node 字节级重做（HEAD 原字节 + 仅目标串替换）逐文件恢复，最终全仓 diff 形状均为小改。**教训：保真树上的替换一律字节级工具，禁用 `sed -i`。**
2. **台账登记过损伤 sha**：第一轮基于损伤字节登记，第二轮基于 git diff 名单漏掉已恢复文件；第三轮改为「对台账全部 skills 条目验证『HEAD+替换 == 当前字节』后按当前字节登记」，拒绝无法自证的条目（doc-sync 因专属短语规则单独补验）。
3. **安装器两个既有 bug（改名迁移暴露，非改名引入）**：① `@() | Where-Object` 过滤结果单项时退化为标量，`+=`/`+` 抛 op_Addition（fs-agent 2026-09-25 加单条工区守卫组后触发）——三处包 `@()` 修复；② 注册去重标记只认新 runner 绝对路径，v8 改名前的旧注册不被清理成重复 hook——`Test-RunnerMarkedGroup` 增加旧路径兼容标记，`-Uninstall`/`-Force` 即可完成存量升级。

## 存量目标迁移（实测）

- `E:\fs-agent`：`.feisheng/` 整目录改名（台账/凭据/消化标记全保留）→ `.gitignore` 更新 → `-Uninstall`+`install -HostAdapter all -Force` → 三宿主注册零旧引用、hook 套件实测 PASS。
- `F:\skiils\sess-find`：同法，三宿主零旧引用。
- 迁移语义已写入 contract v8 说明：`重跑 install-vibe-hooks.ps1 -Force` 即完成存量升级。

## 验证

- `verify.ps1` **21/21**（含 catalog 82 records 重生成、能力索引重生成、文档数字 66/82/52/452/454 与步数 21 对账门）。
- hook 适配器安全契约套件 PASS；ledger-core / anchor / closure 三套件全绿；doc-governance 18/18；guard-worktree 9/9。
- 本机宿主注册实测：fs-agent、sess-find 三宿主（claude/zcode/codex）注册命令全部指向 `.vibe-coding-skills\vibe-hooks\`。

## 待办（owner 侧收尾清单）

1. GitHub 改名（`gh repo rename`，本次由 AI 执行）与本地 remote 更新——见同日提交。
2. **本地文件夹改名**：`F:\skiils\feisheng-vibe-coding` → `F:\skiils\vibe-coding-skills`（owner 亲自执行；改名前本仓库 hook 路径短暂失联，属预期窗口）。
3. 改名后重建 4 条软链：`~/.agents/skills/`、`~/.claude/skills/`、`~/.codex/skills/`（经 `_adapters/shared/skills/` 中转）——旧名软链在文件夹改名后即失效。
4. ZCode 记忆库目录迁移（按新项目路径键）。
5. 改名后跑一次 `collect-host-skill-evidence.ps1` 重采宿主证据（新前缀 `vibe-coding-skills/skills/...`；`verify.ps1 -IncludeHostEvidence` 未跑前宿主结论保持 UNVERIFIED）。
