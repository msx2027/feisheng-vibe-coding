# F1 第二批：删除 VIBE_CODING_SKILLS_HOME——环境变量退出包根解析链（受管块 v23）

日期：2026-09-29 · 批次：E2E F1 设计修复（owner 看过第一性原理分析后拍板「同意」）· 性质：**行为变更**（解析优先序），非放宽——删除一个不可信信源

## 决策依据（第一性原理）

工具定位包根的三个信源，可靠性：**脚本自身位置**（代码不可能对自己撒谎，搬家/改名/换机免疫）> **显式 --skills-root**（人当下亲口指令）> **环境变量**（他人张贴、过时不可见、进程/注册表两份会打架）。实测 F1 证明环境变量是唯一会咬人的信源：注册表已清而长寿命宿主进程内存残留，裸调用被阻断。环境变量的正当用途（临时指向其他副本）`--skills-root` 完全覆盖且更明确——**留两套指路系统就是留两个坑，故整体删除而非降级**。

## 变更内容

`skills/event/experience-elevator/tools/init-target-runtime.mjs`：

- `resolveRoots`：解析链 `args > env > 默认根` → `args > 默认根（本包自证）`；VIBE_CODING_SKILLS_HOME 整体退出，无任何回退路径。
- `validateSkillsRoot`：来源归因保留（`--skills-root 参数` / `默认根（本包自证）`），env 专属提示删除（env 不再是可能来源）。
- `renderBody`：受管块「Skills 包位置」句改为「由本包根目录自证（工具自动定位，环境变量不参与）；如需临时指向其他副本，用 --skills-root 显式指定」。
- `TARGET_RUNTIME_BLOCK_VERSION` 22 → **23**：所有存量块下次 --check 报待刷新、--upgrade 换新（版本机制原生支持，无额外迁移代码）。

## TDD 与回归（全新鲜证据）

- RED：anchor 考题反转为「陈旧 VIBE_CODING_SKILLS_HOME 必须被无视——裸调用照常解析到真包根」（陈旧 env 在场：退出码≠2、输出无 Invalid skills root、不引用陈旧路径）。改实现前红。
- GREEN：anchor **23/23**；ledger-core **48/48**；closure **65/65**。
- 实弹（陈旧 env 在场，目标项目 sess-find）：`--check` 显示 `Skills root: F:\skiils\feisheng-vibe-coding`（真包根自证成功，不再看字条）→ 正确报 `version 22 -> 23` 待刷新 → `--upgrade` 三块换新 → `--check` 全 PASS；块内新文案就位、`VIBE_CODING_SKILLS_HOME` 出现次数为 **0**。
- catalog 重生成（82 records）；`verify.ps1` **21/21**。

## 部署注意

- 已装配受管块的项目（fs-agent、sess-find 等）在**下次会话跑刷新或 --check 时会提示 v22 待升级**，--upgrade/--write 幂等换新，属预期动作，不是漂移。
- 长寿命宿主进程里的 env 残留从此**无害**（无人在解析链里读它）；彻底清掉复印件仍以重启宿主为准。
- 第一批（53badd7，报错来源提示）的 validateSkillsRoot 归因结构保留，env 分支由本批移除。
