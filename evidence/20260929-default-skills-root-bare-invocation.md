# 证据：init-target-runtime 裸调用默认包根修复（复活批遗留小批收口）

- 日期：2026-09-29
- 输入 revision：起点 main @ `ad72119`
- owner 授权：owner 对「复活批遗留小批」挂账项令「从第一性原理，你来修」
- 缺陷：工具本体迁移到 skills/event/experience-elevator/tools/ 后，`DEFAULT_SKILLS_ROOT = dirname(SCRIPT_DIR)` 指向经验电梯目录而非包根；用法声明里 `--skills-root` 是可选参（可经 VIBE_CODING_SKILLS_HOME 或默认解析），且本日 VIBE_CODING_SKILLS_HOME 陈旧值已删——三条件叠加后「不带 --skills-root 的裸调用」必被发布布局校验拒绝（Invalid skills root: …experience-elevator）。文档化标准用法不受影响，但工具自述契约（可选参）名存实亡。

## 改动面（3 文件）

| 文件 | 改动 |
|---|---|
| `skills/event/experience-elevator/tools/init-target-runtime.mjs` | DEFAULT_SKILLS_ROOT 改为两段解析：旧布局（脚本上一级含 skills/INDEX.md + tools/init-target-runtime.mjs）优先且行为不变；否则向上 8 层找发布账本标记 provenance/CANONICAL-CATALOG.json 定位真包根；都未命中回退旧行为交 validateSkillsRoot 明确报错（fail-closed 语义不变，标记文件不嵌入块正文） |
| `skills/event/experience-elevator/tools/test-experience-governance-anchor.mjs` | 新增裸调用考题：无 --skills-root、清空 VIBE_CODING_SKILLS_HOME 后对沙箱 --check，断言输出不含 Invalid skills root（先 RED 后 GREEN） |
| `provenance/CANONICAL-CATALOG.json` | 重生成（本体 sha 变更） |

## 验证证据（2026-09-29 实测）

- TDD：新考题先红（FAIL 裸调用…Invalid skills root，21 passed 1 failed）→ 修复后 **anchor 22 passed, 0 failed**；回归 ledger-core 48、closure 65 无损
- `scripts/verify.ps1`：catalog 重生成后 **21/21 all gates passed**
