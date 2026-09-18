# 密钥泄漏护栏加购（v2 加固批 C）登记（2026-09-19）

- 任务包：`tasks/20260919-v2-hardening-plan.md`（G4）/ `tasks/20260919-v2-hardening-implementation.md`（批 C）。
- 输入 revision：main @ `c4fe1b2`。执行者：批 C worker（总指挥已批准；C0 形态裁决已定）。
- 纪律遵守：未动 `provenance/LOCAL-PATCHES.json`（落地阶段处理）；未跑 verify.ps1 / build-canonical-catalog.ps1；本仓库零 git add/commit/push；样例项目全部在系统临时目录。

## C0 形态与渊源（不复活声明）

- 形态（owner 裁决）：扩展既有 `skills/product/hotspot-governor/tools/install-hotspot-gate.mjs`
  加购模块——同一入口、同一接线点（pre-commit 同一钩子文件）、同一 owner、幂等标记段内追加；
  **未新建第二个安装器**。
- 渊源记录（只作 lineage，**不影子复活**）：冻结快照
  `sources/vibe-coding-skills/tools/check-target-guardrails.mjs` 是上游仓库的「目标项目生命周期
  文档护栏」只读检查器（.vibe-docs.json manifest / 四字中文文档名 / 隐私文件名警告），
  与本次密钥扫描**无代码复用关系**；本批只继承其「只读、警告级、不阻断」的语义精神。
  未从快照捞回任何文件；若未来要捞回该文件本身，重走完整准入。

## 上游模板来源与锁定值（零自研）

| 模板 | 来源 URL（上游官方） | 锁定值 |
|---|---|---|
| `tools/templates/gitleaks.toml` | gitleaks 官方 README「Custom configuration」：自定义配置 = `[extend]` `useDefault = true`（逐字采用，不定义任何规则） | release **v8.30.1**（2026-03-21 发布），tag commit `83d9cd684c87d95d656c1458ef04895a7f1cbd8e`；内嵌默认规则真源 `config/gitleaks.toml` blob sha `256f64790ea6d954f0041024be2938089ae1e7a7`（97,731 字节，构建期嵌入官方二进制，规则随二进制走） |
| `tools/templates/semgrep-ci.yml` | `https://docs.semgrep.dev/semgrep-ci/sample-ci-configs`「Sample GitHub Actions configuration file」**Semgrep CE 变体**（YAML 逐字保留，仅加文件头 provenance 注释块） | semgrep-docs 仓库 commit `54083d188f8f8279b8585af906098b09921ac897`（2026-05-28，最后触碰该页的提交）；容器 `semgrep/semgrep`；规则集 `--config auto` |

- gitleaks pre-commit 官方用法（README）：推荐 pre-commit 框架（`repo: https://github.com/gitleaks/gitleaks`, `id: gitleaks`）；v8.19.0 起 `detect`/`protect` 弃用（官方迁移 gist：gist.github.com/zricethezav/b325bb93ebf41b9c0b0507acf12810d2），命令对照 `gitleaks protect --staged` → `gitleaks git --pre-commit --staged`；官方基线旗标 `--baseline-path`（README 示例 `gitleaks git --baseline-path gitleaks-report.json --report-path findings.json`）。
- 本机可用性：`gitleaks`、`semgrep` 二进制均**未安装**（PATH 检查 NOT-FOUND）。全部实测走安装器内置轻量正则兜底（任务书允许的替代路径，如实记录）；gitleaks 级联代码在位但未经真机验证（见遗留风险 1）。

## 变更物

1. `skills/product/hotspot-governor/tools/install-hotspot-gate.mjs`（修改，+36/−14）：
   hotspot 主体**逐语句原样**收进 `installHotspotGate()` 函数；主流程新增 `--uninstall` /
   `--guardrails-only` 分派；头注补加购说明与 fail-safe 第五条（密钥护栏永远警告级）。
   hotspot 主门禁行为零变化（已由三态实测回归确认）；入口 SKILL.md 启动动作的调用方式
   （位置参数）向后兼容，默认路径 = 主门禁 + 加购一同装配。
2. `tools/guardrail-addon.mjs`（新增，安装器侧供给/卸载模块，被主入口 import）：
   投放（执行器 + gitleaks 模板，沿 hotspot「缺失即装 / 一致跳过 / 不一致=本地适配跳过」语义）、
   钩子接线（标记 `guardrail-secret-wired`，自包含段，`|| true` 尾缀）、CI 激活裁决、
   首检基线（仅首次安装生成；重跑只报存量数）、卸载。**永不设置 core.hooksPath**（那是
   hotspot 主门禁的接线动作）：写「实际生效的钩子文件」，绝不写入 git 不会执行的死钩子。
