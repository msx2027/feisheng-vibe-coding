# 证据：T6 Hook 解锁（经验沉淀启用）+ 全链路冒烟 + 宿主证据重采

- 日期：2026-09-11
- 授权：owner 明确选择「解锁，做全套安全门」（T6 全部门槛按交接要求逐项履行）
- 提交：`6311bc9`（T6 解锁）+ 本证据提交

## 1. 全链路冒烟（想法 → 立项路由）

真实感探测（仓库树外沙箱项目）：中文输入「我想做一个帮宠物主人记录疫苗、驱虫和体检的小工具……整理成可以开工的产品规格」。
实测：入口自动触发 → 控制面加载 → `runtime_decision_contract.py route-catalog` → 选中主路由**「立项」** →
加载路由 owner（routes-intake/question-bank/project-templates/task-risk-gates）→ 产出结构化的立项访谈
（项目名/形态/核心功能/提醒方式/明确不做，每问带推荐）。路由自身的 intake 机制正常接管，provider 委派按需发生。

## 2. 宿主发现性证据重采（T7 项提前完成）

`scripts/collect-host-skill-evidence.ps1` 升级：新增统一包内嵌套技能的安装判定（installed-in-shared-bundle）。
重采结果（82 条）：模型可见 60、仅安装可见 14、未安装 8（全部为应缺席的排除/别名类）、**accepted 记录零缺失**。
采集零额度消耗（codex debug prompt-input 为本地命令）。

## 3. T6 解锁设计与实施

**范围决策**：vibe 源钩子系统约 3000 行，其中治理类门禁（pre-commit-check/stop-gate/mark-*，与控制面验收职责重叠）
**有意不搬**（单一真源原则）；解锁的启用面收敛为「经验沉淀」两事件，runner **原生实现**（契约禁止执行源钩子）。

- 契约 v2（`adapters/vibe-hooks/contract.json`）：status=`enabled-experience-sedimentation-v1`，
  按事件分级启用——SessionStart（只读提醒）+ UserPromptSubmit（纠错信号采集）启用；
  PreToolUse/PostToolUse/Stop 禁用（exit 3，理由：与控制面治理重复）。
  owner 豁免记录：vibe-original-* 族许可证（自用）；分析发现产品类技能的 `.vibe-docs.json` 为「读取式定位器」而非硬依赖。
- runner（`scripts/invoke-vibe-hook-adapter.ps1`）重写：
  - SessionStart：只读汇总目标项目 `.claude/feedback/FEEDBACK-INDEX.md` 待处理条数，零写入
  - UserPromptSubmit：保守纠错词表（不对/搞错了/重新做/wrong…）命中才向白名单索引追加一行 JSON；**始终 exit 0**
  - 白名单强制：规范化先行（根包含 → 规范化相对路径白名单匹配）+ 逐级 reparse point 祖先检查（封顶 TargetRoot）+ leaf 自身检查
  - 幂等：sha256(namespace|event|sessionId|prompt) 前 40 hex，600 秒保留期，过期允许重录
  - 永不执行源钩子；禁用事件 exit 3；payload 非法/普通输入静默 exit 0
- 安装器（`scripts/install-vibe-hooks.ps1`）：自包含副本（runner+契约，SHA 记录）装到目标项目
  `.feisheng/vibe-hooks/`，原子合并注册 `.claude/settings.json` 两事件（临时文件+替换，Depth 20），
  `-Uninstall` 清注册与副本、**保留经验数据**；拒绝装进统一包自身、拒绝非 git 目录、拒绝无 -Force 重复安装。

## 4. T6 六项门槛逐项状态（全部 PASS）

1. per-skill-license：owner 豁免记录在 LICENSE-MAP ✓
2. verified-source-revision：快照由 provenance 完整性门禁钉住 ✓
3. host-discovery-and-fresh-session-smoke：D2/D3 实测 + 证据重采 ✓
4. event-order-and-concurrency-smoke：测试双 shell（pwsh + PS 5.1）全过——
   幂等标记/过期重录、SessionStart 只读、UserPromptSubmit 白名单追加、
   **junction 逃逸负面用例**（feedback 目录为 junction 时纠错数据必须留在目标项目内）、
   禁用事件 exit 3、契约篡改 fail-closed ✓
5. approved-write-whitelist-and-rollback-plan：白名单两条路径 + 卸载保留用户数据 + 契约状态翻回即全实例 fail-closed ✓
6. independent-logical-review：独立子代理审查（有界 diff）两轮——首轮 APPROVE-WITH-FINDINGS 提出
   P1×2（reparse 白名单逃逸、安装器/回滚零测试）+ P2 若干；P1 全部闭合（规范化先行匹配、
   reparse 祖先守卫封顶 TargetRoot、leaf 自身检查、状态目录 reparse 预检、安装/卸载/篡改/过期测试），
   复审结论 APPROVE-WITH-FINDINGS 无阻断项，剩余 P2 已随手修复或记录为已知限制 ✓

实施过程中实测修复的真实缺陷：DryRun 语义、PS 5.1 原生命令引号剥离、PS 5.1 控制台代码页（GBK）中文乱码、
`$stateDir`/`$StateDir` 大小写不敏感撞名导致状态目录解析进仓库（白名单外写入，已修并清污染）、
StrictMode 下空对象属性枚举、JSON 管道编码。

## 5. 门禁与终态

- 本机门禁 **13/13**（Hook 步骤改为「适配器安全契约」语义）；fresh clone 四组合 **全部 13/13**
- 真实会话冒烟（两次，含最终版 runner）：纠错语气中文 prompt → 钩子自动采集，
  索引带真实 session_id 与 prompt 原文；会话正常完成；目标项目零污染
- 回滚实测：`-Uninstall` 清注册与副本、经验数据保留 ✓

## 6. UNVERIFIED / 已知限制

- 自动沉淀三件套（experience-elevator / evolution-engine / feedback-writer）的**技能级**接入仍待办：
  Hook 已能采集纠错信号，但「信号 → 技能化处理」的闭环需要后续批次把这些技能原生实现进 runner 或接入包内
- 新接入的 29 个技能的逐技能产出质量：UNVERIFIED（用一次验一次）
- 真人测试前的 `_smoke/` 清理：有意保留（探测脚手架可能复用）
- 共享根其余 ~66 个源仓库链接：阶段 5 口径待 owner
