---
name: target-constitution-setup
description: 仅当用户先明确调用 `vibe-coding-skills` 总入口并指定 `target-constitution-setup`，或由该总入口按指定路由到本 Skill 时使用；不得根据用户自然语言独立触发。当用户首次接入目标项目、要求生成项目画像 / 宪法设计包，或需要把 AGENTS.md / CLAUDE.md 变成证据绑定的短硬宪法时使用。
user-invocable: false
disable-model-invocation: true
---
[任务]
    为目标项目生成证据绑定的 Agent 宪法设计层：只读扫描项目证据，生成 `docs/项目治理/项目画像.md` 与 `docs/项目治理/宪法设计.md`，更新 `.vibe-docs.json`，再交给 `target-runtime-setup` 写入短硬 `AGENTS.md` / `CLAUDE.md` managed block。

[依赖检测]
    Skill 启动时第一步自动执行。

    必需：
    - 目标项目根目录 → 用户未提供时默认当前工作目录；不存在则停止
    - skills root → 优先用户提供，其次 `VIBE_CODING_SKILLS_HOME`，最后当前本包根目录；必须包含 `skills/INDEX.md` 和 `tools/init-target-runtime.mjs`
    - `tools/check-target-constitution.mjs`
    - `tools/init-target-constitution.mjs`
    - `tools/init-target-runtime.mjs`

    可选：
    - 目标项目 `.vibe-docs.json` → 有则安全合并 `projectProfile`、`constitutionDesign`、`experienceGovernance` 和 `loadPolicy`
    - 目标项目已有 `AGENTS.md` / `CLAUDE.md` / `.vibe-runtime.json` → 只保留用户原文并更新 managed block 与 runtime registry；checksum 冲突时停止
    - `tools/check-target-doc-names.mjs`、`tools/check-target-guardrails.mjs`、`tools/check-lifecycle-doc-budget.mjs` → 写入后用于收口验证

    安装策略：
    - 本 Skill 不安装依赖；缺失必需脚本时停止并说明缺口
    - 可选检查脚本缺失时标记降级，不把未运行的检查说成通过

[本包治理继承]
    执行本 Skill 时必须继承本包主控纪律：
    - 先判定 `execution tier`；本 Skill 涉及 Skill / Tool / runtime 入口规则，默认 T3+ hazard mode
    - 目标项目生命周期文档先读 `.vibe-docs.json`，再按角色映射读写四字中文 `.md`；本 Skill 新生成 `docs/项目治理/项目画像.md` 与 `docs/项目治理/宪法设计.md`
    - 需要用户真实点击、操作或观察时，输出人工验收状态；只有用户明确确认后才能记录为 `用户已确认`
    - 涉及真实 endpoint、service、public entry、server action、fetch wrapper、IPC / event 通道或 schema 时，先读 `.vibe-docs.json.interfaceContracts` 映射的 `接口契约.md`
    - 正式前端页面先识别 UI 包、design tokens、组件盘点、设计复审报告和设计系统复用门禁；本 Skill 不做 UI 实现
    - references 采用 progressive references；当前无额外 references，不默认扫描镜像目录
    - 涉及 `.pen` 或 Pencil 时，必须使用 Pencil desktop 客户端和 desktop MCP server；不得 fallback 到 VS Code

[第一性原则]
    **目标项目上下文加载协议**：已有 `.vibe-docs.json` 时先解析 schema v2、`documentIndex/documents/loadPolicy`，再运行 `node "<skills-root>/tools/resolve-target-doc-context.mjs" "<target-root>" --roles documentIndex,projectProfile,constitutionDesign --json`；只读取返回的 selector。never 默认禁止；仅当用户明确授权旧文档迁移时，才可通过 `--allow-never --reason "<迁移理由>"` 访问，并必须走 `node "<skills-root>/tools/migrate-target-doc-system.mjs" "<target-root>"` 的 dry-run / write 协议。生成后运行 `node "<skills-root>/tools/build-target-doc-index.mjs" "<target-root>" --write` 刷新 `文档索引.md`，再运行名称与 drift 检查；不调用未定义的 package script 别名。

    **首次缺 manifest**：`init-target-constitution.mjs --write` 必须一次性 bootstrap schema v2、required document roles、四字中文生命周期文档和 `文档索引.md`，并在同一次命令稳定画像、设计包、`experienceGovernance` 与 metadata，使紧接着的 `--check` 通过；经验治理真源固定为 `docs/项目治理/经验治理.md`。已有 legacy manifest 不借首次接入静默迁移。
    **已有 v2 adoption**：缺 `experienceGovernance` 时补 canonical `docs/项目治理/经验治理.md`、`documents[]` role 与 L1 registry；已有非 canonical 映射时 fail closed，提示显式迁移，不静默沿用、移动或覆盖旧文件。
    **旧 marker 兼容**：已有受管块的 marker file 只允许等于当前目标项目相对路径，或等于该目标文件自身的旧 basename；后者仅在正文 checksum 可验证时升级为 canonical 相对路径。包含目录但不相等、basename 指向其他职责文件或 checksum 失配时继续停止，不借 adoption 覆盖用户修改。

    **证据绑定**：项目专属规则必须来自真实文件、命令、目录、配置、文档或用户确认；没有证据写 `未验证`。`.agents/.claude/.codex` 运行时目录、嵌套 worktree 与 `build/target` 构建产物不得作为当前项目 owner 证据。
    **短入口长事实**：`AGENTS.md` / `CLAUDE.md` 只写红线、必须动作、停止条件和验收门槛；项目事实放 `项目画像.md`，规则来源放 `宪法设计.md`。
    **经验规则分层**：`docs/项目治理/经验治理.md` 是 L0 唯一计数与状态真源；`宪法设计.md` 中的 `target-experience-registry` 是 L1 规则登记块，必须独立 ownership，不得与主宪法 managed block 混写。
    **安全合并**：不得覆盖用户已有规则；managed block checksum 冲突时停止，不自动覆盖。
    **最小实现**：优先复用现有 `check-target-constitution`、`init-target-constitution` 和 `init-target-runtime`，不把 runtime 写入器改成巨型 workflow。
    **验证门禁**：没有运行 dry-run/write/check 和必要 guardrail，不声明接入完成。

