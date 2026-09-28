# skills INDEX

> 本包 `skills/` 的导航索引（2026-09-29 补装：工具迁移到 `skills/event/experience-elevator/tools/`
> 后，发布布局校验（`validateSkillsRoot` 要求 `skills/INDEX.md`＋`tools/init-target-runtime.mjs`）
> 与宪法块刷新指令承诺的入口路径失去实物对应，本文件与根 `tools/init-target-runtime.mjs`
> 启动器即补装件——不削弱任何 fail-closed 校验，只把丢失的包基础设施恢复为真。

## 域与技能清单（按目录实况）

- `checker/`（5）：audit · clarify · critique · harden · optimize
- `engineering/`（13）：code-review · codebase-design · diagnosing-bugs · domain-modeling · grilling · handoff · prototype · research · resolving-merge-conflicts · setup-pre-commit · tdd · wizard · writing-for-agents
- `event/`（3）：evolution-engine · experience-elevator · feedback-writer
- `product/`（14）：architecture-foundation · bug-fixer · design-brief-builder · design-maker · dev-builder · dev-planner · doc-sync-guardian · hotspot-governor · product-spec-builder · release-builder · requirements-test-designer · rule-harvester · test-automation · ui-system-guardian
- `ui/`（16）：adapt · animate · bolder · brand · colorize · delight · design-system · distill · impeccable · layout · overdrive · polish · quieter · typeset · ui-styling · ui-ux-pro-max

## 运行时工具入口

- 宪法块刷新：`node tools/init-target-runtime.mjs <target-root> --skills-root <本包根> --write|--check|--upgrade`
  （根 `tools/init-target-runtime.mjs` 为启动器，本体在 `skills/event/experience-elevator/tools/`）
- 经验治理核心与编排器：`skills/event/experience-elevator/tools/`（experience-ledger-core · experience-governance · init-target-runtime 等，测试同目录 `test-*.mjs`）
