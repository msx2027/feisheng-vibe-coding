#!/usr/bin/env node
// DocMap:
// Layer: L3 / constitution rule registry (rule-harvester 第二步降级机制的地基)
// Module: tools
// Depends on: tools/init-target-runtime.mjs (getConstitutionBody)
// Syncs with: tools/check-constitution-rules.mjs, skills/rule-harvester/SKILL.md
//
// 作用（大白话）：给写死在 Agent 宪法里的每条规则发一张"身份证"。
// 宪法正文本身是一整块纯文本、受 checksum 保护、一个字都不能乱改；
// 所以这里用"旁挂登记表"的方式，不碰正文，只为每条规则登记：
//   - id：稳定身份证（用规则名，正文里已保证全项目唯一）
//   - group：它属于哪个分组
//   - tier：护栏档位，决定它能不能进"退役候选池"
//     · protected  = 生死线/安全/基础设施类，永不退役，碰都不碰
//     · background = 呼吸级根本纪律（如沟通习惯），AI 无感遵守、几乎不会主动报账，
//                    单独归类、不参与冷热排名，防止被系统性少报而误杀
//     · candidate  = 功能性/情境性规则，某些项目用得上某些用不上，才适合按冷热淘汰
//
// 这张表和真实宪法正文必须一一对应，由 check-constitution-rules.mjs 双向校验锁死：
// 正文加/删/改名了规则、表没同步，校验就报漂移、非零退出。

// 护栏档位常量
export const RULE_TIERS = Object.freeze({
  PROTECTED: "protected",
  BACKGROUND: "background",
  CANDIDATE: "candidate",
});

// 登记表：每条 { id, group, tier }
// id 必须与宪法正文中 `- <名称>：` 的 <名称> 完全一致（含空格），大小写敏感。
// 维护规则：改 init-target-runtime.mjs 的宪法正文（增/删/改名规则）后，必须同步改本表，
// 否则 check-constitution-rules.mjs 会 FAIL。本表不得手动改正文，只登记。
export const CONSTITUTION_RULES = Object.freeze([
  // —— 头部基础设施：运行时如何找真源，删了整套跑不起来 → protected ——
  { id: "运行时", group: "基础设施", tier: "protected" },
  { id: "Skills 包位置", group: "基础设施", tier: "protected" },
  { id: "真源入口", group: "基础设施", tier: "protected" },
  { id: "项目画像", group: "基础设施", tier: "protected" },
  { id: "宪法设计", group: "基础设施", tier: "protected" },
  { id: "文件落位", group: "基础设施", tier: "protected" },

  // —— 通用思维与沟通习惯：呼吸级，无感遵守、几乎不会被报账 → background ——
  { id: "大白话回复", group: "通用思维与沟通习惯", tier: "background" },
  { id: "体感对比", group: "通用思维与沟通习惯", tier: "background" },
  { id: "输出精简", group: "通用思维与沟通习惯", tier: "background" },
  { id: "第一性原理", group: "通用思维与沟通习惯", tier: "background" },
  { id: "动机澄清", group: "通用思维与沟通习惯", tier: "background" },
  { id: "根因优先", group: "通用思维与沟通习惯", tier: "background" },
  { id: "最短路径", group: "通用思维与沟通习惯", tier: "background" },
  { id: "AI 产出归人掌控", group: "通用思维与沟通习惯", tier: "background" },

  // —— 工程生死线：删了要命 → protected ——
  { id: "证据纪律", group: "工程生死线", tier: "protected" },
  { id: "验收纪律", group: "工程生死线", tier: "protected" },
  { id: "禁止编造", group: "工程生死线", tier: "protected" },
  { id: "严格 TDD", group: "工程生死线", tier: "protected" },
  { id: "TDD 例外", group: "工程生死线", tier: "protected" },
  { id: "最小实现", group: "工程生死线", tier: "protected" },
  { id: "Git 提交语言", group: "工程生死线", tier: "protected" },
  { id: "高风险停止", group: "工程生死线", tier: "protected" },
  { id: "用户内容保护", group: "工程生死线", tier: "protected" },
  { id: "Git worktree 身份核对与单任务单工区", group: "工程生死线", tier: "protected" },
  { id: "临时产物、验证副本和 Git 基线保护", group: "工程生死线", tier: "protected" },

  // —— 严格 TDD 的 T1 受控例外：安全相关，属生死线延伸 → protected ——
  { id: "visual-only T1 受控例外", group: "严格 TDD 的 T1 受控例外", tier: "protected" },

  // —— 分层审查与收口：质量安全底线 → protected ——
  { id: "审查分层", group: "分层审查与收口", tier: "protected" },
  { id: "双阶段审查", group: "分层审查与收口", tier: "protected" },
  { id: "独立 Reviewer", group: "分层审查与收口", tier: "protected" },
  { id: "完成证据", group: "分层审查与收口", tier: "protected" },
  { id: "Finding 闭环", group: "分层审查与收口", tier: "protected" },
  { id: "Phase 收口", group: "分层审查与收口", tier: "protected" },

  // —— 文档真源与 Markdown 治理：自动同步是基础保护，其余规则按项目治理能力启用 ——
  { id: "受管文档自动同步", group: "文档真源与 Markdown 治理", tier: "protected" },
  { id: "文档索引", group: "文档真源与 Markdown 治理", tier: "candidate" },
  { id: "Markdown 分卷命名", group: "文档真源与 Markdown 治理", tier: "candidate" },
  { id: "Markdown 专属文件夹", group: "文档真源与 Markdown 治理", tier: "candidate" },
  { id: "Markdown 自动治理", group: "文档真源与 Markdown 治理", tier: "candidate" },
  { id: "Markdown 链接与备份", group: "文档真源与 Markdown 治理", tier: "candidate" },

  // —— 加载策略与任务续接：快车道优先是高频核心，其余情境性 ——
  { id: "小任务快车道优先", group: "加载策略与任务续接", tier: "protected" },
  { id: "非快车道任务", group: "加载策略与任务续接", tier: "candidate" },
  { id: "加载策略硬边界", group: "加载策略与任务续接", tier: "candidate" },
  { id: "继续任务探针", group: "加载策略与任务续接", tier: "candidate" },

  // —— 任务上下文：默认 disabled，纯情境性 → candidate ——
  { id: "任务胶囊", group: "任务上下文", tier: "candidate" },
  { id: "会话记录", group: "任务上下文", tier: "candidate" },
  { id: "经验治理受控例外", group: "任务上下文", tier: "candidate" },

  // —— 结构与耦合门禁：情境性（无热点的项目用不到） → candidate ——
  { id: "结构阈值真源", group: "结构与耦合门禁", tier: "candidate" },
  { id: "阈值例外", group: "结构与耦合门禁", tier: "candidate" },
  { id: "耦合边界", group: "结构与耦合门禁", tier: "candidate" },
  { id: "循环依赖", group: "结构与耦合门禁", tier: "candidate" },
  { id: "认知复杂度", group: "结构与耦合门禁", tier: "candidate" },
  { id: "存量热点", group: "结构与耦合门禁", tier: "candidate" },

  // —— 接口契约与 UI 复用：情境性（纯后端或纯 UI 项目各用一半） → candidate ——
  { id: "UI 精修不夹带", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "网络入口先查契约", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "接口唯一真源", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "先契约后代码", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "改接口先查调用方", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "接口状态流转", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "UI 复用", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "扩展优先", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "统一网络客户端", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "接口错误结构统一", group: "接口契约与 UI 复用", tier: "candidate" },
  { id: "待生效条款自助激活", group: "接口契约与 UI 复用", tier: "candidate" },

  // —— 发布与合规门禁：情境性（不发布/不收费的项目用不到） → candidate ——
  { id: "开源许可证合规", group: "发布与合规门禁", tier: "candidate" },
  { id: "桌面代码签名", group: "发布与合规门禁", tier: "candidate" },
  { id: "打包链路按真实技术栈", group: "发布与合规门禁", tier: "candidate" },
  { id: "依赖漏洞扫描按语言齐全", group: "发布与合规门禁", tier: "candidate" },
  { id: "自动更新与远程代码验签", group: "发布与合规门禁", tier: "candidate" },
  { id: "本地数据迁移必须可回滚", group: "发布与合规门禁", tier: "candidate" },

  // —— runtime 版本与入口保护：基础设施，删了 checksum/刷新失灵 → protected ——
  { id: "runtime 版本追踪", group: "runtime 版本与入口保护", tier: "protected" },
  { id: "目标项目 runtime 入口保护", group: "runtime 版本与入口保护", tier: "protected" },
  { id: "刷新本块", group: "runtime 版本与入口保护", tier: "protected" },
]);

