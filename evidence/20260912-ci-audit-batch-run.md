# 证据：全链路审计批次的 CI 首跑（release-gate run 34656178737）

- 日期：2026-09-12
- 触发：audit 批次 4 提交推送（`28c8089..02d06ca`，HEAD `02d06ca`）
- Run：`34656178737`（main / push / release-gate），ubuntu-latest，fresh clone，pwsh 7，**success**，50s
- 关联：`evidence/20260912-chain-audit-and-closure.md`（审计与修复主体证据）

## CI 实测输出（节选自 run log）

```text
Static gates (single entrypoint):
  verify: 15/15 steps passed
  all gates passed
Release package assembly (static candidate):
  zip + NOTICE + release manifest 装配通过（forbidden segment 检查无违例）
Upload static candidate package (not a release): ✓（artifact: feisheng-vibe-coding-static-candidate）
```

## 意义

1. **新门禁集首次跨平台验证**：默认 15 步含本批新增的「退役引用扫描」（retired=23, scanned=520）与
   「collector 路径归属单测」，在全新 clone + Linux + pwsh 7 下与 Windows 本机（15/15）一致——
   双 shell、双平台、fresh clone 三重可复现。
2. **确定性字节写出生效**：catalog / CAPABILITY-INDEX 的再生比对在 Linux runner 上通过，
   证实 LF/无 BOM 写出不依赖本机宿主。
3. **登记补丁跨平台消费**：40 个 vibe runtime-import 补丁 + 2 个 matt 补丁在 fresh clone 的
   副本↔快照一致性门禁下全数核对通过。

## 附带卫生项（登记，不阻塞）

- GitHub Actions 注解：`actions/checkout@v4`、`actions/upload-artifact@v4` 目标 Node.js 20 已弃用
  （被强制跑在 Node 24）。待 action 发布兼容版本后升级，属上游依赖例行维护。
- 本 evidence 提交本身会再触发一次 release-gate（同一树内容 + 证据文件），属正常链路。
