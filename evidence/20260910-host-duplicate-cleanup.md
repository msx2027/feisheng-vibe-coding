# 宿主重复注册清理（任务 4，owner 已授权）

日期：2026-09-10
关联任务包：tasks/20260910-host-duplicate-cleanup.md（accepted）
可逆记录：`_smoke/r0-junction-removal.json`（157 条 name → target 映射 + 重建命令）

## 一、清理前的真实性质（先说清，避免误判为"重复存储"）

表面上 `~/.claude/skills`(187) 与 `~/.codex/skills`(158) 有 **157 个同名**，但深入核查发现：

| 检查 | 结果 |
|---|---|
| `~/.codex/skills/<name>` 是真实目录副本吗？ | **不是**。157 个**全部是 NTFS junction（重解析点）** |
| 指向何处 | 全部指向 `F:\skiils工具\_adapters\shared\skills\<name>`——即 `~/.claude/skills` 的**真实位置** |
| 磁盘上有双份内容吗 | **没有**。这是"链接农场"，不存在重复占用 |

（诊断细节：Python `os.path.islink` 对 junction 返回 False、`shutil.rmtree` 直接拒绝——都需要用
`st_file_attributes & FILE_ATTRIBUTE_REPARSE_POINT` 与 `os.readlink`（含 `\?\` 长路径前缀）才能看清。）

## 二、为什么仍然要清理

`~/.claude/skills` 同时是 Codex 的技能根之一（当时的 `r1`），而 `~/.codex/skills` 是 `r0`。
两者解析到**同一批技能目录**，于是 **Codex 把技能列了两遍**——实测：

```text
- sliver-vibe-coding: … (file: r0/sliver-vibe-coding/SKILL.md)
- sliver-vibe-coding: … (file: r1/sliver-vibe-coding/SKILL.md)
```

（注：`sliver-vibe-coding` 之前在 r0 是**真实副本**（smoke 安装产生），所以它确实出现两条；
157 个 junction 因解析到同一真实路径，Codex 会把它们去重计数。）

## 三、处置（含安全闸门）

| 步骤 | 结果 |
|---|---|
| 目标安全校验 | 157/157 的链接父目录都解析到 `r1` 的真实路径；任一越界即中止（第一次跑确实因路径字符串比较中止过，未删任何东西） |
| 删除方式 | `os.rmdir`——Windows 上只移除 junction 本身，**不进入目标** |
| 删除结果 | 157 个 junction 已删；`~/.codex/skills` 仅剩 `.system`（Codex 专属，真实目录） |
| **目标完好性** | 删除前后**逐目录文件数一致**，目标总文件数 **5587 未变** → 证明只删了链接 |

## 四、清理后验证（真实 Codex）

| 指标 | 清理前 | 清理后 |
|---|---|---|
| Available skills 条数 | 203 | **203**（技能未丢） |
| 技能根 | `r0=~/.codex/skills`、`r1=shared`、`r2=.system`… | `r0=shared`、`r1=.system`…（`~/.codex/skills` 因无技能被移出根列表并重新编号） |
| `sliver-vibe-coding` 出现次数 | 2（r0+r1） | **1（r0=shared）** → 重复注册已消除 |

抽查确认技能仍可见（注意 Codex 会给 Matt 技能加命名空间）：
```text
- mattpocock-skills:codebase-design: … (file: r0/codebase-design/SKILL.md)
- mattpocock-skills:domain-modeling: … (file: r0/domain-modeling/SKILL.md)
- mattpocock-skills:diagnosing-bugs: … (file: r0/diagnosing-bugs/SKILL.md)
```

## 五、回滚

`_smoke/r0-junction-removal.json` 保存了每条 `name → target`；重建命令：

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.codex\skills\<name>" -Target "<target>"
```

## 六、未验证 / 边界

- 未动 `~/.claude/skills` 任何内容（它是 r0 现在指向的真实位置）。
- 未动 `.system` 与任何插件缓存。
- `~/.codex/skills` 现在为空壳（仅 `.system`）：若将来 Codex 需要**专属**技能，应放这里。
- 未验证 Codex 侧「技能可被真正调用并按其契约工作」（仍属行为验证范畴）。
