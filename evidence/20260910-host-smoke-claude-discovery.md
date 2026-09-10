# 宿主 smoke：Claude Code 全新会话发现性验证

日期：2026-09-10
授权：用户明确授权一次真实宿主安装 + smoke（本轮）。
关联任务包：tasks/20260910-host-smoke-claude-discovery.md（accepted）
复现脚本：`scripts/smoke-claude-skill-discovery.ps1`（`-Install` / `-Probe` / `-Uninstall`）

## 一、结论（精确到验证了什么、没验证什么）

| 事项 | 结果 |
|---|---|
| **fresh-session discovery（Claude Code 是否发现并注册该技能）** | ✅ **VERIFIED**（A/B 实测：装了 169，移出 168，delta=1） |
| 宿主加载根 | `user=C:\Users\MSX\.claude\skills`（`managed=...\ClaudeCode\.claude\skills` 在本机不存在） |
| bundle 构建（产品自带白名单工具） | ✅ PASS，76 文件 |
| **`validate_runtime_bundle` 深度校验** | ❌ **UNAVAILABLE**（缺受信任基线 git 对象，见下） |
| 宿主 trust（是否把技能指令当权威执行） | ⏳ 仍 `UNVERIFIED` |
| 技能行为正确性（端到端是否按契约工作） | ⏳ 仍 `UNVERIFIED` |
| Hook 强制（pre-action 拦截） | ⏳ 仍 `UNVERIFIED`（适配器文档亦如此声明） |

**这是仓库自述未验证项中第一条被真实证据关闭的**：Claude 适配器文档 `Unverified` 里写着
「Fresh-session discovery and loading behavior in the user's current Claude Code version」。
本机 Claude Code 版本：**2.1.266**（≥ 文档提到的 2.1.59）。

## 二、方法与证据

1. **不自造安装集**：用 Sliver 自带 `scripts/build_runtime_bundle.py --target claude-code`，
   按 `packaging/runtime-manifest.json` 白名单产出（core_files 9 + core_trees 8 + claude overlay 2 → 76 文件）。
   禁止路径（`tests/`、`packaging/`、`.github/`、`README.md`、海报/二维码图等）均未进入。
2. **装到文档指定 install root**：`~/.claude/skills/sliver-vibe-coding`（此前不存在 → 只新增，不覆盖）。
   装机 76 文件，逐文件记录 sha256 与回滚命令。
3. **A/B 全新会话探测**（`claude -p --debug-file`，隔离目录，非交互）：

```text
Loading skills from: managed=C:\Program Files\ClaudeCode\.claude\skills, user=C:\Users\MSX\.claude\skills, project=[]
装我们技能   : Loaded 169 unique skills
临时移出后   : Loaded 168 unique skills
delta        : 1  →  DISCOVERED
```

4. 回滚：`Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\skills\sliver-vibe-coding"`（当前**保留已安装**状态，用户可选择回滚）。

### 宿主机布局事实（新记录）

`~/.claude/skills` 是一个 **junction/别名**，与 `F:\skiils工具\_adapters\shared\skills` 指向同一目录
（标记文件法验证）。写回滚清单时按别名路径记录是正常的，但**回滚命令用 `$env:USERPROFILE` 路径更稳**。

## 三、本次 smoke 发现的两个真实问题

### 问题 1：深度校验缺少「受信任基线 git 对象」（阻塞 `validate_runtime_bundle`）

```text
FAIL: trusted runtime baseline Git object is unavailable: 29695fe099c6b38c9b5c470abbb2e065fc1ff936
```

- 该 commit 被 `governance/sliver-core/tests/governance/baseline-29695fe.json` 与
  `scripts/test_governance_baseline_contracts.py` 引用；
- **本地 Sliver 源仓库不含该对象**（`git cat-file -t` 报 could not get object info；仓库**非浅克隆**）；
- 因此 `validate_runtime_bundle.py` 的完整校验在本机**无法完成** —— 现有「静态候选」结论仍成立，但**不是**已校验。
- 解除方式（需要授权）：在**不影响来源工作树**的前提下让该对象可用，例如对来源仓库做一次 `git fetch`
  （会写入来源 `.git`，属修改来源项目 → 本轮未做），或另建一个含完整历史的克隆。
  建议由 owner 决定，不自行改动来源仓库。

### 问题 2：bundle 内模板资产在 Claude Code 中触发 YAML frontmatter 解析失败

Claude Code 会扫描技能目录下的 `.md` 并尝试解析 frontmatter，我们的 3 个模板资产解析失败：

```text
WARN/ERROR: assets\project-audit\audit-report.md      YAML Parse error: Unexpected token
WARN/ERROR: assets\project-decision\adr.md            YAML Parse error: Unexpected token
WARN/ERROR: assets\project-feature\feature-truth.md   YAML Parse error: Unexpected token
```

- 这 3 个文件是 **Sliver 上游模板资产**（与来源逐字节一致）。**不能为了消错而修改它们**——那会破坏字节一致性；
  正确处置是作为**上游发现**上报，而不是在统一仓库里打补丁。
- 对照：同一次加载里其它 61 条同类错误来自用户环境里**既有**的其它技能（非本次安装引入），
  属既有的宿主卫生问题，与本仓库无关。

## 四、边界与后续

- 本 smoke **只验证发现性**，不构成「技能可用/宿主可信/Hook 已强制」的声明。
- 已安装状态可随时用一条命令回滚；未写入任何既有技能目录。
- 尚未做：Codex 侧同类 smoke（`codex exec` 可非交互执行，方法是同一套 A/B）；
  技能行为端到端验证；trust/Hook 验证。
- 建议把「宿主 smoke」作为**显式、按需**动作（消耗真实额度），不接入 `verify.ps1`；已提供复现脚本。

---

## 五、附带发现：运行宿主工具时改动了快照，被新门禁当场抓住

跑宿主 smoke 需要用 Sliver 自带的 Python 工具，而它们会在 `governance/sliver-core/scripts/` 下生成
`__pycache__/*.pyc`。随后 `verify.ps1` 的「来源快照完整性」**立即失败**：

```text
[FAIL] 来源快照完整性 — 快照文件数变化: sliver-core 记录=223 实际=224;
       快照树摘要变化: sliver-core 记录=sha256:1f0e7c44… 实际=sha256:2bd3c8e5…
```

清理过程中进一步查出**更根本的问题**：**旧基线记录的 223 个文件里，本身就有 3 个未被 git 跟踪的
`.pyc` 构建产物**（223 = git 跟踪的 220 + 3 个未跟踪 `.pyc`）。也就是说旧基线把构建垃圾当成了审计内容，
而 Sliver 自己的 `runtime-manifest.json` 的 `forbidden_runtime_names` 明确禁止 `__pycache__`。

处理：删除这些构建产物 → 磁盘快照回到 **220 文件，与 git 跟踪内容完全一致**；重新记录基线
（sliver-core `fileCount=220`、`treeHash=sha256:c8ab7c36…`），来源背书仍通过。

**这条发现本身就是新门禁价值的证明**：此前「生成镜像不得手工修改 / 快照必须与来源一致」只有断言，
本轮第一次真的因为一次工具运行而被拦下。同时暴露了旧基线的一处质量问题（混入未跟踪构建产物），现已修正。
