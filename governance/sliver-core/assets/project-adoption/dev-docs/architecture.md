# Architecture Truth

本文档只记接管审计后已定案并准备沿用或修正的当前宏观结构：进程/部署单元、跨边界 owner、共享合同、数据/安全边界、真实运行链路和局部架构真源链接。技术栈与架构决策的证据、取舍、PoC 和历史只在 `technical-selection.md` 维护。前端、后端等局部详细真源一旦存在，本文只保留投影和链接，不再复制其内部规则。

## 当前架构

- technical_selection_source: `technical-selection.md`
- foundation_decision_status: blocked
- 当前产品形态：
- 当前实施组合：
- 当前部署形态：
- 主运行时和语言：
- 代码与部署根目录：

## 进程与部署结构

| Process Or Deployable | Current Responsibility | Runtime | Communication | Data Or Secret Boundary | Start And Health Evidence |
| --- | --- | --- | --- | --- | --- |
| 实际进程或可部署单元 | 当前运行时责任 | 语言、框架与版本 | 实际通信 | 数据、权限和密钥边界 | 新鲜启动命令、端口和健康证据 |

## Owner Map

| Concept | Current Owner | Target Owner | Public Contract | Forbidden Owner | Repair Or Keep |
| --- | --- | --- | --- | --- | --- |
| 产品边界 | 当前 owner | 应该 owner | 当前或目标合同 | 禁止 owner | keep / repair / migrate |
| 前端路由 | 当前 owner | 应该 owner | 路由合同 | 页面内临时判断 | keep / repair / migrate |
| 设计 token | 当前 owner | 应该 owner | token 合同 | 页面局部视觉系统 | keep / repair / migrate |
| 业务组件 | 当前 owner | 应该 owner | 组件接口 | 通用 UI 基座 | keep / repair / migrate |
| API 合同 | 当前 owner | 应该 owner | schema/DTO 真源 | UI 临时字段 | keep / repair / migrate |
| 业务逻辑 | 当前 owner | 应该 owner | use case 或领域合同 | UI、route、controller | keep / repair / migrate |
| 数据库/schema | 当前 owner | 应该 owner | schema/migration | 前端表单 | keep / repair / migrate |
| 登录/权限 | 当前 owner | 应该 owner | 服务端 policy | 隐藏按钮 | keep / repair / migrate |
| 第三方接入 | 当前 owner | 应该 adapter/provider | provider contract | 页面直调 | keep / repair / migrate |
| 部署/配置 | 当前 owner | 应该 owner | config/deploy contract | 业务代码 | keep / repair / migrate |

## 数据、合同与安全边界

| Boundary | Current Truth | Writer | Reader | Transaction Or Consistency | Permission Enforcement | Drift Or Repair |
| --- | --- | --- | --- | --- | --- | --- |
| 当前核心数据或跨 owner 合同 | 真实 schema、contract 或配置 | 当前写入 owner | 当前读取者 | 实际事务或一致性规则 | 实际服务端权限 owner | 当前漂移和最小修复 |

## 关键运行链路

不复制通用调用链。每行写当前代码和运行态已证明的真实链路。

| Flow | Real Entry | Ordered Current Owners | Contracts And State | Real Result | Failure Or Missing Evidence |
| --- | --- | --- | --- | --- | --- |
| 当前第一闭环或关键运行流程 | 真实入口 | 按当前调用顺序列出 owner | 跨边界 contract 和状态 | 已证明的真实结果 | 错误、日志或未验证边界 |

## 局部架构真源投影

| Area | Current Detail Truth Owner | Target Detail Truth Owner | Macro Projection Kept Here | Status |
| --- | --- | --- | --- | --- |
| 前端 | 当前文件或未找到 | `frontend-architecture.md` 或项目现有真源 | 客户端形态、跨进程边界、主合同 | keep / repair / materialize |
| 后端 | 当前文件或未找到 | `backend-architecture.md` 或项目现有真源 | 可部署单元、跨进程边界、主 API/事件合同 | keep / repair / materialize |
| 数据/安全/部署 | 当前文件或未找到 | 项目现有详细真源 | 跨 owner 数据、信任和运行边界 | keep / repair / materialize / not_applicable |

一旦 detail owner 被确认或物化，路由、token、组件、请求生命周期、数据访问、权限和局部验证规则只在该 owner 维护。

## 第三方和外部能力

| Provider | Current Adapter Owner | SDK Or Protocol | Auth And Secret Owner | Callback Or Job Boundary | Sandbox Or Live Evidence |
| --- | --- | --- | --- | --- | --- |
| 实际第三方或明确不适用的原因 | 当前 owner | 已定案版本或协议 | 鉴权和密钥边界 | webhook、任务、重试和幂等 | 当前验证路径 |

## 演进保护边界

| Product Truth Reference | Protected Owner Or Contract | Deferred Implementation | Migration Cliff | Re-Evaluation Trigger |
| --- | --- | --- | --- | --- |
| 已确认的演进条目 | 当前保护或要修复的最小具体边界 | 明确现在不实现什么 | 什么会造成重写或迁移 | 什么证据触发重评 |

## 禁止路径

- 禁止在本文复制 `technical-selection.md` 的驱动因素、候选、理由、PoC 和决策历史。
- 禁止在局部架构真源已存在后，继续在本文并列维护前端、后端、数据、安全或部署详细。
- 禁止把半路项目当空项目重写。
- 禁止 UI、controller、route 拥有核心业务规则。
- 禁止 mock/假数据冒充真实功能。
- 禁止为了速度保留两套 owner。
- 禁止没有用户确认就删除旧字段、旧接口、旧文档或旧部署脚本。
- 禁止没有证据就切换框架、SDK、数据库、语言或部署拓扑。

## 验证方式

- 本地启动命令：
- 构建命令：
- 测试命令：
- 模块或依赖结构检查：
- 关键路径真实验收：
- API 契约和负例：
- 数据库当前 schema、迁移与回滚：
- 第三方 sandbox/live 证据：
- 部署健康和回滚：
- 项目 guardrail：
