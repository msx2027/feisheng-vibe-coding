# 经验治理 ledger v2 与升退役细则

## L0 ledger v2

`.vibe-docs.json.experienceGovernance` 指向 `docs/项目治理/经验治理.md`。顶部机器真源：

```json
{
  "vibeExperienceLedger": "v2",
  "revision": 4,
  "l1RegistryAnchor": null,
  "thresholds": { "L0": 3, "L1": 5, "L2": 8 },
  "processedEvents": [
    {
      "eventId": "EVT-0123456789abcdef01234567",
      "signalType": "explicit-correction",
      "scope": "target-project",
      "promptHash": "sha256:<64 hex>",
      "occurredAt": "2026-07-23T09:59:00.000Z",
      "experienceId": "EXP-001"
    }
  ],
  "consumedConfirmations": [],
  "experiences": [],
  "archived": []
}
```

- eventId 重放返回原状态，不重复计数、不推进 revision。
- 相同 eventId 只有 payload 与 experienceId 完全一致才算 replay；否则报 collision。缺稳定 occurrence identity 不生成可计数事件。
- 新 ID 扫描 experiences + archived；tombstone ID 永不复用。
- 原始 prompt 不落项目文件。

## 用户确认凭据

```json
{
  "receiptId": "CONF-20260723-001",
  "eventId": "EVT-0123456789abcdef01234567",
  "experienceId": "EXP-001",
  "scope": "target-project",
  "action": "elevate",
  "tier": "L0",
  "confirmedAt": "2026-07-23T10:00:00.000Z",
  "confirmationHash": "sha256:<64 hex>"
}
```

action 使用 `elevate` 或 `retire`；scope 必须是 target-project，eventId 必须已登记且绑定同一 experienceId。`confirmationHash` 对上述 canonical fields 的 JSON 表示重算；消费记录额外保存 `fromTier / toTier`。全局 consumedConfirmations 与内嵌 confirmationHistory 必须双向 exact 且顺序一致。canonical transition trajectory 的 action/fromTier/toTier 有序 multiset 必须与 confirmationHistory/consumedConfirmations 完全一致；普通记录轨迹忽略，legacy v1 不变。

`l1RegistryAnchor` 的 canonical 空值是 `null`，仅表示当前不存在 L1 registry；非 null 对象只保存 `path / blockIdentity / blockVersion / sourceHash`，分别绑定 constitutionDesign 项目相对路径、`target-experience-registry`、固定 registry version 与 current canonical L1 source hash。不引入签名系统、密钥或其他配置层。

## L1 registry 与 L2 projection

- L1 marker：`target-experience-registry:start/end`，独立于现有 target constitution managed body；checksum 冲突即停止。
- L2 marker：`target-experience-projection:start/end`，由 L1 确定性生成；两份入口 marker 的 source 必须相同。
- `.vibe-runtime.json.experienceProjection` 记录 source、sourceHash、每个入口的 sourceHash/outputHash。
- 数据方向固定为 `L0 anchor → current L1 registry → expected L2 projections/runtime registry`；runtime 只校验与投影，不得写入或反向刷新 anchor。

## orchestrator

程序入口：`executeExperienceAction(request)` 或 CLI：

```powershell
Get-Content -Raw -Encoding UTF8 .\request.json | node <skills-root>\tools\experience-governance.mjs <target-root>
```

request 至少包含 `skillsRoot / action / expectedRevision`，其中 expectedRevision 是显式非负整数；record 带 event，elevate/retire 带 confirmation。L2→L3 使用零依赖 canonical command-word tokenizer，每个 word 只能 unquoted 或完整单/双引号包裹；未闭合、跨 token 首尾误配与 quoted adjacency 均拒绝，解释器 basename 只接受大小写敏感的 lowercase canonical token，script-position 保持冻结。每个 registration file 保存完整 canonical match-set；同一路径允许不同 entry，但 tuple 不得重复。所有改变 L1 的动作必须在 `.vibe-experience-transaction.json` 同一事务内更新 L0 anchor，失败回滚。

显式 `adopt-anchor` 只属于 governance/orchestrator：严格验证旧 v2 除缺 anchor 外无其他问题、current L1 canonical，以及已有 L2/runtime 完整匹配 current L1 后，只在原子事务内写 anchor。current L1 存在但 anchor 缺失/null 时普通动作与 runtime check/write 都 fail closed；无 L1 bootstrap 可保持 null，首次创建 L1 同事务写 anchor。

## 退役

退役步骤由 orchestrator 按当前 tier 自动生成，不接受 `registrationUpdates`、replacement content、caller 自报 `removed` 或 `l3Operations`。退役前 fresh 解析真实 execution evidence，把 fresh match-set 与 stored match-set 做 exact set 比对；随后按 registry 证据结构化、确定性删除全部 exact package script key、workflow run entry 或 Hook/test line，重新解析确认达到零 match。owned checker 仅在 `owned=true`、owner marker 与 hash 匹配时删除。L0 archived 永久保留 tombstone、确认历史与轨迹。
