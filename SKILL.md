---
name: feisheng-vibe-coding
description: "统一的软件项目 AI 协作入口，覆盖任何规模的项目推进：立项与需求澄清、接管或救援既有项目、环境启动与报错排查、功能开发与重构、代码审计与安全审计、测试与验收、技术选型与架构、前端/UI 与设计系统、数据库与后端、部署发布与 Git 隐私保护、上下文交接，以及项目真源/AGENTS 等开发文档的建立与维护。当用户说「帮我看看」「下一步怎么走」「这个项目怎么接手」「有个报错」「帮我审计一下」「怎么写测试」「帮我选技术栈」「帮我把这个功能做出来」等时使用；先确认当前真相与授权，再选择一个项目路由，按需调用工程、产品、UI 与宿主适配能力，并以新鲜证据完成验证。Use when technical and non-technical users ask AI to plan, explain, audit, or advance a software project at any scope: idea/intake, startup, takeover, rescue, project guidance, local UI or behavior changes, bugs, tests, config, feature/change/refactor/review, architecture, frontend/backend/database/security, validation, Git/privacy, release/deploy, handoff, or AGENTS/dev-docs project truth."
---

# Feisheng Vibe Coding

这是统一仓库的唯一项目级入口。

## 启动动作（宿主加载本技能后立即执行，先于回答用户）

1. 读取本技能目录（宿主给出的 base directory）下的 `governance/sliver-core/SKILL.md` —— 它是项目控制面协议，唯一拥有路由、任务深度、风险与验收的完整定义。
2. 按该文件的 Startup Protocol 执行：先确认当前真相与授权边界，再用控制面自带工具选择唯一主路由，最后按路由加载对应能力的 owner 文件。
3. 项目级请求不得跳过控制面直接作答；内部能力只能返回结果或 finding，不得自行改选主路由。

## 当前阶段

仓库处于闭环后受控运行阶段（2026-09-11）：82 条来源技能已登记，39 条通过五道门禁进入 runtime（399 文件）；自然语言触发与路由链路已在宿主实测。没有通过来源、许可证、调用类型、运行时投影和镜像一致性门禁前，不得把三个源项目的内容声明为已迁移或已完成；宿主 trust、逐技能行为与 Hook fresh-session 冒烟未验证前，相关结论一律保持 `UNVERIFIED`。

## 控制面

项目级路由、任务深度、风险、授权、真源、测试和交付由 `governance/` 统一拥有（协议文件：`governance/sliver-core/SKILL.md`，见上方启动动作）。内部技能只能返回能力结果、finding 或建议，不得自行改变主路由、任务深度或项目真源。

## 调用链

```text
用户目标
  -> 一个主路由
  -> 条件 lens / 一个或多个内部能力
  -> 统一验证与验收
```

宿主激活闸门、技能调用类型和运行时镜像是独立的适配层，不与项目级路由混为一谈。

