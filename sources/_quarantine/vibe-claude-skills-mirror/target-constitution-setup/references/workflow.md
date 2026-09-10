# target-constitution-setup workflow

> 读取时机：实际执行目标项目首次完整接入，或需要输出 dry-run / write / check 证据时。

## 命令顺序

1. 只读审计：
   `node "<skills-root>/tools/check-target-constitution.mjs" "<target-root>" --skills-root "<skills-root>" --json`
2. 宪法生成预览：
   `node "<skills-root>/tools/init-target-constitution.mjs" "<target-root>" --skills-root "<skills-root>" --dry-run`
3. 用户已授权或任务明确要求写入时：
   `node "<skills-root>/tools/init-target-constitution.mjs" "<target-root>" --skills-root "<skills-root>" --write`
4. 写入 runtime 入口：
   `node "<skills-root>/tools/init-target-runtime.mjs" "<target-root>" --skills-root "<skills-root>" --write`
5. 收口检查：
   `node "<skills-root>/tools/init-target-constitution.mjs" "<target-root>" --skills-root "<skills-root>" --check`
   `node "<skills-root>/tools/init-target-runtime.mjs" "<target-root>" --skills-root "<skills-root>" --check`
   `node "<skills-root>/tools/check-target-doc-names.mjs" "<target-root>" --require-existing`
   `node "<skills-root>/tools/check-target-guardrails.mjs" "<target-root>" --strict`

## 通过标准

- `.vibe-docs.json.projectProfile` 等于 `项目画像.md`。
- `.vibe-docs.json.constitutionDesign` 等于 `宪法设计.md`。
- 首次缺少 `.vibe-docs.json` 时，写入结果为 schema v2，`documents[]` 覆盖 8 个必需角色，`documentIndex` 为 `文档索引.md`，且 write 后立即 check 通过。
- `项目画像.md` 和 `宪法设计.md` 存在，且 generated block checksum 当前有效。
- `AGENTS.md` 和 `CLAUDE.md` 的 runtime managed block 当前有效。
- 缺失 API、schema、auth、deploy 证据时，文档中保持 `未验证`。
- 如果 checksum conflict、JSON 解析失败、目标路径无效或 skills root 无效，停止并报告 blocker。
