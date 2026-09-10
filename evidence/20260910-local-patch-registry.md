# 本地补丁登记机制（B 方案）：provenance 模型升级

日期：2026-09-10
决策来源：owner 选择 B —— 「本仓库自持后允许对 vendored 内容做本地补丁，并把偏差登记制度化」。
关联任务包：tasks/20260910-local-patch-registry.md（accepted）

## 一、模型升级：从「镜像 · 字节一致」到「vendor · 偏差登记」

| | 升级前 | 升级后 |
|---|---|---|
| 不变量 | 每个快照文件必须与来源逐字节一致（或在补充白名单/revision 来源内） | 同上，**外加**：已登记本地补丁的文件允许偏离，但两侧哈希都必须被登记且校验通过 |
| 偏差处理 | 一律视为漂移 → 门禁失败 | **未登记**的偏差 = 漂移（fail-closed）；**已登记**的偏差 = 合法且可验证；**登记过期**（哈希不符）= 失败 |
| 可逆性 | — | 登记同时保存 `originalSha256`，可从记录的 `sourceRevision` 完全还原原内容 |

新增真源：`provenance/LOCAL-PATCHES.json`（schema `feisheng-local-patches/v1`）。
登记一项必须包含：`snapshot`、`path`、`sourceRevision`、`originalSha256`、`patchedSha256`、`reason`、`evidence`。

## 二、首个补丁：修掉 Sliver 模板资产在 Claude Code 的 YAML 解析错误

### 根因（实测定位，非猜测）

三个模板资产的 YAML frontmatter 把 `@@占位符@@` 直接作为值，而 **YAML 规定 `@` 不能作为 token 起始字符**：

```text
while scanning for the next token
found character '@' that cannot start any token
  audit_route: @@审计产物落盘入口（…）@@
```

受影响文件与行数（每个 4 行）：`assets/project-audit/audit-report.md`、`assets/project-decision/adr.md`、`assets/project-feature/feature-truth.md`。

### 修法（语义无损）

给占位符值加引号：`audit_route: @@…@@` → `audit_route: "@@…@@"`；flow 序列 `owners: [@@…@@]` → `owners: ["@@…@@"]`。

**为什么这是无损的**：YAML 解析后会剥掉引号，得到的值**仍然是原来的 `@@…@@` 字符串**（已实测核对每个键）；
任何下游按 `@@…@@` 做占位符替换的逻辑完全不受影响。改动量：3 文件 × 4 行 = 12 行增 / 12 行删。

### 登记记录

| 文件 | originalSha256 | patchedSha256 |
|---|---|---|
| `assets/project-audit/audit-report.md` | `dcc25ed53617…` | `39c104e9ad4b…` |
| `assets/project-decision/adr.md` | `10821d1cd470…` | `c8032387c078…` |
| `assets/project-feature/feature-truth.md` | `7dac5bfae82b…` | `a877d81ff0d8…` |

## 三、门禁与记录器改造

| 位置 | 改动 |
|---|---|
| `scripts/provenance-integrity.ps1` | 新增 `Get-LocalPatches`；校验器对已登记补丁的路径改为：快照必须 == `patchedSha256`，来源必须仍 == `originalSha256`（后者能单独发现「上游在补丁底下动了」）；新增计数 `locallyPatchedCheckedFiles` |
| `scripts/record-provenance-integrity.ps1` | 同样识别登记；把 `locallyPatchedPaths`（含 `patchId`）写入 `PROVENANCE-INTEGRITY.json` |
| `provenance/OWNER-LEDGER.json` | 新增 `local-patch-registry` owner（`provenance/LOCAL-PATCHES.json`） |

## 四、验证（全部实测）

### 1) 登记被正确识别

```text
corroboration: 751 files byte-identical to source, 4 verified against recorded git revision,
               3 registered local patch(es) verified, 148 within supplement allowlist
```

751 + 4 + 3 + 148 = 906 = 550（vibe）+ 136（matt）+ 220（sliver）✓

### 2) 与 Sliver 深度校验兼容（先读代码确认，再实测）

读了校验器源码：期望文件集取自**我们自己的 source_root**（`runtime_source_entries`），内容比对是
`digest(source) != digest(actual)`（bundle ↔ 我们的快照），而 trusted baseline **只用于路径集合**
（"Reject any candidate bundle that removes an immutable-base asset"）。故打补丁与深度校验不冲突。

实测（重建 bundle 后）：

```text
OK: claude-code runtime bundle validated (76 files)
OK: codex       runtime bundle validated (78 files)
```

（注：先前一次 FAIL `runtime file drifted from its owner` 是我命令未加 `--force`、校验了旧 bundle 所致，非补丁问题。）

### 3) 宿主端到端效果（真实 Claude Code）

| | 补丁前 | 补丁后 |
|---|---|---|
| 我们技能触发的 YAML 解析失败 | 3 条 | **0 条** |
| 全新会话加载技能数 | 169 | 169（发现性不变） |

### 4) 反例：已登记补丁被篡改

```text
[FAIL] 来源快照完整性 — 快照树摘要变化 …; 快照与来源不一致: sliver-core 共 1 个文件
       → assets/project-audit/audit-report.md (content-vs-registered-patch)
ok=False
```

还原后 SHA 回到 `39c104e9ad4b…`（与登记一致），`verify.ps1` 恢复 PASS。

## 五、边界与未验证项

- 未修改任何**未登记**的文件；除这 3 个已登记补丁外，快照仍与来源逐字节一致。
- 未修改来源仓库（对来源只读；patch 只作用于本仓库快照）。
- 「上游在补丁底下动过」这类漂移由 `originalSha256` 比对发现；本轮上游未动（Sliver 工作树 `clean @ 30c7cfb3`）。
- 仍未验证：宿主 trust、技能行为、Hook 强制。
- 补丁只解决了 YAML 噪音；那 3 个模板在真实目标项目中的实例化行为未验证。
