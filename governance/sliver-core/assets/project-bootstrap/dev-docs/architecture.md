# Architecture Truth

本文档只记录已定案并准备实施的当前宏观结构：进程/部署单元、跨边界 owner、共享合同、数据/安全边界、真实运行链路和局部架构真源链接。技术选型的驱动因素、质量场景、候选比较、PoC、取舍和历史只在 `technical-selection.md` 维护。前端、后端等局部详细真源一旦物化，本文只保留投影和链接，不再复制其内部规则。

## 当前架构

- technical_selection_source: `technical-selection.md`
- foundation_decision_status: blocked
- 当前产品形态：
- 当前实施组合：
- 当前部署形态：
- 主运行时和语言：
- 代码与部署根目录：

## 进程与部署结构

| Process Or Deployable | Responsibility | Runtime | Communication | Data Or Secret Boundary | Start And Health Evidence |
| --- | --- | --- | --- | --- | --- |
| 实际进程或可部署单元 | 运行时责任 | 语言、框架与版本 | 与其他单元的实际通信 | 数据、权限和密钥边界 | 真实启动命令、端口和健康检查 |

## Owner Map

| Concept | Owner | Public Contract | Forbidden Owner | Verification |
| --- | --- | --- | --- | --- |
| 产品边界 | 当前文件或模块 | 可被其他 owner 引用的合同 | 不能维护真相的层 | 真源检查 |
| 前端路由 | 当前文件或模块 | 路由合同 | 页面内临时判断 | 路由验证 |
| 设计 token | 当前文件或模块 | token 合同 | 页面局部视觉系统 | token 使用和截图 |
| 业务组件 | 当前文件或模块 | 组件接口 | 通用 UI 基座 | 复用与状态验证 |
| API 合同 | 当前文件或模块 | schema/DTO 真源 | UI 临时字段 | 契约测试 |
| 业务逻辑 | 当前文件或模块 | use case 或领域合同 | UI、route、controller | 业务测试 |
| 数据库/schema | 当前文件或模块 | schema/migration | 前端表单 | 迁移与回滚 |
| 登录/权限 | 当前文件或模块 | 服务端 policy | 隐藏按钮 | 负例验证 |
| 第三方接入 | 当前 adapter/provider | provider contract | 页面直调 | sandbox/live 证据 |
| 部署/配置 | 当前文件或模块 | config/deploy contract | 业务代码 | 构建、健康和回滚 |

## 数据、合同与安全边界

| Boundary | Source Of Truth | Writer | Reader | Transaction Or Consistency | Permission Enforcement | Failure Handling |
| --- | --- | --- | --- | --- | --- | --- |
| 当前核心数据或跨 owner 合同 | 真实 schema、contract 或配置 | 唯一写入 owner | 允许的读取者 | 事务或一致性规则 | 服务端权限 owner | 超时、重试、幂等、补偿或回滚 |

## 关键运行链路

不复制通用调用链。每行写一条项目真实的用户流程或后台流程。

| Flow | Real Entry | Ordered Owners | Contracts And State | User Or System Result | Failure Evidence |
| --- | --- | --- | --- | --- | --- |
| 当前第一闭环或关键运行流程 | 真实入口 | 按实际顺序列出 owner | 跨边界 contract 和状态 | 用户或系统真实得到什么 | 错误、日志和可重复证据 |

## 局部架构真源投影

| Area | Detail Truth Owner | Macro Projection Kept Here | Status |
| --- | --- | --- | --- |
| 前端 | 物化后填写 `frontend-architecture.md` 或项目现有真源 | 客户端形态、与后端/本地进程的边界、主合同 | not_materialized / linked |
| 后端 | 物化后填写 `backend-architecture.md` 或项目现有真源 | 可部署单元、跨进程边界、主 API/事件合同 | not_materialized / linked |
| 数据/安全/部署 | 填写已物化的项目真源或不适用证据 | 跨 owner 数据、信任和运行边界 | not_materialized / linked / not_applicable |

详细真源物化后，路由、token、组件、请求生命周期、数据访问、权限和局部验证规则只在对应 detail owner 维护。

## 第三方和外部能力

| Provider | Adapter Owner | SDK Or Protocol | Auth And Secret Owner | Callback Or Job Boundary | Sandbox Or Live Evidence |
| --- | --- | --- | --- | --- | --- |
| 实际第三方或明确不适用的原因 | 当前 owner | 已定案版本或协议 | 鉴权和密钥边界 | webhook、任务、重试和幂等 | 当前验证路径 |

## 演进保护边界

| Product Truth Reference | Protected Owner Or Contract | Deferred Implementation | Migration Cliff | Re-Evaluation Trigger |
| --- | --- | --- | --- | --- |
| 已确认的演进条目 | 当前保护的最小具体边界 | 明确现在不实现什么 | 什么会造成重写或迁移 | 什么证据触发重评 |

## 禁止路径

- 禁止在本文复制 `technical-selection.md` 的驱动因素、候选、理由、PoC 和决策历史。
- 禁止在局部架构真源物化后，继续在本文并列维护前端、后端、数据、安全或部署详细。
- 禁止 UI 拥有业务真源。
- 禁止 controller/route 写核心业务规则。
- 禁止使用 mock 或本地假数据冒充真实功能。
- 禁止无证据跨语言、拆服务、增加消息系统或全量架构抽象。
- 禁止低约束样式工具脱离 token 和组件 owner。
- 禁止私造框架原生机制之外的并行目录、状态、生命周期或请求系统。

## 验证方式

- 本地启动命令：
- 构建命令：
- 测试命令：
- 模块或依赖结构检查：
- UI 真实验证：
- API 契约和负例：
- 数据库迁移与回滚：
- 第三方 sandbox/live 证据：
- 部署健康和回滚：
- Git checkpoint：
