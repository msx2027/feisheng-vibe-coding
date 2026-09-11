# 证据：matt 源项目工作树脏文件状态（归档前快照）

- 日期：2026-09-11
- 来源：`F:\skiils工具\mattpocock-skills`（git，远端 `https://github.com/vinvcn/mattpocock-skills-zh-CN`）
- HEAD：`9fe7e7a Merge pull request #30 from vinvcn/fix/openai-display-name-english`
- 处置依据：owner 明确表示这 4 个文件是**本人随意改动**，**不需要保留**（`evidence/20260911-capability-finalization.md` §授权）。

## 脏文件清单（`git status --porcelain`）

```
 M skills/engineering/ask-matt/SKILL.md
 M skills/engineering/code-review/SKILL.md
 M skills/engineering/implement/SKILL.md
 M skills/engineering/tdd/SKILL.md
```

`git diff --stat`：4 files changed, 4 insertions(+), 4 deletions(-)

## 改动实质（如实记录）

四处改动是**同一个主题**：把 `code-review` 改名为 `mattpocock-code-review`，并同步引用点。

| 文件 | 改动 |
|---|---|
| `skills/engineering/code-review/SKILL.md` | frontmatter `name: code-review` → `name: mattpocock-code-review` |
| `skills/engineering/ask-matt/SKILL.md` | 正文两处 `/code-review` → `/mattpocock-code-review` |
| `skills/engineering/implement/SKILL.md` | 正文一处 `/code-review` → `/mattpocock-code-review` |
| `skills/engineering/tdd/SKILL.md` | 正文一处 `code-review` skill 引用 → `mattpocock-code-review` |

## 归档处理

- 归档 zip **包含**工作树当前状态（即含上述 4 个改动），因此 zip 内容 = 删除前磁盘真实状态，不丢字节。
- 统一仓库使用的是 `9fe7e7a` **干净 HEAD 快照**（`sources/mattpocock-skills`，136 文件，`excludedDirtyFiles: 4`），
  与这 4 个改动无关；`provenance/MATT-IMPORT.json` 记录 revision 为 `9fe7e7a3...`。
- 归档 zip：`F:\skiils工具\_archive\mattpocock-skills-20260911.zip`（173 文件，1,046,962 字节，CRC + 逐文件 sha256 全等）。
