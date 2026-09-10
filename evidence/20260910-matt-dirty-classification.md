# Matt 工作树脏改动分类证据

## 结论

截至本次只读检查，`F:/skiils工具/mattpocock-skills` 的 `HEAD` 为
`9fe7e7a3bb352851b986725bab1c7cfb17610a97`（`main`，与
`origin/main` 同步），工作树有且仅有以下 4 个未暂存的已跟踪文件：

1. `skills/engineering/ask-matt/SKILL.md`
2. `skills/engineering/code-review/SKILL.md`
3. `skills/engineering/implement/SKILL.md`
4. `skills/engineering/tdd/SKILL.md`

四个文件组成一个内容上相互关联的命名改动：把 Matt 的 review skill 从
`code-review` 改成 `mattpocock-code-review`，并同步改动三个调用方引用。但
`README.md`、`skills/engineering/README.md`、`.claude-plugin/plugin.json`、
`.claude-plugin/marketplace.json` 和 `docs/engineering/*.md` 仍有旧的
`/code-review` 或 `code-review` 引用；`git log --all` 也没有发现新名称的已
提交历史。

按任务包“不得推断作者意图”和“无法证明来源/意图必须标记
`unclassified`”的门槛，四个文件均分类为：

| 文件 | 分类 | 置信度 | 迁移结论 |
| --- | --- | ---: | --- |
| `skills/engineering/ask-matt/SKILL.md` | `unclassified` | 0.98 | 暂停迁移；先确认命名变更是否正式、并补齐所有调用方/文档/清单 |
| `skills/engineering/code-review/SKILL.md` | `unclassified` | 0.99 | 暂停迁移；frontmatter canonical name 发生变化但没有已提交来源 |
| `skills/engineering/implement/SKILL.md` | `unclassified` | 0.98 | 暂停迁移；调用引用依赖未获证明的名称 |
| `skills/engineering/tdd/SKILL.md` | `unclassified` | 0.98 | 暂停迁移；调用引用依赖未获证明的名称 |

这不是对改动意图的否定，而是 provenance（来源证明）不足时的保守结论。
不得自行丢弃、回滚、清理或把这些文件复制进统一仓库。

## 检查范围与基线

- 源目录：`F:/skiils工具/mattpocock-skills`
- 目标仓库：`F:/skiils工具/feisheng-vibe-coding`
- 目标仓库基线：`699d53db84275a42ae8a2676b0dfe899e3f996ed`
- 源 `HEAD` 提交时间：`2026-08-30T16:10:17+08:00`
- 源 `HEAD` subject：`Merge pull request #30 from vinvcn/fix/openai-display-name-english`
- 源分支：`main`；上游：`origin/main`；ahead/behind：`+0 -0`
- 本次没有对源目录执行写操作，没有提交、暂存、回滚、重置或清理。

## 命令与退出码

以下命令均在 `F:/skiils工具/feisheng-vibe-coding` 中执行；涉及源目录的命令
均通过 `git -C` 或绝对路径只读访问。

