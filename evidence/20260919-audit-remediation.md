# 证据：独立审计整改三处（2026-09-19）

- 触发：对 main @ 81facfc（受审范围 c4fe1b2..507e4fc + docs-only 81facfc）的独立验收审计（第三方审计员，与实施方无关）出具「有保留通过」，附三条非阻塞改进建议；owner 指示落地。
- 基线：origin/main @ `81facfc`；全部改动在临时克隆完成，正本零写入。
- 独立对抗复核：另一子代理审计员按 A–H 清单复核，结论**通过**（无阻塞），记录见 §4。

## 1. 改动（4 文件 + 本证据）

| # | 文件 | 改动 | 对应审计建议 |
|---|---|---|---|
| 1 | `skills/product/hotspot-governor/tools/guardrail-addon.mjs` | `uninstallGuardrails` 不再整目录 `rmSync tools/guardrails/`，改为按新常量 `GUARDRAIL_DIR_FILES`（secret-scan.mjs / gitleaks.toml / semgrep-ci.yml.disabled / secret-baseline.json）**点名删除**；目录变空才整体移除，用户自有文件与目录保留；头注与 `readdirSync` import 同步 | 审计建议 1：卸载误删本地适配/用户自有文件 |
| 2 | `skills/product/hotspot-governor/tools/secret-scan.mjs` | `FALLBACK-AWS-KEY` 正则 `((?:AKIA\|ASIA)[0-9A-Z]{16})` → `(?:A3T[A-Z0-9]\|AKIA\|ASIA\|ABIA\|ACCA)[A-Z2-7]{16}`，对齐 gitleaks v8.30.1 官方 `aws-access-token` 规则（官方 raw config 逐字核对） | 审计建议 2：兜底字母表比官方宽，对官方放行形态误报、耗降级预算 |
| 3 | `scripts/build-canonical-catalog.ps1` | `generatedAt` 优先读环境变量 `CATALOG_GENERATED_AT`（ISO-8601 防呆校验，非法值 throw），缺省行为不变——比对/审计场景可再生 diff 严格为零 | 审计建议 3：「零差异」命题此前差一个时间戳行 |
| 4 | `provenance/CANONICAL-CATALOG.json` | 再生产物（时间戳钉住再生，仅 2 个工具文件 sha256 更新）；`docs/CAPABILITY-INDEX.md` 不跟踪哈希、零变化 | 再生义务 |

## 2. 行为实测（临时目录真实 git 仓库）

- 加购三态 + 用户文件保留：`--guardrails-only` 装 4 文件 → 放用户自有文件 + 改 secret-scan.mjs（重跑安装报「本地适配保留 1」）→ `--uninstall`：加购 4 文件点名移除、用户自有文件与目录保留、钩子段摘除（shebang 保留）→ 二次卸载幂等 exit 0。
- 默认全装回归：11 个 hotspot 模块 + 棘轮段 + `core.hooksPath` 卸载后原样保留，`tools/guardrails/` 变空即消失。
- 正则行为：AKIA+[A-Z2-7]{16} 命中；含 0/1/8/9 的 16 位（官方放行形态）不再命中（旧正则命中，行为差异实证）；A3T/ABIA/ACCA 变体命中；`node --check` 语法通过。
- 时间戳固定：以已提交值设 `CATALOG_GENERATED_AT` 再生 → diff 零 generatedAt 行、逐字节可复现；`not-a-date` → throw 防呆生效。

## 3. 门禁（整改后全绿）

- `pwsh tests/test-vibe-hook-adapter.ps1` → PASS exit 0；Windows PowerShell 5.1 同套件 → PASS exit 0。
- `verify.ps1 -IncludePackage` → **17/17 steps passed**（含 catalog 同步、runtime include 436、副本一致性、结构不变量 50）。
- 工作树终态恰好 4 个 M + 本证据，无其他写入。

## 4. 独立对抗复核（子代理审计员，与实施方无关）

按 A–H 十项清单复核：diff 一致性 / 卸载清单完备性（对照全部写入路径，无遗漏）/ 卸载边界实测 / 默认路径回归 / 正则行为（含与官方规则逐字比对）/ 时间戳固定与恢复 / 三套门禁亲手重跑 / 反向思考——**全部 PASS，结论「通过」，无阻塞问题**。

复核留下两条非阻塞建议，处置：
1. 卸载对「本地适配过的同名文件被删」无逐个点名提示——**遗留未做**（需给 uninstall 传 bundle 路径，改动面大；现行语义已在头注与代码注释言明：卸载即移除整个加购能力，同名文件属供给边界内）。
2. 假设性边界：清单未来若加入目录条目，`rmSync`（无 recursive）会抛错——当前 4 文件清单不受影响，幂等重跑可兜底。

## 5. 已知边界（如实记录）

- 本地适配过的 `secret-scan.mjs` 会随卸载移除（能力整体移除语义，非缺陷；安装侧仍保护、卸载侧移除，两侧语义各自自洽）。
- `CATALOG_GENERATED_AT` 校验只查 ISO-8601 前缀形态（`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}`），不查时区后缀合法性——时间戳仅作展示与钉值用途，不参与排序逻辑。
