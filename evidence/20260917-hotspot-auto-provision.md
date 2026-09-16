# 结构棘轮自动装配（体感闭环）登记（2026-09-17）

## owner 需求（显性/隐性）

显性：只要会话锚定某项目（「调用 feisheng-vibe-coding」或任何指向该项目的动作），
该项目所需运行件自动装配到位，不等开发中发现缺失再手动补。
隐性：承诺→实物的闭环由系统保证而非人肉对账；装配属启动卫生（先于路由/开发），
幂等、不覆盖项目本地适配、装完给新鲜证据；触发面挂在入口技能启动动作上。

## 变更物

1. `skills/product/hotspot-governor/tools/install-hotspot-gate.mjs`（新增，自包含零依赖）：
   - 拷 11 模块进 `<目标>/tools/`（缺则装；与 bundle 一致跳过；**不一致 = 本地适配，跳过不覆盖**）；
   - SCAN_ROOTS 保守适配：仅「约定源码目录名 / 含 src|lib|app 子目录 / 含包清单文件」的
     顶层代码目录自动并入；含代码但非约定布局的目录**只警告不擅入**
     （首版曾把 fs-agent 的 experiments/contracts/fixtures 误写入，已在本批修正语义）；
   - pre-commit 接线：无 hooksPath 则建 `tools/githooks/pre-commit` 并设 `core.hooksPath`，
     追加带标记的自包含棘轮段；判定「已接线」兼容任何形式的 check-hotspots 调用（防重复追加）；
   - 首检基线（默认档，存量超标不阻断装配；扫描器不可读时 fail-closed 退出码 2）；
   - 运行件盘点（AGENTS/.vibe-runtime/vibe-hooks 三项在场性报告，缺省只指路不代装）；
   - 拒绝装回分发包自身；目标必须是 git 仓库。
2. 仓库根 `SKILL.md` 启动动作新增第 2 步（一等自有文件，非快照导入副本）：
   宿主加载即执行「目标项目运行件装配自查」，未装配自动跑安装器；
   明确装配先于路由、不属于路由决策、owner 预授权（2026-09-17）无需逐次请示。
3. 再生 `provenance/CANONICAL-CATALOG.json`、`docs/CAPABILITY-INDEX.md`。

## 新鲜验证

- 合成项目端到端（临时 git 仓库，frontend/src + webapp 布局）：
  11 模块新装；SCAN_ROOTS 自动 +frontend（webapp 落警告未擅入）；
  pre-commit 创建并接线；随后带 340 行文件的真实 `git commit` 被 hook 拦截未落库。
- 幂等：同一项目二次装配 = 新装 0 / 扫描根已覆盖 / pre-commit 跳过。
- fs-agent no-op：新装 0 / 一致 10 / 本地适配保留 1（SCAN_ROOTS 适配版不被回写），
  `git status -- tools/` 装配前后零差异。
- 附带修复：fs-agent `7d7d28e` 补齐 `3a8b13c` 漏提交的 trusted-git.mjs /
  safe-target-fs.mjs（glob 未覆盖致 fresh clone 会 import 失败；本机工作树文件掩盖了问题）。