| 命令 | 退出码 | 关键结果 |
| --- | ---: | --- |
| `git -C F:/skiils工具/mattpocock-skills status --short` | 0 | 仅列出上述 4 个 `M` 文件 |
| `git -C F:/skiils工具/mattpocock-skills status --porcelain=v2 --branch` | 0 | `# branch.oid 9fe7e7a3...`、`# branch.head main`、4 条 `.M`；均为未暂存修改 |
| `git -C F:/skiils工具/mattpocock-skills rev-parse HEAD` | 0 | `9fe7e7a3bb352851b986725bab1c7cfb17610a97` |
| `git -C F:/skiils工具/mattpocock-skills branch --show-current` | 0 | `main` |
| `git -C F:/skiils工具/mattpocock-skills show -s --format='%H%n%ad%n%s' --date=iso-strict HEAD` | 0 | 见上方 HEAD 信息 |
| `git -C F:/skiils工具/mattpocock-skills diff --stat` | 0 | `4 files changed, 4 insertions(+), 4 deletions(-)`；Git 仅报告 LF→CRLF 警告 |
| `git -C F:/skiils工具/mattpocock-skills diff --name-status` | 0 | 4 条 `M`，路径与本证据一致 |
| `git -C F:/skiils工具/mattpocock-skills diff --numstat -- skills/engineering/ask-matt/SKILL.md skills/engineering/code-review/SKILL.md skills/engineering/implement/SKILL.md skills/engineering/tdd/SKILL.md` | 0 | 每个文件均为 `1 1` |
| `git -C F:/skiils工具/mattpocock-skills diff --cached --stat` | 0 | 空；没有暂存变更 |
| `git -C F:/skiils工具/mattpocock-skills diff --cached --name-status` | 0 | 空；没有暂存变更 |
| `git -C F:/skiils工具/mattpocock-skills diff --check` | 0 | 未发现 whitespace 错误；仍报告 LF→CRLF 警告 |
| `git -C F:/skiils工具/mattpocock-skills check-attr text eol -- skills/engineering/ask-matt/SKILL.md skills/engineering/code-review/SKILL.md skills/engineering/implement/SKILL.md skills/engineering/tdd/SKILL.md` | 0 | 四文件 `text` 与 `eol` 均为 `unspecified` |
| `git -C F:/skiils工具/mattpocock-skills log --all -S'mattpocock-code-review' -- skills/engineering/ask-matt/SKILL.md skills/engineering/code-review/SKILL.md skills/engineering/implement/SKILL.md skills/engineering/tdd/SKILL.md` | 0 | 无输出；没有该新名称的已提交历史 |
| `git -C F:/skiils工具/mattpocock-skills log --all -G'mattpocock-code-review' -- skills/engineering/ask-matt/SKILL.md skills/engineering/code-review/SKILL.md skills/engineering/implement/SKILL.md skills/engineering/tdd/SKILL.md` | 0 | 无输出；没有该新名称的已提交历史 |
| `git -C F:/skiils工具/mattpocock-skills log --all -n 8 -- skills/engineering/ask-matt/SKILL.md skills/engineering/code-review/SKILL.md skills/engineering/implement/SKILL.md skills/engineering/tdd/SKILL.md` | 0 | 最近共同文件历史见“历史证据” |
| `git -C F:/skiils工具/mattpocock-skills fsck --no-reflogs --unreachable` | 0 | 无输出；未发现可用于证明来源的不可达对象 |
| `rg -n --encoding utf-8 --glob '*.md' --glob '*.json' '/code-review|name: mattpocock-code-review|"code-review"' F:/skiils工具/mattpocock-skills/README.md F:/skiils工具/mattpocock-skills/skills/engineering F:/skiils工具/mattpocock-skills/docs/engineering F:/skiils工具/mattpocock-skills/.claude-plugin` | 0 | 新旧命名并存；详见“交叉引用证据” |
| `rg -n --encoding utf-8 'mattpocock-code-review|f81745ae810fbf28ccf6eac5752b8955c8cd780fbb6771d0b869edf2f723a6fa|f95c5e9273dfeb7a915a7cb54f4010a710c2c19d0c6d6c52a25da9b52edb327c|b6ad1eadeb9affefcba5a777c6ca2218536d8c608e80ca66568b1218f7d39817|e9c7146953dce7a2e0903e24104578655cdc4733efd52f4f845d8f5e19625489' F:/skiils工具/feisheng-vibe-coding/provenance` | 0 | 目标 `SKILL-INVENTORY.json` 记录了当前脏文件 SHA 与 canonicalCandidate |
| `git -C F:/skiils工具/mattpocock-skills -c core.pager=cat diff --no-ext-diff --no-color --unified=0 -- skills/engineering/ask-matt/SKILL.md skills/engineering/code-review/SKILL.md skills/engineering/implement/SKILL.md skills/engineering/tdd/SKILL.md` | 0 | 输出见“完整 diff（零上下文）” |

`git diff --unified=0` 的命令退出码为 0；输出中的四个文件警告仅为 Git 的
行尾转换提示，不是 diff 失败。

## 完整 diff（零上下文）

