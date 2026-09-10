# 换行可复现性修复（accepted）

日期：2026-09-10
关联任务包：tasks/20260910-line-ending-reproducibility.md（accepted）
发现来源：evidence/20260910-vibe-checker-promotion.md 第六节（跑 fresh clone 对照时的附带发现）
提交：`8e30d2f`（修复本体）、`00451d6`（防回归门禁）

## 一、结论

修好了。此前「逐字节一致的来源快照」这个核心主张**只在本机当前工作树成立**，
换机器 / 换 clone / CI 上不成立。现在它在 `core.autocrlf` 为 `true` / `false` / `input`
三种配置下都成立，并且有门禁防止回归。

## 二、缺陷与根因（修复前实测）

```
git clone <repo> /tmp/x && cd /tmp/x && pwsh scripts/verify.ps1
→ [FAIL] 来源快照完整性
   树摘要变化: vibe-coding-skills 记录=sha256:d22a304c… 实际=sha256:c5d3f7d3…
   快照与来源不一致: vibe-coding-skills 共 492 个文件 content-vs-source
```

该结果在**修复前的 HEAD（`3e14dd3` / `591710a`）** 上即复现，与 Vibe 检查器接入无关。

根因链条：

1. 仓库**没有 `.gitattributes`**（`git ls-files --eol` 的 `attr/` 列为空），
   换行行为完全由使用者本地 `core.autocrlf` 决定。
2. git 索引里保存的是**规范化后的 LF blob**；而三处登记的 sha 全都是在**工作树字节**上算的：
   `PROVENANCE-INTEGRITY.json` 的 `treeHash`、`CANONICAL-CATALOG.json` 的 `sourceSha256`、
   `VIBE-IMPORTS.json` 的逐文件 sha。
3. 三个来源的字节并不一致：`vibe-coding-skills` = **LF**，`mattpocock-skills` = **CRLF**，
   `sliver-core` = **CRLF**（本轮实测三棵树的工作树字节与来源项目逐字节相等）。
4. 于是**无论 `core.autocrlf` 取哪个值，总有一半树对不上**：
   - `autocrlf=true`：LF blob 检出成 CRLF ⇒ LF 来源的 vibe 快照失败（就是实测的 492 个）
   - `autocrlf=false`：LF blob 保持 LF ⇒ CRLF 来源的 matt / sliver 快照失败

**附带说明**：修复后该问题不再有解的必要性区分 —— 属性优先于 `core.autocrlf`。

## 三、修复内容

1. 新增 `.gitattributes`，对必须逐字节保真的树声明「不做任何换行转换」：

```
sources/** -text
skills/** -text
governance/sliver-core/** -text
```

`-text` 的语义是「两个方向都不转换」，因此**提交的 blob 就是来源的字节**，任何 clone 都原样还原。
**故意不**加全仓库规则：其余路径没有逐字节门禁，全局规则会为 ~1400 个文件改变检出行为而无已验证收益。

2. 用 `git add --renormalize` 以**当前工作树原始字节**重新登记这三个树。
   注意不能整体用 `git add --renormalize`（会把内容收敛成 LF，与 matt/sliver 的 CRLF 来源相反）。

## 四、「只改换行、不改内容」的等价证明（必须的，因为这是一次大范围 blob 改写）

对三个保真树内**全部 1274 个已跟踪文件**逐文件测量：

| 检查项 | 结果 |
|---|---|
| 工作树字节与改动前基线完全一致（未触碰任何内容） | **1274 / 1274** |
| 索引 blob == 工作树字节（clone 会原样还原） | **1274 / 1274** |
| 新旧 blob 在 CRLF→LF 归一化后相同 | **1274 / 1274** |
| blob 实际发生变化 | **383** |
| 除换行外内容不同（真实漂移） | **0** |

因此这是一次纯粹的换行表示变更：**没有任何内容改动，也不需要重算任何已登记的 sha**
（算 sha 所依据的工作树字节没变）。属性覆盖情况（1274 个文件零遗漏）：

