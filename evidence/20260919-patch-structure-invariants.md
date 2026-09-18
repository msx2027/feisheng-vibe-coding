# 证据：已登记补丁结构不变量门禁（1c-3）

- 日期：2026-09-19
- 触发：owner 对标 mattpocock-skills-zh-CN 后裁决「只做第 1 项」——把社区版 translate-skill 的补丁结构纪律吸收为本仓库门禁
- 关联真源：`scripts/provenance-integrity.ps1`（单一实现）、`scripts/verify.ps1`（步骤 1c-3）、`provenance/LOCAL-PATCHES.json`（note 同步）

## 1. 问题（为什么哈希门禁不够）

LOCAL-PATCHES 的哈希对账只证明「登记内容 == 文件内容」，**不证明「补丁没有顺手破坏结构」**：
哈希是事后从真实文件算的，改坏了也会被如实登记。三类真实手滑在 1c/1c-2 下全绿：
① 删/多半个 ``` 围栏（其后全部内容渲染错位）；② frontmatter 键丢失/新增（改变技能加载与门控行为——
本仓库历史上真实发生过 frontmatter YAML 损坏，见 `sliver-template-frontmatter-quoted` 登记）；
③ 既有路径 token 被加料改写（如 `tools/check-api-contracts.mjs` 被顺手写成 `tools/check-api-contracts（接口契约）.mjs`）。

## 2. 设计（低误报，只拦手滑不拦合法补丁）

三条不变量，对每个 runtime-import 登记项比对「来源快照原文 vs 补丁后副本」：

| # | 不变量 | 判定 | 有意不拦 |
|---|---|---|---|
| ① | 围栏奇偶 | 原文与副本 ``` 行数奇偶一致（嵌套围栏两侧同构，比奇偶不受影响） | 合法增删整个代码块（+2/-2 奇偶不变） |
| ② | frontmatter | 有无一致；键集 Ordinal 相等（值允许变） | 值修改（如门控短语改写，既有登记先例） |
| ③ | 路径 token | 补丁后 token 的「骨架」（剥掉非 `[A-Za-z0-9/._-]`）命中原文骨架但原文不同 → 拦 | 新增合法引用、删除既有引用、正文改写 |

实现要点：补丁侧 token 必须先算骨架再比对，不能先过 ASCII 门禁——带中文加料的 token 本身过不了门禁，
先过滤会把恰要抓的对象放走（阴性测试第一轮实测踩中并修正）。

覆盖边界：只覆盖 runtime-import 命名空间（vibe 46 + matt 2 = 48 项）；sliver-core 命名空间原文不在
本仓库（只有哈希），无法做内容级比对。原文/副本缺失一律失败（fail-closed）。

## 3. 验证

- **阴性测试**（合成 4 补丁对，临时仓库）：围栏破坏 / 键集丢失 / 路径加料三例全拦，合法正文补丁放行，
  `checked=4, ok=False`，错误消息逐条对应不变量；
- **阳性全量**：真实仓库 `verify.ps1` **16/16 通过**，新步骤 `已登记补丁结构不变量 — patches = 48` 全绿
  （含 2026-09-18 anti-bloat 批次的 8 个补丁文件）。

## 4. 边界声明

本门禁是**结构安全网**，不是语义审查：不判断补丁内容是否合理（那归 review 与 owner 裁决），
只保证文本补丁不会在哈希合法的外衣下破坏 Markdown/frontmatter/路径结构。