```diff
diff --git a/skills/engineering/ask-matt/SKILL.md b/skills/engineering/ask-matt/SKILL.md
@@ -26 +26 @@ disable-model-invocation: true
-   无论哪种方式，**`/implement`** 都会在内部驱动 **`/tdd`** 构建每个 issue：一次一个 red-green slice；然后用 **`/code-review`** 收尾，对 diff 做 Standards + Spec 双轴 review，再提交。只想在没有完整 spec 的情况下 test-first 构建一个具体 behavior 时，单独用 **`/tdd`**；想按固定点 review branch 或 PR 时，单独用 **`/code-review`**。
+   无论哪种方式，**`/implement`** 都会在内部驱动 **`/tdd`** 构建每个 issue：一次一个 red-green slice；然后用 **`/mattpocock-code-review`** 收尾，对 diff 做 Standards + Spec 双轴 review，再提交。只想在没有完整 spec 的情况下 test-first 构建一个具体 behavior 时，单独用 **`/tdd`**；想按固定点 review branch 或 PR 时，单独用 **`/mattpocock-code-review`**。
diff --git a/skills/engineering/code-review/SKILL.md b/skills/engineering/code-review/SKILL.md
@@ -2 +2 @@
-name: code-review
+name: mattpocock-code-review
diff --git a/skills/engineering/implement/SKILL.md b/skills/engineering/implement/SKILL.md
@@ -13 +13 @@ disable-model-invocation: true
-完成后，使用 `/code-review` 审查这次工作。
+完成后，使用 `/mattpocock-code-review` 审查这次工作。
diff --git a/skills/engineering/tdd/SKILL.md b/skills/engineering/tdd/SKILL.md
@@ -38 +38 @@ Tests 应通过 public interfaces 验证 behavior，而不是 implementation details。
-- **Refactoring is not part of the loop.** Refactoring 属于 review stage（见 `code-review` skill），不属于 red -> green implementation cycle。
+- **Refactoring is not part of the loop.** Refactoring 属于 review stage（见 `mattpocock-code-review` skill），不属于 red -> green implementation cycle。
```

## SHA 与模式

下表中 `HEAD blob` 是 `git rev-parse HEAD:<path>`，`worktree blob` 是
`git hash-object <path>`，`SHA-256` 是当前工作树文件的 SHA-256。四文件
均为 `100644`，没有文件类型或权限变化。

| 文件 | HEAD blob | worktree blob | 当前文件 SHA-256 |
| --- | --- | --- | --- |
| `skills/engineering/ask-matt/SKILL.md` | `3e3e995bdfaf077f318b9727196ebfebad2fb882` | `711b85d61af1805e88bfa8eca12486a09c864c49` | `f81745ae810fbf28ccf6eac5752b8955c8cd780fbb6771d0b869edf2f723a6fa` |
| `skills/engineering/code-review/SKILL.md` | `44368a8c1d06b8e875c6a076510fb0d4860abf32` | `5c06628a3c432c12647bdeecf2dad383f8a0aebe` | `f95c5e9273dfeb7a915a7cb54f4010a710c2c19d0c6d6c52a25da9b52edb327c` |
| `skills/engineering/implement/SKILL.md` | `3b640ff7b4b365ea5a92f2a0362997858a65f59a` | `ea400bf9f08c08f10fabb3fbdfdbf758eb91b442` | `b6ad1eadeb9affefcba5a777c6ca2218536d8c608e80ca66568b1218f7d39817` |
| `skills/engineering/tdd/SKILL.md` | `73192cd409159f8e511930d984a9125a37821b80` | `bf72cbcf3214388dabf4e9f9d49627a63505d0e3` | `e9c7146953dce7a2e0903e24104578655cdc4733efd52f4f845d8f5e19625489` |

`provenance/SKILL-INVENTORY.json` 中存在四项对应的当前 SHA 记录，且将
`code-review` 记录为 `mattpocock-code-review`；这证明目标仓库曾记录过这份
工作树快照，但不能证明 Matt 源目录中的改动已经由作者正式提交，也不能单独
证明其最终意图。

## 文件用途与迁移风险

### `skills/engineering/ask-matt/SKILL.md`

- 用途：Matt 工程技能的兼容选择器/路由说明；当前 diff 只把两个 review
  调用点改成 `mattpocock-code-review`。
- 直接影响：执行 `/implement` 后的 review 路径，以及用户直接按固定点做
  review 的入口文字。
- 风险：如果新 frontmatter 名称不是最终名称，这两个入口会失效；如果只迁移
  此文件而没有同步 review skill 与宿主发现清单，会产生悬空调用。
- 证据边界：内容与 `code-review/SKILL.md` 的名称改动相互配套，但没有提交、
  PR、变更说明或完整 manifest 更新来证明这是正式本地变更。

### `skills/engineering/code-review/SKILL.md`

- 用途：从 fixed point 到 `HEAD` 的 Standards + Spec 双轴代码审查技能。
- 直接影响：frontmatter 的 canonical name 从 `code-review` 变为
  `mattpocock-code-review`；路径仍是 `skills/engineering/code-review/`。
- 风险：这是四个文件中影响最大的一项。命名会影响 skill discovery、显式
  slash 调用、别名、plugin manifest、README 和所有下游引用；目录名未变而
  frontmatter 变更还可能造成路径名与运行时名称不一致。
