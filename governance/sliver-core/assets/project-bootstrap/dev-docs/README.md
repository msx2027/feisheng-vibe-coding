# Dev Docs Truth Index

这个目录是项目内部开发真源。它给 AI 和项目维护者使用，不默认等同于公开文档。

## 当前真源索引

- 项目立项和边界：[project-brief.md](project-brief.md)
- 技术栈、框架与架构决策证据：[technical-selection.md](technical-selection.md)
- 架构和 owner map：[architecture.md](architecture.md)
- 验收和停止条件：[acceptance.md](acceptance.md)
- UI 设计真源（条件式）：首个 UI 原型落盘后，将 `design/README.md` 登记到本索引。

## 文档职责

- `project-brief.md`：写清楚项目是什么、不是什么、第一闭环、MVP、功能边界和不做什么。
- `technical-selection.md`：唯一维护架构驱动因素、质量场景、模式轴、框架适配、当前官方证据、PoC、取舍和决策历史。
- `architecture.md`：只写定案后的当前进程、模块、owner、合同、数据、权限和真实运行链路；不复制决策理由。
- `acceptance.md`：写清楚每个阶段怎么证明完成、哪些证据缺失、什么时候不能继续。
- `design/`：只在 UI 原型生命周期实际启用时创建；`design/README.md` 索引功能原型，`design/prototypes/<feature>/prototype.md` 是该原型状态的唯一真源。

## 更新规则

- 聊天里的决定不算真源，必须写回对应文档。
- 需求或产品演进事实改 `project-brief.md`；技术决策与证据改 `technical-selection.md`；定案后的具体 owner 与运行结构改 `architecture.md`。
- UI 原型不能只留在聊天或临时目录；已批准版本不得覆盖，修订时新建下一个 `vNNN` 并更新原型真源。
- 数据库、权限、支付、第三方、部署或验收方式变化时，先更新对应真源再开发。
- 过期文档要标记为过期或归档，不能和当前真源并列。
- 内部真源默认私有。推送远程前必须确认这些文件是否允许公开。

## 当前状态

- 项目阶段：待填写
- 当前主路线：待填写
- 第一闭环：待填写
- 下一步：待填写
- 未验证项：待填写
