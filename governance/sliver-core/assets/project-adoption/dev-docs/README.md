# Dev Docs Truth Index

这个目录记录半路接管项目的内部开发真源。它不是公开说明书，推送远程前必须确认是否允许公开。

## 当前真源索引

- 当前状态审计：[current-state-audit.md](current-state-audit.md)
- 技术栈、框架与架构决策证据：[technical-selection.md](technical-selection.md)
- 架构和 owner map：[architecture.md](architecture.md)
- 验收和停止条件：[acceptance.md](acceptance.md)
- UI 设计真源（条件式）：确认当前真源根后，首个 UI 原型落盘时将 `design/README.md` 登记到本索引。

## 文档职责

- `current-state-audit.md`：记录当前代码、文档、启动、Git、AI 债务、隐私和下一步。
- `technical-selection.md`：唯一维护沿用、修正或迁移的驱动因素、质量场景、模式轴、框架适配、当前官方证据、PoC、取舍和决策历史。
- `architecture.md`：只记录定案后的当前 owner、合同、数据、权限、进程、部署和真实运行链路；不复制决策理由。
- `acceptance.md`：记录接管是否完成、第一安全任务是否可执行、哪些证据缺失。
- `design/`：只在 UI 原型生命周期实际启用时创建；`design/README.md` 索引功能原型，`design/prototypes/<feature>/prototype.md` 是该原型状态的唯一真源。

## 更新规则

- 先索引，再移动；先审计，再改写。
- 旧文档不能直接删除，先标记 active/stale/conflict/duplicate/public/unrelated。
- 公共 docs 和内部 dev-docs 分开。
- 接管期间的危险动作必须先让用户确认。
- 有既有真源约定时必须沿用，禁止并行文档体系；没有约定、`dev-docs/` 未被占用且无隐私/Git/对外交付冲突时，已授权的 UI 原型任务可直接创建标准 `dev-docs/design/`。
- UI 原型不能只留在聊天或临时目录；已批准版本不得覆盖，修订时新建下一个 `vNNN` 并更新原型真源。
- 先在 `technical-selection.md` 闭合技术决策，再将当前具体结构回写 `architecture.md`；两者不并列维护理由。

## 当前状态

- 接管阶段：待填写
- 当前主风险：待填写
- 推荐下一步：待填写
- 未验证项：待填写
