# 证据：D2 转绿（全局路由块更新）+ T4 接入 tdd/code-review + 4 个重名条目退役

- 日期：2026-09-11
- 授权：owner 在 T2/T3 报告后回复「确认」，批准 ①更新 `~/.claude/CLAUDE.md` 与 `C:\Users\MSX\AGENTS.md` 的路由块
  ②复测 D2 ③T4 接入 ④退役 4 个点名条目
- 提交：`e224c03`（T4 接入）+ 本证据提交

## 1. 全局路由块更新（owner 配置，仓库外）

- 两文件中 2026-09-08 的「vibe-coding-skills × mattpocock-skills 双入口」块替换为
  「统一入口 feisheng-vibe-coding」规则（项目级请求一律先进统一入口、工程纪律由控制面委派、
  spec 真源唯一、旧顶层条目退役、ask-matt 仅导航）。
- 原文件备份：`_smoke/global-config-backup-20260911/`（gitignore，临时）；旧块全文见该备份。
- 改动仅限 `SKILLS-ROUTING` 标记块（CLAUDE.md）与「Project-Specific Rules」下的同名小节（AGENTS.md），
  两文件的其余内容一字未动。

## 2. D2 复测：纯自然语言触发 —— 通过

- 方法：探测项目放在**仓库树外**（`%TEMP%\feisheng-t2-final\project`，规避父级内存污染），
  全新会话 `claude -p '帮我看看这个项目现在有什么风险，下一步应该先做什么？'`，stream-json 全程留痕。
- 观察（同一会话，全部 tool_use 实录）：
  1. 第一个动作即 `Skill {"skill": "feisheng-vibe-coding"}` —— **纯中文自动触发成立**
  2. 第二步即读对 `governance/sliver-core/SKILL.md`（T3 启动动作指针生效，无路径试错）
  3. 执行包内 `runtime_decision_contract.py route-catalog` → 选中主路由「项目体检」→
     `route-projection --route "项目体检"` → 读路由 owner `routes-intake.md`
  4. 之后才检查目标项目（git 状态、文件、运行 `inventory.py` 复现 KeyError），产出「项目体检报告」
- 对应验收：D2 ✓（中文需求 → 宿主加载入口）；D3 ✓（路由选择 + provider 调用 + owner 加载）。
- 额度消耗：本步 1 次 `claude -p`。

## 3. T4：tdd / code-review 接入 runtime（提交 `e224c03`）

晋升前置四条件逐项核验：许可证（mattpocock MIT，`runtimeEligible: true`）✓；
writeAuthority（均声明 `none`）✓；宿主证据（`HOST-DISCOVERY-EVIDENCE.json` 两者 `installedInSharedRoot: true`）✓；
语义审查（reasonsById 均有已记录裁决）✓。原「待宿主行为 smoke」阻塞由 T2/T3 的链路实测解除。

操作（沿用 20260910-matt-primitive-adoption 样板）：

1. 从 `9fe7e7a3` 绑定快照逐字节导入：`skills/engineering/tdd/`（SKILL.md + mocking.md + tests.md + agents/）、
   `skills/engineering/code-review/`（SKILL.md + agents/）；`agents/` 由 bundlePolicy 自动排除在投影外。
2. 分类真源：两者 `readiness: accepted` + `writeAuthority: ["none"]`，reasonsById 补记接入依据。
3. 路由绑定 owner（`engineering-execution.md`）Internal Capability Providers 表新增 2 行
   （vendored 文件逐字节 CRLF 插入，0 混入 LF）；`LOCAL-PATCHES.json` 既有绑定补丁条目更新
   patchedSha256 与验证说明；`record-provenance-integrity.ps1` 重算通过。
4. `LICENSE-MAP.json` mattpocock 族的 scope 注释由 "accepted primitives only" 更新为
   "accepted primitives and the code-review checker"（策略语义不变，runtimeEligible 本为 true）。
5. 门禁：路由绑定 **admitted=9 bound=9**（原 7/7）；runtime include 文件 90→**94**；NOTICE runtime items 9→**11**；
   全套 **13/13**；fresh clone 四组合（autocrlf true/false × pwsh/PS5.1）**全部 13/13**。

## 4. 重名条目退役（宿主技能根）

- 事实核查：共享根里指向三个源仓库的链接共约 70 个（交接 §10 边界所指「源仓库链接」）。
  本次只退役 owner 点名的 4 个——它们与统一包内容**重名冲突**（同一能力宿主里出现两份），
  其余 ~66 个不重名、不在确认范围内，原样保留（阶段 5 再议）。
- 已退役（只删链接本身，源仓库原封未动；`os.rmdir` 删除，坑 #11）：

| 条目 | 形态 | 指向 | 回滚命令 |
|---|---|---|---|
| `tdd` | SymbolicLink | `F:\skiils工具\mattpocock-skills\skills\engineering\tdd` | `New-Item -ItemType SymbolicLink -Path '<root>\tdd' -Target 'F:\skiils工具\mattpocock-skills\skills\engineering\tdd'` |
| `code-review` | Junction | `F:\skiils工具\vibe-coding-skills\skills\code-review` | `New-Item -ItemType Junction -Path '<root>\code-review' -Target 'F:\skiils工具\vibe-coding-skills\skills\code-review'` |
| `mattpocock-code-review` | SymbolicLink | `F:\skiils工具\mattpocock-skills\skills\engineering\code-review` | 同上（Junction→SymbolicLink 对调） |
| `vibe-coding-skills` | Junction | `F:\skiils工具\vibe-coding-skills\skills\vibe-coding-skills` | `New-Item -ItemType Junction -Path '<root>\vibe-coding-skills' -Target 'F:\skiils工具\vibe-coding-skills\skills\vibe-coding-skills'` |

（`<root>` = `F:\skiils工具\_adapters\shared\skills`）

- 退役后状态：共享根 **176** 条（原 180）；`feisheng-vibe-coding` 入口唯一；4 个退役名零残留。
- 统一包重装（sourceRevision = `e224c03`，96 文件，Validate 通过）：
  `skills/engineering/{tdd,code-review}` 以包内路径出现，Codex `debug prompt-input` 实测
  `r0/feisheng-vibe-coding/skills/engineering/tdd/SKILL.md` 带描述可见；独立链接条目零残留；
  Codex 注入条目 204→202（−4 退役 +2 包内新技能，账目吻合）。

## 5. UNVERIFIED / 遗留

- 交互式会话（非 `-p`）的实际体验：UNVERIFIED（`-p` 是交接认可的验证口径；交互式留给 owner 日常使用观察）。
- `HOST-DISCOVERY-EVIDENCE.json` 整体重采：仍留 T7（其中 tdd/code-review 的 `installedInSharedRoot` 字段
  按旧口径采集，现实际状态是「随统一包安装」，语义仍为已安装）。
- 共享根其余 ~66 个源仓库链接的退役批次：属阶段 5，需 owner 定口径，本批未动。
- T5（18 条许可证已放行未接入）、T6（Hook 解锁）：按交接顺序保持待办；Hook 仍为禁用态且验证为拒绝执行。
