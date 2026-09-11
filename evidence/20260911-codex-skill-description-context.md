# 证据：Codex 技能描述进入模型决策上下文（复核，并改写首版结论）

- 日期：2026-09-11（首版 21:26 记录，本次 21:4x 复核后改写）
- 对应遗留项：`docs/HANDOFF-NEXT.md` §8 未验证清单 / §9.8「未改变边界」里的
  「`-p` 会话中技能描述是否进入模型决策上下文 —— UNVERIFIED」
- 结论：**VERIFIED（已转绿）**；首版记录中「描述被截断」的判断**被本次复核推翻**

## 1. 方法（可复现）

仓库根执行：

```powershell
codex debug prompt-input '验证技能描述是否进入模型上下文'
```

- 工具版本：`codex-cli 0.154.0`（`codex --version`）
- 该命令渲染的正是会话真实发给模型的 prompt input 列表（含 developer message 里的
  `<skills_instructions>` 段），是宿主行为的直接证据，不依赖模型自述。
- 原始输出留存：`_smoke/codex-prompt-input-20260911.json`（UTF-8，86,635 字节，Python 直接捕获 stdout 写出）
- 派生对账：`_smoke/codex-skill-description-compare-20260911.json`
  （逐条 name / path / 字符数 / sha256 / 比对结果，可直接复查）

两份产物的 sha256（`_smoke/` 按 `.gitignore` 属本机脚手架，不入 git，故此处记录指纹以便复现核对）：

- `codex-prompt-input-20260911.json` = `1bcb5a13173713dd45b626b29eb5775ac1f0fb5331fe07c2ae7ea7e5d6d395a3`
- `codex-skill-description-compare-20260911.json` = `e1a7658bb2975340cf8ef272d8375c682bbda7afd354c150cda4708c03a705ad`

## 2. 结果

### 2.1 条目数

`### Available skills` 段共 **194 条**；其中属于本统一包 **53 条** = 根入口 1
（`feisheng-vibe-coding/SKILL.md`）+ 控制面 1（`governance/sliver-core/SKILL.md`）+ `skills/` 下 51 条，
与 `provenance/CANONICAL-CATALOG.json` 的「52 runtime + 1 控制面」对账一致。

### 2.2 描述完整进入上下文

逐条与宿主机（`F:\skiils工具\_adapters\shared\skills`）上对应 SKILL.md 的 frontmatter `description`
做空白归一后比对：

| 比对口径 | 结果 |
|---|---|
| 原始串逐字比对 | 12/53 全等 |
| 单引号转义（YAML `''` → `'`）归一后 | **53/53 全等，0 处不等** |

差异只来自 YAML 解析规则：源 frontmatter 用单引号字符串，内部单引号写作 `''`，宿主解析后按 `'` 呈现，
语义完全相同（例：`design-brief-builder` 的 `''我想要高级感/简洁/现代''` → `'我想要高级感/简洁/现代'`）。

### 2.3 长描述不被截断

| 技能 | 描述字符数（上下文 / 源文件） |
|---|---|
| `feisheng-vibe-coding`（根入口） | 674 / 676（差 2 = 两处引号转义） |
| `sliver-vibe-coding`（控制面） | 393 / 395 |
| `code-review` | 180 / 180 |

### 2.4 首版结论纠错（重要）

首版记录称「每条 description 约 30–40 字符后被截断，宿主有长度限制」。复核证明**不成立**：

- 首版引用的原始输出 `…\tool-results\Bash_258_164d393f.txt` 实际只有 32,826 字节，JSON 在第 51 行被截断
  （工具结果体量上限），基于残缺输入按行切分才会得到「每条都很短」的假象；
- 本次改为**完整**捕获 stdout（86,635 字节）后做结构化比对，53 条全部对上，0 处不等。

### 2.5 事件三件套也在列表中

`evolution-engine` / `experience-elevator` / `feedback-writer` 均在列表中并带各自 description；
「仅由事件调用」的约束写在其 SKILL.md 正文而不在 description 里，因此仍可能被自然语言提及——
这是已知行为，不是本次发现的缺陷。

## 3. 边界（不做越界声明）

- 已验证：**描述进入模型可见的决策输入**（宿主渲染层面，53/53 逐条比对通过）。
- 未验证（另一件事）：模型是否因此**选中**该技能 —— 该问题由触发行为实测单独覆盖
  （`evidence/20260911-d2-green-t4-and-retirement.md`）。
- 本次验证未修改任何技能内容，也未改动宿主配置。