3. `tools/secret-scan.mjs`（新增，目标项目侧自包含执行器，随装复制到 `<目标>/tools/guardrails/`）：
   首检基线 + 棘轮——基线 `tools/guardrails/secret-baseline.json`（随项目提交可审查）；
   **吸收必先警告**（提交期新增违规 stdout 警告一次并进基线）、**修复即剔除**（本运行覆盖文件
   中已消失的条目剔除；未覆盖文件一律不动）、**修复后再犯 = 新指纹再次警告**；
   退出码恒 0，**不做提交期硬阻断**（9-18 否决项：误拦致 hook 被整体禁用）。
   扫描器级联（fail-open）：PATH 有 gitleaks → 官方二进制（v8.19+ 命令，`--config` 挂官方模板，
   报告 JSON 归一化）；不可用/报错 → 内置轻量正则兜底（保守 5 类）。
4. `tools/templates/gitleaks.toml`、`tools/templates/semgrep-ci.yml`（新增，上游官方模板）。

执行语义边界：本地提交层永远警告级；CI 层（Semgrep 官方模板）沿用上游默认失败语义
（发现即 CI 红），作为收工凭据的「真伪兜底」独立复跑层——该边界已写入模板头注与 install 输出。

### C2 降级矩阵（实现与实测对应）

| 目标项目状态 | 行为 | 实测 |
|---|---|---|
| 非 git 仓库 | 沿 hotspot 先例拒绝安装并提示 | `装配失败：目标不是 git 仓库（棘轮依赖 git 基线）`，EXIT=1 |
| git 仓库无远端 | 本地 pre-commit 层足够；CI 模板仍写入但不激活（`tools/guardrails/semgrep-ci.yml.disabled`） | ✓；加 GitHub 远端后重跑 → 激活 `.github/workflows/semgrep.yml` 并清理 disabled 副本 |
| 非 Node 栈 | 裸 `.git/hooks` 受控标记段接线（不走 Husky、不动 hooksPath、不拷 hotspot 模块） | `--guardrails-only` 于 Python 样例：钩子落 `.git/hooks/pre-commit`（0o755），`core.hooksPath` 未设置，`tools/` 未创建 hotspot 模块 |
| 已装 hotspot 门禁 | 同一钩子文件同段幂等追加；重跑零改动跳过 | 合并装配路径下追加进 `tools/githooks/pre-commit`；重跑全树 sha256 零差异 |

## 三态实测（系统临时目录真实 git 仓库）

样例：`%TEMP%\tmp.5a624VEETW\fresh-app`（Node 布局：src/ + lib/ + package.json，真实 `git init`）。
命令均为 `node <分发包>/skills/product/hotspot-governor/tools/install-hotspot-gate.mjs <样例根>`。

1. **安装**：EXIT=0。hotspot 11 模块新装；pre-commit 棘轮接线 `tools/githooks/pre-commit`；
   加购文件新装 2（secret-scan.mjs + gitleaks.toml）；同段追加密钥护栏段；
   无远端 → CI 模板写入但不激活；首检基线生成（存量 0）。钩子文件终态 = hotspot 段 + 密钥护栏段
   两个独立标记段，互不嵌套。
2. **幂等重跑**：安装前后全树 sha256 快照一致（`ad41d78f…→ad41d78f…`），**零改动断言 PASS**
   （模块一致 11 / 加购一致 2 / 两段均「已接线，跳过」/ CI 跳过 / 基线已存在跳过）。
3. **卸载（--uninstall）**：摘除密钥护栏标记段（hotspot 棘轮段原样保留）、移除 `tools/guardrails/`
   整目录、未由本加购写入的 CI 不动；全仓 grep `guardrail-` 残留 0；hotspot 段在位（计数 1），
   `core.hooksPath` 配置未动——**干净回退断言 PASS**。二次卸载全路径「未发现，跳过」（卸载幂等）。

### 端到端密钥告警路径（同一样例，内置正则兜底引擎）