// 从宪法正文里按行提取每条规则的 id（与正文的唯一真源提取口径一致）。
// 口径：匹配形如 "`- <名称>：..." 的行，取反引号后 "- " 与第一个全角冒号"："之间的名称。
export function extractRuleIdsFromBody(body) {
  const ids = [];
  for (const line of String(body).split("\n")) {
    // 渲染后的正文里，每条规则是行首 "- <名称>：..."（反引号只是源码里的 JS 字符串定界符，不在正文中）。
    const match = line.match(/^- ([^：]+?)：/u);
    if (match) ids.push(match[1]);
  }
  return ids;
}

// 双向校验：登记表 vs 正文实际规则。返回 { ok, missingInRegistry, missingInBody, duplicateIds }。
// - missingInRegistry：正文里有、登记表没登记的规则（新增规则忘了登记）
// - missingInBody：登记表登记了、正文里已不存在的规则（规则被删/改名，表没同步）
// - duplicateIds：登记表内部 id 重复
export function auditRegistryAgainstBody(body) {
  const bodyIds = extractRuleIdsFromBody(body);
  const bodySet = new Set(bodyIds);

  const registryIds = CONSTITUTION_RULES.map((rule) => rule.id);
  const registrySet = new Set();
  const duplicateIds = [];
  for (const id of registryIds) {
    if (registrySet.has(id)) duplicateIds.push(id);
    registrySet.add(id);
  }

  const missingInRegistry = bodyIds.filter((id) => !registrySet.has(id));
  const missingInBody = registryIds.filter((id) => !bodySet.has(id));

  return {
    ok: missingInRegistry.length === 0 && missingInBody.length === 0 && duplicateIds.length === 0,
    bodyCount: bodyIds.length,
    registryCount: registryIds.length,
    missingInRegistry,
    missingInBody,
    duplicateIds,
  };
}

// 取可进入"退役候选池"的规则 id 集合：只含 candidate 档。
// protected（生死线/安全/基础设施）与 background（呼吸级纪律）都被这一层护栏挡在池外，
// 无论冷热都不会被列为退役候选。这是三层护栏里的第一层。
export function candidateRuleIds() {
  return CONSTITUTION_RULES.filter((rule) => rule.tier === RULE_TIERS.CANDIDATE).map((rule) => rule.id);
}

export function ruleById(id) {
  return CONSTITUTION_RULES.find((rule) => rule.id === id) || null;
}
