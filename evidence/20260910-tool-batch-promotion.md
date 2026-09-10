# 逐技能宿主证据采集 + 成批提升尝试（被门禁拦下，结论已固化为结构性前提）

日期：2026-09-10
关联任务包：tasks/20260910-tool-batch-promotion.md（accepted）
新增脚本：`scripts/collect-host-skill-evidence.ps1`
新增台账：`provenance/HOST-DISCOVERY-EVIDENCE.json`

## 一、逐技能宿主证据（真实证据，已完成）

**方法**：`codex debug prompt-input` 一次调用输出**模型可见输入**，其中 `### Available skills` 列出模型可调用的技能
（`name: description (file: rN/path)`）并给出技能根表；配合宿主技能目录存在性判定"是否已安装"。

**关键实测发现**：**frontmatter 里 `disable-model-invocation: true` 的技能不会出现在该清单里**——
这是设计使然，不是"未被发现"。因此证据必须分类，不能一律按清单命中判定。台账按四类记录：

| 证据类别 | 数量 | 明细 |
|---|---|---|
| **model-visible**（模型可见清单命中） | **62** | **Vibe 全部 46** + Matt 15 + Sliver 1 |
| **installed-user-invoked-only**（已安装、按设计不在模型清单） | **14** | 全部为 Matt（adapters / user-tools） |
| **not-installed** | **6** | 全部为 Matt `in-progress`（我们的 catalog 亦标为 `excluded`） |
| other / unknown | 0 | |

→ **结论：82 个技能中，除 6 个按设计排除者外，其余 76 个都有宿主侧证据。**

## 二、成批提升尝试：三个门禁同时拒绝（拒绝得正确）

据此把审计中明确记为「只读 checker / 文档输出工具」的 13 个 Vibe 技能（writeAuthority=`none`，
许可证族已映射，宿主证据 model-visible）提升为 `accepted`，并把 LICENSE-MAP 的 Vibe 条目
`runtimeEligible` 翻为 true。结果 `verify.ps1` **4/8**：

| 门禁 | 拒绝理由 |
|---|---|
| 投影门禁（Codex/Claude 两侧） | `projection 包含被拒绝的 … 路径 (sources)`——Vibe 技能的 catalog 路径是 `sources/vibe-coding-skills/skills/<id>/SKILL.md`，而投影**明令禁止把 `sources` 段带进运行时 bundle** |
| 发布 NOTICE 门禁 | `LICENSE-MAP 的 Vibe 条目必须保持 runtimeEligible=false 直到逐技能许可证完整`——门禁对该不变量是**硬编码**的 |
| 发布包装配 | 同上（复用 NOTICE 门禁） |

## 三、这次失败暴露的结构性前提（本轮最有价值的产出）

对比**已被接受的 Matt 原语**：它们的 catalog 路径是 `skills/engineering/<id>/SKILL.md`——
也就是说 **「接受」在本仓库里意味着内容被物理导入到 `sources/` 之外的一等位置**。

而我这次只翻了分类标签、没有做物理导入 → 投影仍指向 `sources/…` → 被门禁如实拦截。

**因此提升（readiness=accepted）的完整前提是：**

1. **物理导入**：把技能目录从 `sources/vibe-coding-skills/skills/<id>/` 复制到一等位置
   （如 `skills/product/<id>/`、`skills/checker/<id>/`），并登记派生来源（源路径 + 源 SHA）。
2. **生成器路径规则**：`build-canonical-catalog.ps1` 对 `readiness=accepted` 的 Vibe 记录改用导入后路径
   （与 Matt 原语同一模式）。
3. **NOTICE 门禁策略化**：把硬编码的「Vibe 必须 runtimeEligible=false」改成**读策略**
   （逐技能台账完整 + 该技能的许可证族可映射 → 允许），必须与物理导入**同批**完成，不能先翻 flag。
4. 之后才谈 readiness 提升；每批仍要跑全套门禁。

## 四、处置：回退到绿色并保留结论

- 13 个技能已回退 `source-only`；LICENSE-MAP 的 Vibe 条目回退 `runtimeEligible=false`
  （`reason` 明确写出"逐技能审查已完成，但需与物理导入 + 门禁策略化同批解锁"）。
- `SKILL-CLASSIFICATION.json` 新增 `runtimePromotionPolicy`（准入条件 + 上述 `structuralPrerequisite`），
  把这次学到的前提写进**真源**而不是只写在文档里。
- 回退后 `verify.ps1 -IncludePackage` **8/8 通过**，runtime-eligible 回到 4。

## 五、边界与未验证

- 宿主证据只证明**发现性**（技能被宿主识别），**不证明行为正确性**。
- `HOST-DISCOVERY-EVIDENCE.json` 是一次采集快照；宿主环境变化后需重跑 `collect-host-skill-evidence.ps1`。
- 采集器依赖 `codex debug prompt-input` 的输出格式；格式变化会导致解析为 0 条（脚本会报错而非静默通过）。
- 提升为 runtime 的**唯一**未完成环节已定位为上述 4 步结构改造，与行为证据无关。