| 步骤 | 操作 | 结果 |
|---|---|---|
| E1 | 提交含假 AWS key（`AKIAIOSFODNN7EXAMPLE`，20 位标准形态）的文件 | `WARNING [FALLBACK-AWS-KEY] src/config.yaml:1 疑似新增密钥/凭据（警告级…）`，**commit EXIT=0 不阻断**，指纹进基线（存量 1） |
| E2 | 删除该密钥并提交 | `修复剔除 1，基线存量 0`（棘轮只减不增），无警告 |
| E3 | 再引入同类**新**密钥（GitHub token 形态 `ghp_…`）并提交 | `WARNING [FALLBACK-GITHUB-TOKEN] …` 再次告警（修复后不得无警告回归），不阻断，进基线 |
| E4 | 提交良性文件（占位符/文档提及） | 新增疑似 0，零误报 |

开发过程中的实测修正（诚实记录）：①首版基线剔除的判定边界误用「有发现的文件集」，修复后
条目不剔除——已改为「本运行覆盖的文件集」（暂存清单含 D，文件整删视为已修复）；②同一行同一
密钥值被 AWS 规则与通用赋值规则双报——已加同值去重（同行只报最具体一条）；③首个测试向量
误写成 AKIA+19 位（非真实 AWS key 形态），正则不匹配——证明兜底正则忠实于官方密钥格式、
无过匹配，测试向量已改为标准 20 位。

## 误报初值（为「连续 2 次误拦降级」攒数据）

- 良性样例 4 向量（`your-*` 前缀占位值、`EXAMPLE_*` 前缀占位值、`${ENV}` 引用、正文提及
  `AKIA` 字样）→ **0 误报**。
- 通用赋值规则的反误报约束（初值设计）：变量名白名单（api_key/secret/access_token/auth_token/
  client_secret/password 等，不含裸 `token`）+ 值 ≥20 位 + 同时含字母与数字 + 占位前缀/
  全同字符/纯数字拒绝。
- 真实误报样本：0（初值，随落地积累；连续 2 次误拦 → 警告降级提醒，不在其上叠层）。
- 诚实记录的漏报盲区（保守换误报）：裸 `token = "…"` 变量名不在名单；>512KB 文件、二进制、
  `tools/guardrails/` 与 node_modules/dist/vendor 等目录不扫。

## 换思路信号观察项（登记）

- **观察项**：「不做边界/停止条件」放宽批准率（终局条款 §4）。数据源：dev-plan「不做边界/
  停止条件」字段 + 收工对账记录；异常升高 → 问题在输入侧（Spec 模板与拆分粒度），
  **回改输入，不加执行期拦截**。
- 本批关联观察项：密钥护栏真实误报率（同上，初值 0）。

## 已知边界与遗留风险

1. gitleaks 级联未经真机验证（本机无二进制）：`--config` 挂载、报告 JSON 字段映射
   （RuleID/File/StartLine/Secret）按官方报告格式实现，待有二进制环境复验。
2. CI 层上游默认失败语义：存量问题的项目接入 GitHub 远端后 CI 会红（模板头注已明示；
   回滚点 = `--uninstall`，仅移除本加购激活的工作流文件）。
3. 加购文件升级传播受「本地适配保护」约束：目标侧旧扫描器不会被安装器覆盖，升级需走登记流程。
4. 存量已装项目不会自动获得加购：入口启动动作「已装配则零改动跳过」；需手动重跑安装器
   （属落地阶段事项，本批未执行）。
5. `--staged` 读工作树内容（staged 与工作树不一致的边缘场景以工作树为准，警告级可容忍）。
6. 未做（按纪律/分工）：`provenance/LOCAL-PATCHES.json` 登记（落地阶段处理）；verify.ps1 /
   build-canonical-catalog.ps1；本仓库 git add/commit/push。临时样例目录
   `%TEMP%\tmp.5a624VEETW\fresh-app` 留存备查（系统临时目录，随系统清理，内容已全文录入本证据）。

## 真机复验补记（总指挥，2026-09-19）：官方 gitleaks v8.30.1 级联

- 官方二进制 v8.30.1（= 模板锁定版本）实测：模板 `[extend] useDefault=true` 生效；AWS 文档示例密钥（AKIAIOSFODNN7EXAMPLE）被官方规则默认放行（误报少于兜底正则，符合预期）；逼真假密钥（AKIA+16 位随机）被检出（"leaks found: 1"，规则 generic-api-key）。
- 全链路级联：加购安装后的目标项目内，PATH 注入官方二进制 → secret-scan 引擎选择 = gitleaks，检出同一密钥、警告级、进基线、退出码 0（不阻断提交），与设计完全一致。
- fail-open 复验：无官方二进制环境（裸目标）→ 自动回退内置正则，行为不变。
- 残留：semgrep 级联仍属"字段映射按官方格式实现、待有容器环境复验"（本机无 Docker/Semgrep，风险低——CI 模板仅在项目接远端后激活）。