| `git ls-files --eol` | 数量 | 含义 |
|---|---|---|
| `i/crlf w/crlf attr/-text` | 7 | vibe 快照内本来就是 CRLF 的文件 |
| `i/lf w/lf attr/-text` | 491 | vibe 快照主体 |
| `i/mixed w/mixed attr/-text` | 1 | `ui-ux-pro-max/data/styles.csv`（连混合换行也原样保住） |
| `i/-text w/-text attr/-text` | 54 | 二进制（字体等） |

## 五、验收：fresh clone × 三种 autocrlf 配置

验收方式按任务要求：**新目录 clone 后**跑全套门禁（不是在本机工作树跑）。

| clone 的 `core.autocrlf` | 结果 | clone 后 `git status` |
|---|---|---|
| `true` | **11/11 PASS** | 干净（0 变更） |
| `false` | **11/11 PASS** | 干净（0 变更） |
| `input` | **11/11 PASS** | 干净（0 变更） |

且三种 clone 中代表文件与来源项目**逐字节相同**：

| 对象 | 与来源 byte-identical | 字节数 | 换行 |
|---|---|---|---|
| vibe 快照 | True | 9064 | LF |
| matt 快照 | True | 6181 | CRLF |
| sliver 快照 | True | 19872 | CRLF |
| Vibe 导入副本 | True | 9064 | LF |

对照修复前：同一提交的 fresh clone 是 **8/10**（两条 sha-vs-登记 门禁失败，与登记无关的那条通过）。

## 六、防回归门禁（`scripts/verify.ps1` 步骤「保真树换行可复现性」）

用 `git ls-files --eol` 对三个保真树逐文件检查两件事：

1. 属性确实是 `-text`（规则覆盖到、且没被删）；
2. 索引 blob 与工作树字节一致（`i/` 与 `w/` 相同 —— 这正是「clone 会原样还原」的等价表述）。

反例实测（都按预期拒绝，已回退）：

| 反例 | 实测 |
|---|---|
| 删掉 `.gitattributes` 里的 `sources/** -text` 规则 | `[FAIL] 保真树换行可复现性 — 违规 1274 个`（`verify: 9/10`） |
| 把某个 matt 快照文件的索引 blob 重新规范化成 LF（工作树仍 CRLF） | `[FAIL] 保真树换行可复现性`（`i/lf != w/crlf`，`verify: 9/10`） |

**写这条门禁时我自己踩了两个「错而不报」的坑，都已修好并留下防御**（诚实记录，因为这类 bug 比崩溃更危险）：

1. `git ls-files --eol` 的实际格式是「前三个字段空格对齐 + 一个 TAB + 路径」，我最初只按 TAB 切，
   结果**每一行都被跳过** → 门禁在属性已被删除的情况下仍然 PASS（假通过）。反例测试才暴露它。
2. 修好切分后，我又直接拿原始 `i/crlf` 与 `w/crlf` 比较 —— 这两个前缀天生不同，
   导致**全部 1274 个文件被报成违规**（假报错）。

针对第 1 类问题加了硬防御：步骤末尾自检「成功解析的行数 == git 输出行数」，
不相等就直接判失败，**不允许格式变化静默变成通过**（与 `collect-host-skill-evidence.ps1` 的同一原则）。

## 七、边界与未做

- 只覆盖三个保真树。其余路径换行仍由 `core.autocrlf` 决定，但它们没有逐字节门禁，
  CI 与所有门禁的结果不依赖它们（已由三种配置的 clone 验收背书）。
- `docs/CAPABILITY-INDEX.md`、`provenance/SLIVER-IMPORT.json` 等生成物仍是 mixed 换行
  （`Set-Content` 追加的行尾与字符串内部的 `\n` 不一致）。新鲜度校验做归一化比较，因此无影响；
  本轮**没有**改生成器的写入方式，避免把改动面扩到「所有生成物字节」。
- 未在真实 GitHub runner 上跑过 CI（本地等价复现的是 fresh clone + `autocrlf=true`，也就是
  Windows runner 的默认情形）。仍然需要一次真实 CI 运行来确认。
- 未验证 Windows 之外的平台（Linux/macOS runner 默认 `core.autocrlf=false`，本轮已用
  `autocrlf=false` clone 覆盖该等价情形）。