[文件结构]
    ```
    target-constitution-setup/
    ├── SKILL.md
    └── references/
        └── workflow.md
    ```

[按需加载 references]
    不默认全量读取 references；只在当前任务命中下表场景时读取对应文件。

    | Reference | 读取时机 |
    | --- | --- |
    | `references/workflow.md` | 实际执行首次完整接入、需要 dry-run / write / check 命令顺序或收口证据格式时。 |

[宪法接入维度清单]
    必须判断：
    - 目标项目根目录和 skills root 是否有效
    - 目标项目属于新项目 bootstrap 还是已有项目 adoption
    - `.vibe-docs.json` 是否存在，是否需要补 `projectProfile`、`constitutionDesign`、`experienceGovernance`、`loadPolicy`
    - owner map 是否覆盖 product、frontend、backend、schema、auth、config、tests、deploy
    - 验证命令是否来自真实 `package.json.scripts`
    - API、schema、auth、deploy 缺证据时是否保持 `未验证`
    - `AGENTS.md` / `CLAUDE.md` 是否存在 managed block，是否有 checksum conflict

    推荐判断：
    - 已有入口是否包含空泛规则或浅改模板话术
    - 生命周期文档是否通过四字中文命名检查
    - guardrail 是否发现占位符、漂移词或隐私文件

[工作流程]
    [第一步：证据扫描]
        运行 `node "<skills-root>/tools/check-target-constitution.mjs" "<target-root>" --skills-root "<skills-root>" --json`。
        完成条件：输出 evidence、owner map、gaps、findings、projectProfile、clauseMap、stopConditions、validationCommands 和 recommendedManifestPatch。

    [第二步：生成画像与设计包]
        先 dry-run：`node "<skills-root>/tools/init-target-constitution.mjs" "<target-root>" --skills-root "<skills-root>" --dry-run`。
        用户已授权或任务明确要求写入时运行 `--write`。
        完成条件：`项目画像.md`、`宪法设计.md`、`docs/项目治理/经验治理.md` 和 `.vibe-docs.json` 已创建或安全更新；`宪法设计.md` 含独立 `target-experience-registry`；checksum conflict 时停止。

    [第三步：写入短硬 runtime 入口]
        调用 `target-runtime-setup` 或直接运行 `node "<skills-root>/tools/init-target-runtime.mjs" "<target-root>" --skills-root "<skills-root>" --write`。
        完成条件：`AGENTS.md` 与 `CLAUDE.md` managed block 当前有效，`.vibe-runtime.json` 记录当前 version / checksum，并引用 projectProfile 与 constitutionDesign。

    [第四步：收口验证]
        运行 `node "<skills-root>/tools/init-target-constitution.mjs" "<target-root>" --skills-root "<skills-root>" --check`。
        如 `.vibe-docs.json` 存在，先运行 `node "<skills-root>/tools/build-target-doc-index.mjs" "<target-root>" --write`，再运行 `node "<skills-root>/tools/check-target-doc-names.mjs" "<target-root>" --require-existing`。
        如 guardrail 可用，运行 `node "<skills-root>/tools/check-target-guardrails.mjs" "<target-root>" --strict`；warning 失败时按报告修复或标记未验证。
        运行 `node "<skills-root>/tools/check-target-doc-drift.mjs" "<target-root>" --quick --strict` 和 `node "<skills-root>/tools/check-lifecycle-doc-budget.mjs" "<target-root>" --strict`。
        完成条件：验证命令有 fresh 结果，未执行项明确写成未验证。

[输出风格]
    - 先说明写入模式：dry-run / write / check
    - 列出 `项目画像.md`、`宪法设计.md`、`.vibe-docs.json`、`AGENTS.md`、`CLAUDE.md` 的动作：create / append / update / none / conflict
    - 如有 `未验证` owner，直接列出，不包装成已完成能力
    - 人工验收状态默认为 `不适用`；只有目标项目需要用户真实操作确认时才标记 `待用户验收`

[初始化]
    执行 [第一步：证据扫描]。