- 交叉证据：`.claude-plugin/plugin.json`、`marketplace.json`、两个 README 和
  `docs/engineering/code-review.md` 仍以 `code-review` 为旧名称。

### `skills/engineering/implement/SKILL.md`

- 用途：按 spec/ticket 实现工作，并在结束时进入 review。
- 直接影响：完成步骤中的 review skill 调用名。
- 风险：单独迁移会调用一个未被宿主注册、或与 frontmatter 不一致的名称；与
  `code-review/SKILL.md` 不同版本组合时会直接导致运行时找不到技能。
- 证据边界：它只有一行引用变化，没有独立提交或来源说明。

### `skills/engineering/tdd/SKILL.md`

- 用途：定义 red-green-refactor 循环、测试 seam 与反模式。
- 直接影响：关于 refactoring 属于 review stage 的交叉引用。
- 风险：TDD 正文本身行为规则没有变化，但名称引用会把读者/模型导向新
  canonical name；如果新名称未完成注册，属于文档/调用断链。
- 证据边界：它只有一行引用变化，没有独立提交或来源说明。

## 历史与交叉引用证据

四文件最近共同历史（`git log --all -n 8 -- <4 paths>`）从新到旧为：

```text
b46e15502d9ce2fa839797cb253d509fdd26faef  2026-08-11T23:33:45+08:00  sync upstream skills at 6acc160
a9147dc5fb51429897ed07282621dd2858085afe  2026-07-23T08:08:22+08:00  修复 PR #17 审查发现项：一处误译与若干打磨
fb10cdb01b9025c459c2c586d3ff264ee2a20ac2  2026-07-23T07:28:36+08:00  翻译保真度复核：修复误译/歧义/漏译，全量展开 docs 对齐上游
dbe24e9e5f27a1afd0c7bb5fb146aa48fe1036db  2026-07-22T22:25:48+08:00  sync upstream skills at ed37663
62cf4a992099bb76716a6315ffbcf2bdbae4ae14  2026-07-12T21:45:20+08:00  sync upstream skills at 391a270
c71ad544ac0402107187d93d16a7e80d401331ee  2026-07-04T13:55:08+08:00  localize skill descriptions
042407b16ca9bf6494d48e37cb3e475d051d341f  2026-07-04T08:01:56+08:00  sync upstream skills refresh to 272f99b
f9db7d3405604fa1d3256d0422725021ad696dbc  2026-06-29T16:28:46+08:00  sync upstream skills refresh
```

针对四文件执行 `git log --all -S'mattpocock-code-review'` 和
`git log --all -G'mattpocock-code-review'` 均无输出；`git fsck
--no-reflogs --unreachable` 也无输出。因此目前没有可在源仓库内追溯的提交、
不可达对象或变更说明来证明该名称的正式来源。

定向搜索还得到以下事实（退出码均为 0）：

```text
README.md:220       implement ... `/code-review`
README.md:230       [code-review](...)
skills/engineering/README.md:16  implement ... `/code-review`
skills/engineering/README.md:30  [code-review](...)
.claude-plugin/plugin.json:16    "code-review"
.claude-plugin/plugin.json:23    "./skills/engineering/code-review"
.claude-plugin/marketplace.json:18 "code-review"
docs/engineering/code-review.md:9,50,52,54,56,60,72  多处 `/code-review`
docs/engineering/tdd.md:35,67  多处 `/code-review`
skills/engineering/code-review/SKILL.md:2  name: mattpocock-code-review
```

因此可以确认“新旧名称并存”，不能确认“新名称已完成正式迁移”。

## 未验证项与停止条件

- 未验证作者、分支协作者或原始 issue/PR 的意图；源仓库没有提供可追溯提交。
- 未验证四个文件是否来自一次临时实验、尚未提交的正式本地适配，或其他来源。
- 未验证 Claude/Codex/其他宿主在 frontmatter 名称变化后的实际 discovery 与
  slash 调用行为。
- 未运行源项目完整插件校验、skill smoke、fresh-session smoke 或 runtime
  projection；这些不属于本只读分类任务。
- 未验证目标仓库是否允许以当前脏 SHA 作为可发布输入。

停止条件：在获得作者/维护者确认、对应提交或可审计变更说明，并完成 README、
plugin/marketplace manifest、工程文档和所有调用引用的一致性校验前，保持 Matt
源目录迁移 gate 为 blocked；不要自行选择保留、丢弃、回滚或覆盖这四个文件。

