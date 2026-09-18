# 任务包：v2 工程化加固具体实施方案（批 A/B/C 执行手册）

- 日期：2026-09-19
- 输入 revision：main @ `c4fe1b2`
- 上游计划：[`20260919-v2-hardening-plan.md`](20260919-v2-hardening-plan.md)（目标/非目标/合规义务以计划为准，本文件不重复）
- 约束提醒：所有 vendored 补丁过 `c4fe1b2` 新门禁（围栏奇偶 / frontmatter 键集 / 路径 token 骨架不变量）；行号为 2026-09-19 快照，编辑时以文件实况定位。

---

## 批 A：文字与登记层（S，≤1 人日）

### A0 压力测试取证（先于一切文字改动）

方法（TDD-for-skills，superpowers `testing-skills-with-subagents` 同款）：

1. **无条款基线 ×3**：fresh 会话，构造两个标准化场景——①向 AI 报告它上轮结论有误（测讨好）；②要求只写实现不写测试（测删码条款缺位）。逐字记录 agent 反应。
2. **加条款后对照 ×3**：同场景复测，逐字记录差异。
3. 若对照无差异 → 该条款**不登记不上线**（终局条款：无效即不加）。
4. 产物：粘贴进 `evidence/<执行日>-hardening-batch-a.md`。owner 的"复核→改造工具"漂移案例一并引为逃逸路径证据。

### A1 tdd 技能加指针行

- 文件：`skills/engineering/tdd/SKILL.md`
- 位置：`## Rules of the loop`（L34-38），L36 `**Red before green.**` 条目之后。
- 文字（**逐字锁死** dev-builder「严格 TDD 铁律」，防双真源）：

  ```markdown
  - **Production code first = delete it.** 生产代码先于失败测试写出时，删除该实现并从 RED 重新开始，不保留作参考（与 dev-builder「严格 TDD 铁律」同一规则）。
  ```

- **零净增账（owner 裁决点）**：建议将 L38 `**Refactoring is not part of the loop.**` 并入 L36 尾部（"……不要添加 speculative features；refactoring 属于 review stage（见 `code-review` skill）"），删去原 L38 整条，净条目数不变。若 owner 否决合并，改在 evidence 中声明等价删并方案。

### A2 审查者 brief 加反表演句

- 落点定位命令：`grep -n "brief\|Under 400" governance/sliver-core/references/engineering-execution.md skills/engineering/code-review/ -r`
- 标准：改的必须是**审查者 sub-agent 实际加载的自包含 brief 文本**（正方复核定位在 `engineering-execution.md` 约两段 brief 处；若实况在 `skills/engineering/code-review/` 下则改那边——以 grep 实况为准）。
- 文字（一句，两处同文，与控制面 L28 既有语义同源引用）：

  ```markdown
  只报证据支持项；禁止对作者或方案表达讨好性认同（参照控制面 "Do not say 'you are right'" 条款）。
  ```

### A3 sliver-core Operating Law 补半句（边界声明全覆盖）

- 文件：`governance/sliver-core/SKILL.md`，`## Sliver Operating Law` 节。
- 原句：`Ordinary work stays narrow but still needs current truth, a clear owner, a test decision, and targeted verification.`
- 改为（追加半句）：

  ```markdown
  Ordinary work stays narrow but still needs current truth, a clear owner, a test decision, targeted verification, and a declared file boundary checked against the actual diff at close.
  ```

- 语义边界：声明源头仍是 dev-plan「不做边界/停止条件」字段（dev-builder 流）或本句本身（普通任务）；收工凭据（批 B）只做对照，不产生第二份声明。

### A4 登记 + 再生 + 门禁

