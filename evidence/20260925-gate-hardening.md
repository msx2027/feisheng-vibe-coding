# 门禁硬化批：密钥护栏两档分治 + 工厂自家提交关卡修复自装 + 工区守卫双宿主接线

- 时间：2026-09-25
- 基线 revision：249f060
- 触发：owner 2026-09-25 会话对三项门禁拍板「都执行」（密钥扫描 / 工厂自家检查 / 工区守卫）；审计来源同 evidence/20260925-experience-backflow-batch-d.md。
- 审计顺带发现（本批的直接动因之一）：工厂仓 `core.hooksPath` 指向磁盘改名后的失效路径 `F:\skiils工具\feisheng-vibe-coding\_smoke`，本地 pre-commit 长期空转，push 前无任何本地闸门。

## 变更物

### B2 密钥泄漏护栏：恒警告 → 两档分治

- `skills/product/hotspot-governor/tools/secret-scan.mjs`：
  - 新增 `BLOCKING_RULES` 集合（AWS key / GitHub token / Slack token / 私钥头）；gitleaks 官方引擎发现整体计高置信。
  - 高置信命中（提交期 `--staged`）→ exit 1 阻断且**不进基线**（防「再提交一次即放行」）；低置信（通用赋值型）→ 警告一次进基线（棘轮不变）。
  - fail-closed：git 列不出暂存区/全仓（null ≠ 空数组）或扫描器异常 → 阻断，取代原 `|| exit 0` 恒放行。
  - 保留工厂版较新的 AWS 正则（对齐官方 v8.30.1 的 `[A-Z2-7]`，2026-09-19 审计整改；fs-agent 本地版缺此修正，本版为两线合并最优）。
- `guardrail-addon.mjs`：目标项目钩子接线段去掉 `|| true`（原来会吞掉阻断退出码），改为显式 fail-closed 段（保留单 `fi` 结尾以兼容 stripSegment 卸载逻辑）；文案「警告级」→「两档」。
- `install-hotspot-gate.mjs`：头注安全边界同步（取代 9-18「恒警告级」决议，注明 owner 2026-09-25 拍板与 fs-agent 2026-09-21 起实弹零误伤的演化依据）。
- 设计依据：9-18 否决硬拦的顾虑是**误报**而非「不该拦」；fs-agent 分档实弹运行（2026-09-21 起）零误伤，证明分档取得阻断力且不重蹈误拦覆辙。降级保险仍在：连续误拦可从 `BLOCKING_RULES` 移除对应 id 降回警告档（单点收紧放宽）。

### B3 工厂自家提交关卡：修复 + 自装

- 修复：`git config core.hooksPath scripts/githooks`（相对路径随仓库走，换机/换盘不再失效；旧绝对路径已失效）。
- 新增 `scripts/githooks/pre-commit`：检查清单**单一真源**模式（fs-agent N-16 教训的防漂移设计——测试解析同一声明块，项数不靠手抄）。清单两项：
  1. 密钥泄漏护栏（复用 B2 升级版扫描器，`--staged`，fail-closed）；
  2. 提交关卡清单自检（`scripts/githooks/pre-commit.test.mjs`：断言清单非空、每条声明脚本存在、必需检查在列、无 `|| true`/`|| exit 0` 放行后缀、run_check 失败分支含 exit 1）。
- 新增 `scripts/githooks/pre-commit.test.mjs`（零依赖 node 脚本；pre-commit 第 2 项与 verify 步骤共用同一实现，无第二 owner）。
- `scripts/verify.ps1`：新增步骤 5d「提交关卡清单自检」（默认档 16 → **17 步**），头注覆盖清单同步。
- `README.md`：静态门禁步数计数修正 15 → 17（原数字自 1c-3 加入后即过期，本批顺带订正）；徽章同步。
- 新增 `tools/guardrails/secret-baseline.json`（空基线 `{"version":1,"entries":{}}`，随 550a208 落盘可审查；SKIP_PATH 已排除 tools/guardrails 防递归自扫描）与 `tools/guardrails/gitleaks.toml`（官方模板副本——本机日后装上 gitleaks 二进制时工厂自身提交扫描直接用官方规则集，不再缺配置降级 fallback）。
- 逃生门成文于钩子内：`--no-verify` 须在提交说明注明原因（回流批 D 同款条款，工厂自身开始践行）。

### B1 工区守卫：worktree 集中 + 盘根防乱建

- 新增 `scripts/guard-worktree-path.mjs`（移植 fs-agent `tools/guard-worktree-path.mjs` 实弹验证实现，路径与白名单按本仓改写）：
  - 规则一：本项目会话 `git worktree add/move` 目标仅允许 `F:\skiils\feisheng-vibe-coding-worktrees` 下；
  - 规则二：任意盘根一级创建/改动/删除仅放行 `skiils`（项目区）、`tmp`（会话临时区）；
  - 判定原则：识别出越界 exit 2（fail-closed）；stdin 解析失败/非 Bash/识别不了的写形态 exit 0（fail-open 不瘫痪会话）；
  - 环境变量 `FVC_WORKTREE_ROOT` / `FVC_DRIVE_ROOT_ALLOWLIST` 可覆盖（测试/异机）。
