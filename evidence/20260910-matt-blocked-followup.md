# Matt 源技能阻塞复核证据

复核日期：2026-09-10
任务包：`tasks/20260910-matt-blocked-followup.md`
目标源仓库：`F:\skiils工具\mattpocock-skills`
目标仓库基线：`F:\skiils工具\feisheng-vibe-coding`，任务包基线提交 `cf3216825f28aebb0183337508f2cf614c8d7910`

## 结论

结论保持 **blocked**，不能转为可审计的 `adapter-candidate`。

原因是：源仓库 `HEAD` 为已知提交 `9fe7e7a3bb352851b986725bab1c7cfb17610a97`，但工作树仍有四个目标技能文件的未提交修改；没有对应的新提交、PR 或维护者确认；并且新命名没有同步到完整公开清单（`plugin.json`、`marketplace.json`、工程 README、根 README 仍引用旧名 `code-review`）。因此只能把这次改动视为待归类的工作树变更，不能作为稳定来源解锁。

## 实际命令与退出码

以下命令均在只读审计中执行，退出码均为 `0`；没有对 Matt 源仓库执行写入或回滚。

```text
git -C 'F:\skiils工具\mattpocock-skills' rev-parse HEAD
=> 9fe7e7a3bb352851b986725bab1c7cfb17610a97

git -C 'F:\skiils工具\mattpocock-skills' branch --show-current
=> main

git -C 'F:\skiils工具\mattpocock-skills' status --short --branch
=> ## main...origin/main
=>  M skills/engineering/ask-matt/SKILL.md
=>  M skills/engineering/code-review/SKILL.md
=>  M skills/engineering/implement/SKILL.md
=>  M skills/engineering/tdd/SKILL.md

git -C 'F:\skiils工具\mattpocock-skills' log -8 --oneline --decorate
=> HEAD/main/origin/main/origin/HEAD 均指向 9fe7e7a3bb352851b986725bab1c7cfb17610a97
=> 提交标题：Merge pull request #30 from vinvcn/fix/openai-display-name-english

git -C 'F:\skiils工具\mattpocock-skills' diff --stat -- skills/engineering/ask-matt/SKILL.md skills/engineering/code-review/SKILL.md skills/engineering/implement/SKILL.md skills/engineering/tdd/SKILL.md
=> 4 files changed, 4 insertions(+), 4 deletions(-)

git -C 'F:\skiils工具\mattpocock-skills' diff --check
=> 0（仅报告 LF/CRLF 转换 warning，无 whitespace error）

git -C 'F:\skiils工具\mattpocock-skills' diff --cached --name-status
=> 空（没有已暂存 revision）

git -C 'F:\skiils工具\mattpocock-skills' log --all --grep='mattpocock-code-review' --oneline
=> 空（没有包含新命名的已提交记录）

git -C 'F:\skiils工具\mattpocock-skills' remote -v
=> origin https://github.com/vinvcn/mattpocock-skills-zh-CN (fetch/push)
```

## 工作树改动与命名交叉引用

`HEAD` 中四个文件的 Git blob 记录仍对应原始内容；工作树只改了以下四处：

| 文件 | HEAD 内容 | 工作树内容 | 影响 |
|---|---|---|---|
| `skills/engineering/code-review/SKILL.md` | frontmatter `name: code-review` | frontmatter `name: mattpocock-code-review` | 改了公开 skill 名称，但目录和插件路径仍为 `code-review` |
| `skills/engineering/implement/SKILL.md` | 完成后调用 `/code-review` | 完成后调用 `/mattpocock-code-review` | 直接调用方已跟随新名 |
| `skills/engineering/tdd/SKILL.md` | refactoring stage 引用 `code-review` | 引用 `mattpocock-code-review` | 直接引用方已跟随新名 |
| `skills/engineering/ask-matt/SKILL.md` | flow 收尾调用 `/code-review` | flow 收尾调用 `/mattpocock-code-review` | 路由器已跟随新名 |

已核对的旧名残留：

- `.claude-plugin/plugin.json` 的 `skills` 路径仍为 `./skills/engineering/code-review`，keywords 仍为 `code-review`。
- `.claude-plugin/marketplace.json` keywords 仍为 `code-review`。
- `skills/engineering/README.md` 仍以链接标题和调用说明公开 `[code-review]` 及 `/code-review`。
- 根 `README.md` 仍公开 `[code-review]`、`/code-review`。

已核对的新名出现位置：

- 仅出现在工作树 `code-review/SKILL.md` 的 frontmatter，以及 `ask-matt`、`implement`、`tdd` 三个工作树引用处。
- `git log --all --grep='mattpocock-code-review'` 无提交证据，因此新名没有可追溯的已提交 revision。

## 四项逐项结论

