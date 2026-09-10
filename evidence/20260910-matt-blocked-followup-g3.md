# Matt 四项阻塞复核证据（G3）

日期：2026-09-10
目标：G3（P0-B：Matt `tdd`/`code-review`/`implement`/`ask-matt` 上游复核）
方式：只读检查来源仓库 `F:\skiils工具\mattpocock-skills` 与远程 API；未修改来源仓库。

## 结论

**四项维持 `blocked-unclassified-working-tree` / 原状态，未解锁。** 无新上游提交、无开放 PR、无维护者确认；
本地工作树仍存在命名不一致。

## 上游状态（远程 vinvcn/mattpocock-skills-zh-CN，只读 API）

| 项目 | 值 |
|---|---|
| 本地 HEAD | `9fe7e7a3bb352851b986725bab1c7cfb17610a97`（`Merge pull request #30`，2026-08-30） |
| 远程 main 最新 commit | `9fe7e7a3bb352851b986725bab1c7cfb17610a97`（2026-08-30T08:10:17Z）— 与本地一致 |
| 开放 PR | 无（最近 5 个 PR 全部 `closed`，最高编号 #30） |
| 结论 | 无新提交、无待合并 PR、无维护者确认 |

## 本地工作树脏状态（未提交，4 个文件）

| 文件 | 变更 | 与 manifest 一致性 |
|---|---|---|
| `skills/engineering/code-review/SKILL.md` | frontmatter `name: code-review` → `mattpocock-code-review` | ❌ `.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` 仍为 `code-review` |
| `skills/engineering/ask-matt/SKILL.md` | 正文引用 `/code-review` → `/mattpocock-code-review` | ❌ 引用已改，manifest 未改 |
| `skills/engineering/implement/SKILL.md` | 正文引用 `/code-review` → `/mattpocock-code-review` | ❌ 同上 |
| `skills/engineering/tdd/SKILL.md` | 正文引用 `code-review` skill → `mattpocock-code-review` skill | ❌ 同上 |

即：重命名只改了一半（技能正文），插件 manifest / marketplace 未同步，工作树内部不一致。

## 处理

- 保持 `code-review`、`tdd` 为 `blocked-unclassified-working-tree`（catalog 未改）。
- `implement`、`ask-matt` 不因工作树内容解锁或改写（catalog 未改）。
- 未修改来源仓库；未把这 4 个工作树版本复制进目标仓库。

## 解除条件（满足其一再复评）

1. 上游（维护者）提交并合入命名统一（frontmatter + plugin manifest + marketplace + README 一致）；或
2. 上游回退该工作树改动；或
3. 维护者明确确认命名变更及其发布含义。

## 未验证项

- 未检查上游是否存在相关 open issue（仅查 PR）；如需要可后续补查。
- 未联网核对 zh-CN fork 与原始 upstream 的同步差异（超出本目标）。