- 新增 `scripts/guard-worktree-path.test.mjs`：9 用例（分词/目标提取/白名单内外/MSYS 形态/相对+cd 拒绝/盘根动词/重定向/包裹器/读取放行）。
- 双宿主接线（本机，不入库，`.gitignore` 增补）：`.claude/settings.json`（Claude 宿主）+ `.zcode/config.json` 的 `hooks.events.PreToolUse`（ZCode 宿主，`enabled: true`）——两处均 matcher Bash → `node <repo>\scripts\guard-worktree-path.mjs`，timeout 10。实测教训（回流批 D 条款 7）：只登记一处宿主 = 对另一宿主完全不生效。
- 与既往否决项的关系：2026-09-19 anti-bloat 批（commit e22a37d）否决的是「提交期预算/路径允许集阻断」（误拦会致 hook 被整体禁用），2026-09-20 防漂移拍板确认「阶段粒度是正确旋钮、不加工作中途拦截」（会话拍板，无独立 commit 留档）。本守卫拦的是**命令目标**（worktree 越界/盘根乱建），非文件写入面，fs-agent 实弹无 TDD 误拦记录。owner 2026-09-25 知悉该张力后仍拍板执行，本批按拍板落地；若未来出现误拦，降级路径 = 缩白名单或下线宿主接线（脚本入库不受影响），并在登记台账补记。

## 实弹验证

- secret-scan（临时夹具仓 `/f/tmp/ss-smoke`，四场景全符合预期）：
  1. AWS key staged → `ERROR …阻断提交`，exit 1，基线存量 0（高置信不进基线）；
  2. 通用赋值型 staged → `WARNING …已吸收进基线`，exit 0，基线 +1；
  3. 重跑同内容 → 无新警告（已吸收），exit 0；
  4. 修复后重跑 → `修复剔除 1`，基线归零（棘轮只减不增）。
- guard-worktree-path：`node --test` 9/9 PASS；CLI stdin 冒烟——越界 worktree（E:/random/topic）exit 2 带可读诊断，白名单内 `mkdir F:/tmp/scratch` exit 0。
- 提交关卡清单自检：`node scripts/githooks/pre-commit.test.mjs .` exit 0（2 项声明全部可实现且 fail-closed）。
- 本笔提交本身即第一次实弹：pre-commit 两项检查对本次 staged 内容真实执行。
- `verify.ps1` 默认档 17/17 全绿（含新增 5d 步）。

## 重挂手册（换机必做）

1. `git config core.hooksPath scripts/githooks`
2. 重建两份宿主接线（`.gitignore` 有注释）：`.claude/settings.json` 与 `.zcode/config.json` 的 `hooks(.events).PreToolUse`，命令 `node "<仓库绝对路径>\scripts\guard-worktree-path.mjs"`，matcher `Bash`，timeout 10，ZCode 侧需 `"enabled": true`。
3. 实弹验证：对会话发一条必然越界的 `git worktree add E:/x`，应被拦（exit 2 + stderr 指明白名单）；提交任意内容应看到 `[pre-commit.test] 清单自检通过`。

## 明确不做

- 不改 vibe-hook 契约（contract v7 不动——本批全部是 pre-commit/宿主 PreToolUse 层，与 adapter 契约无涉）。
- 不给 fs-agent 刷安装态（活跃并行线，写入面未取证；且其本地 secret-scan 为「本地适配神圣」文件，安装器会跳过覆盖——是否手工对齐两线合并版留 owner 后决）。
- 不给 verify.ps1 加 `-Quick` 档/不入 pre-commit 跑全量 verify：本地关卡保持两秒级（清单两检查），全量验证仍由提交后 verify + CI 承担（与 2026-09-20「阶段粒度」拍板一致）。
- 不加 commitlint/CI secrets 扫描到工厂仓自身（Semgrep 工作流已定位为收工凭据兜底层；本地关卡+人工纪律当前充分，避免门禁膨胀）。

## 遗留

- hook 与宿主接线均不热加载：本批接线对**新会话**生效；已开会话需重启才受工区守卫保护。
- Codex 宿主无 pre-tool 事件不接线，靠「分支统一前缀 + `git worktree list --porcelain` 核查」兜底（fs-agent 同款口径）。
- `verify.ps1` 若未来增删步骤，README 两处计数与徽章需同步（本次已把过期口径一并修正为 17）。
- 恒警告时代（9-19 批 C 至本批前）基线里已吸收的**高置信**条目不会追溯阻断——两档的阻断只对 fresh 生效（棘轮设计使然，fs-agent 同语义）。需追溯清洗时：删掉基线中对应条目，下次提交即按高置信重新进入 fresh 并阻断。
- 存量目标项目的旧恒警告接线段：安装器已支持识别旧段**原位升级**为两档段（marker 不变、重跑幂等、用户手改过的段不含旧整段文本会自然保留）；目标项目重跑一次 install-hotspot-gate --guardrails-only 即完成升级。
- 交叉复核（2026-09-25，双子 Agent：代码逻辑+安全 / 治理一致性）总体判定 PASS（P0/P1 零项）；上述整改项即复核建议的落地，其余 P3 备忘（quoted-path 清单正则、基线损坏零发现时不重写、fallback/gitleaks rule ID 空间切换自愈）记录在案不改。