1. **`tdd`：保持 `blocked-unclassified-working-tree`。** 其正文已将 review-stage 引用改为新名，但改动未提交；canonical catalog 仍记录 sourceRevision `9fe7e7a3bb352851b986725bab1c7cfb17610a97` 和该来源下的旧 revision 语义。不能仅凭工作树哈希解锁。
2. **`code-review`：保持 `blocked-unclassified-working-tree`。** frontmatter 名称已改为 `mattpocock-code-review`，但路径、plugin manifest、marketplace、README 仍是旧名，形成公开命名不一致；没有新提交或维护者确认。
3. **`implement`：不把 canonical catalog 的既有 `adapter-candidate` 当作本次改动已解锁。** catalog 当前条目虽为 `adapter-candidate`，但工作树对其调用目标做了未提交修改；在 revision、维护者确认和清单同步齐备前，本次变更审计结论为 blocked。
4. **`ask-matt`：不把 canonical catalog 的既有 `compatibility-selector` 当作本次改动已解锁。** 它是直接路由调用方，已将收尾命令改成新名，但同样处于未提交工作树，且 README/manifest 未完整同步；本次变更审计结论为 blocked。

## 提交、PR、维护者和 manifest 证据

- 当前 `HEAD`、`main`、`origin/main` 均为 `9fe7e7a3bb352851b986725bab1c7cfb17610a97`；这只能证明旧版本已提交，不能证明四处新改动已提交。
- 目标文件最近一次已提交来源为 `b46e15502d9ce2fa839797cb253d509fdd26faef`（提交标题 `sync upstream skills at 6acc160`）；之后没有包含 `mattpocock-code-review` 的 commit。
- 本次只读检查未发现新 PR 编号、合并提交或维护者确认材料；远程引用只有 `main` 相关分支，无法证明工作树改动已被上游接受。
- `.claude-plugin/plugin.json` 和 `.claude-plugin/marketplace.json` 仍列出旧路径/旧 keyword；工程 README 和根 README 也未完成新命名同步。因此 manifest/公开清单不是完整一致状态。

## Canonical catalog 对照

目标仓库 `provenance/CANONICAL-CATALOG.json` 当前记录：

- `implement`：`sourceRevision=9fe7e7a3bb352851b986725bab1c7cfb17610a97`，`status=adapter-candidate`。
- `tdd`：`sourceRevision=9fe7e7a3bb352851b986725bab1c7cfb17610a97`，`status=blocked-unclassified-working-tree`。
- `code-review`：`sourceRevision=9fe7e7a3bb352851b986725bab1c7cfb17610a97`，`status=blocked-unclassified-working-tree`。
- `ask-matt`：`sourceRevision=9fe7e7a3bb352851b986725bab1c7cfb17610a97`，`status=compatibility-selector`。

catalog 路径仍分别使用 `sources/mattpocock-skills/skills/engineering/<旧目录名>/SKILL.md`。本复核没有修改 canonical catalog；只记录其现状，并将四项本次工作树改动统一视为 blocked，等待主 Agent 复验和后续归类。

## 许可证与调用类型风险

- 源仓库 `LICENSE` 为 MIT；目标仓库 `provenance/LICENSE-MAP.json` 记录为 “MIT plus localized/source notices”，并要求 runtime inclusion 保留 notice，且范围限定为 accepted primitives。
- `tdd`、`code-review` 在 catalog 中是 `model-invoked-or-user-invoked`；`implement`、`ask-matt` 是 user-invoked/路由类调用。调用类型本身没有授权绕过来源 revision 或 manifest 一致性门槛。
- 新命名会影响用户调用命令、内部调用链和插件公开名称；在清单未同步时直接投影可能导致 `/code-review`、`/mattpocock-code-review` 的解析差异，也可能与宿主内置命令产生遮蔽/冲突风险。

## 未验证项

- 未进行网络端 GitHub PR 页面或维护者身份确认；本地 Git 元数据没有提供可接受的维护者确认。
- 未运行 `claude plugin validate . --strict`，因为当前目标是只读 provenance 复核，且该 CLI 是否存在不影响已观察到的 manifest 文本不一致。
- 未修改、复制、接入或回滚 Matt 源仓库，也未修改 canonical catalog。
- 未将工作树内容写入目标仓库的 `sources/`；本证据只记录审计事实。

## 下一步与解锁条件

只有在以下证据齐全后，主 Agent 才应重新分类并复验：

1. 将四文件改动提交到可追溯 revision，或取得可核验的维护者确认/PR。
2. 同步并核验 plugin manifest、marketplace、工程 README、根 README 与 frontmatter 的旧名/新名策略，明确是否保留目录旧名、是否公开新命令。
3. 重新计算 source SHA256、复跑关键 Git/SHA 命令，并由主 Agent 复核 catalog 字段 diff。
4. 在许可证 notice 和调用类型边界确认后，再决定是否把对应条目转为 `adapter-candidate`。

在上述条件满足前，状态必须保持 `blocked-unclassified-working-tree`（对本次四项联动改动的审计结论）。