1. `provenance/LOCAL-PATCHES.json`：
   - tdd/SKILL.md → **新登记**（runtime-import，files[] 逐文件 sourceRevision/originalSha256/patchedSha256，reason 写逃逸路径，evidence 指向批 A 文件）。
   - 审查者 brief / sliver-core 两处 → 按**实际所在文件**选通道：skills/** 下走 runtime-import 更新既有条目 `retired-capability-reference-text-fix`（追加 change 注记 + 更新 patchedSha256，先例 = 9-18 批）；sliver-core 下走 sliver-core 快照补丁登记（先例 = `sliver-route-binding-capability-providers`）。
2. `pwsh scripts/build-canonical-catalog.ps1 -RepoRoot <repo>`
3. `pwsh scripts/build-capability-index.ps1 -RepositoryRoot <repo>`
4. `pwsh scripts/verify.ps1 -RepositoryRoot <repo>`（15 步 + 1c-3 不变量，全绿）
5. 证据：`evidence/<执行日>-hardening-batch-a.md`（压力测试记录 + 零净增账 + 补丁登记号）。

---

## 批 B：Stop 收工凭据（M，1-2 人日；依赖 A3 定稿的声明句）

### B0 owner 授权

行为扩展 = 契约变更。先例：`evidence/20260917-auto-record-batch.md`（owner 会话中拍板）。先取得授权记录，再动手。

### B1 凭据 schema 定稿（一张凭据，替代收工时刻三道重叠自检）

```json
{
  "verification": [{ "command": "...", "exitCode": 0, "outputDigest": "关键输出摘要" }],
  "scope": { "declared": ["文件清单或来源声明"], "outOfScope": [] },
  "findings": { "deferred": 0, "rejectedWithReason": 0 }
}
```

- 钩子职责边界：**只验存在与形状**（字段齐、类型对）——沿用现有 10 秒存在性检查能力，不验真伪、不重跑命令。
- 真伪兜底：批 C 的 CI 独立复跑。没有 CI 的项目 = 凭据只余仪式价值，属已知边界，如实写入契约说明。

### B2 改适配器

- 文件：`scripts/invoke-vibe-hook-adapter.ps1`
- L344/346 两条 block 理由文本 + L399 SessionStart 常备义务文本：改为要求自检记录携带上述凭据；凭据缺失或形状不对 → block（沿用 `stop_hook_active` 一次续停语义与 3 次 fail-open 封顶，不新增重试层）。

### B3 同步契约

- 文件：`adapters/vibe-hooks/contract.json`：L5 `enablementScope` 说明、L74 `Stop.behavior`、版本号 bump；`rollback` 节写明降级路径。

### B4 降级路径（终局条款减法机制）

同凭据门禁**连续 2 次误拦**（owner 确认非违规）→ 自动降级为提醒模式，登记于 contract 状态字段；不在其上叠层。

### B5 回归 + 投装 + 冒烟

1. `pwsh tests/test-vibe-hook-adapter.ps1`：新增用例——凭据缺失→block；形状不对→block；齐备→放行；3 次封顶→fail-open 保持。
2. 各已装目标项目重跑 `pwsh scripts/install-vibe-hooks.ps1`（副本在目标 `.feisheng/vibe-hooks/`）。
3. **每目标项目**重取 fresh-session 冒烟证据（`contract.json` enablePrerequisites 明文要求），未取证前该目标项目状态报 `UNVERIFIED`。
4. 证据：`evidence/<执行日>-hardening-batch-b.md`（授权记录 + 用例清单 + 各目标冒烟凭证）。

---

## 批 C：护栏加购（M-L，2-4 人日；独立，可与 A/B 并行）

### C0 形态裁决点（owner 拍板，二选一）

- **推荐**：扩展 `skills/product/hotspot-governor/tools/install-hotspot-gate.mjs` 加购模块（同一接线点、同一 owner、幂等标记段内追加；入口启动动作已预授权自动装配）。
- 备选：新脚本走完整五门禁准入。两案均须在 evidence 中声明与冻结快照 `sources/vibe-coding-skills/tools/check-target-guardrails.mjs` 的关系（只作 lineage 说明，**不影子复活**——捞回即重走准入）。

### C1 加购内容（零自研模板）

- gitleaks + Semgrep：取**上游官方** pre-commit/CI 配置，版本锁定；作为加购模板投放到目标项目（投放到目标项目的文件不算包内净增）。
- 执行语义：**首检基线 + 棘轮**——首检产出基线，存量违规不拦；新增违规警告级报出并计入凭据 `findings`。**不做提交期硬阻断**（9-18 否决项）。

### C2 降级矩阵

| 目标项目状态 | 行为 |
|---|---|
| 非 git 仓库 | 沿 hotspot 先例：拒绝安装并提示 |
| git 仓库无远端 | 本地 pre-commit 层足够（CI 模板仍写入但不激活） |
| 非 Node 栈 | 裸 `.git/hooks` 受控标记段接线（不走 Husky） |
| 已装 hotspot 门禁 | 同一段内追加，幂等零改动跳过 |

### C3 卸载

`--uninstall` 语义仿 `contract.json` rollback 节：移除本加购写入段，不动 hotspot 主门禁与用户自有 hook。

### C4 实测取证

样例新手项目（真实 git 仓库）三态实测：安装 → 幂等重跑（零改动）→ 卸载（干净回退）；含一次真实新增违规被警告的端到端记录 + 误报率初值（为"连续 2 次误拦降级"攒数据）。

### C5 证据与观察项

`evidence/<执行日>-hardening-batch-c.md`（三态记录 + 误报初值）；登记换思路信号观察项：「不做边界/停止条件」放宽批准率（异常 → 回改输入侧，不加拦截）。

---

## 并行与落地顺序

**开发三路并行（互不阻塞）**：
- 路线 A：A0 压力测试 → A1/A2/A3 文字定稿（暂不落地）
- 路线 B：B0 owner 授权 → B1 凭据 schema → B2/B3 适配器与契约 → B5 回归用例（分支上完成，**不激活**）
- 路线 C：C0 形态裁决 → C1-C3 加购实现 → C4 样例项目三态实测

**落地串行（三个硬理由）**：①`LOCAL-PATCHES.json`/catalog 是单写点，A、C 落地都碰它；②AGENTS.md「一次只接一个有界能力组」；③B 的启用语义依赖 A3——A3 未落地时普通任务没有声明源，凭据假拦会烧掉「连续 2 次误拦降级」预算，门禁上线即残废。

```
落地队列：① 落 A（登记 + catalog 再生 + verify 全绿）
        → ② 激活 B（各目标项目重装 + fresh-session 冒烟；前提：A3 已在 ① 中落地）
        → ③ 落 C（若 C0 选扩展 vendored 工具：同样走登记 + 再生 + verify）
```

**回滚**：批 A 还原 LOCAL-PATCHES 对应 files[] 并重生成 catalog；批 B contract 版本回退 + 目标项目重装；批 C `--uninstall`。每批落地后 verify.ps1 全绿才进下一批；未取证的强制面一律报 UNVERIFIED。
