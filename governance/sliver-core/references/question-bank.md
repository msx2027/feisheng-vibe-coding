# Question Bank

Use these candidate questions only after inspecting the project. They are not a questionnaire. Ask a non-technical user only for a fact that cannot be discovered from available project/runtime evidence and whose answer changes the visible product result, cost, scope, downtime, irreversible effect, or major trade-off.

## How To Ask

- Ask at most 1-3 blocking questions at a time. Prefer one question when one answer can unblock the next evidence check.
- For technical-stack or architecture foundation decisions, ask exactly one unresolved blocking product fact at a time. Wait for that answer, update the evidence record, then ask the next fact only if it is still blocking.
- Inspect files, current owners, runtime evidence, Git state, project conventions, and official documentation before asking. Never ask a question whose answer is already discoverable.
- The AI decides whether durable truth, design tokens, architecture documentation, official-document research, and a validation method are required. Those are professional execution decisions, not user choices.
- If a question is hard for the user, give a recommended default and mark it `待确认`.
- A foundation-blocking fact cannot be closed by that default. Help the user describe observable facts and keep the decision `blocked` until the answer is confirmed.
- Do not give several equal options unless the user asks to compare.
- End each question group with the exact product-visible decision needed before moving on.
- Never ask a non-technical user to choose a framework, architecture pattern, database, migration strategy, or an "AI-familiar" technology preference. Translate technical uncertainty into the visible product consequence the answer depends on.

## Universal Intake

- 这个项目文件夹在哪里？如果还没建，我先帮你起一个英文项目文件夹名，可以吗？
- 这个项目给谁用？
- 用户最核心的一步操作是什么？
- 第一版只要跑通哪条完整流程？
- 哪些功能现在坚决不做？
- 这是网站、小程序、App、后台系统、小脚本，还是纯后端接口？
- 是否需要登录？
- 是否有不同角色，比如普通用户、商家、运营、管理员？
- 是否涉及支付、上传文件、敏感信息、审核、数据导出？
- 有没有同类产品、竞品、开源项目、截图或你喜欢/讨厌的例子？
- 这个项目最想做出什么差异点或爆点？
- 后面大概想发展成什么样，哪些只是以后再做？
- 你现在是从零开始，还是已经有项目代码？

## Existing Project

- 你现在最想解决的是继续开发、项目变乱、上线前检查，还是加一个新功能？
- 项目现在能不能正常启动？
- 最近一次稳定状态是什么时候？
- 如果现有技术路线要调整，最多能接受多少停机、迁移工作、用户影响或额外成本？
- 有没有不允许公开的内部资料、真实案例、商业计划或密钥？

## Project Health

- 你现在最担心的是做不出来、项目变乱、功能不对、质量不稳、不能上线，还是不知道下一步？
- 这个项目现在是想自己本地用、给团队用、给客户看，还是公开上线？
- 最近一次你认为“可用”的状态是什么？
- 有没有哪块你完全看不懂，但 AI 一直说没问题？
- 项目现在能不能一条命令启动？启动后你能看到哪个页面或接口？
- 有没有 AI 反复修但一直没修好的报错？
- 有没有很多重复文件、临时代码、mock 数据、看不懂的包装层或废弃页面？
- 如果只能先修一个风险，你更在意继续开发、先稳住架构、先跑通核心流程，还是先做上线检查？

## Runtime And Startup

- 你现在是想本地跑起来，还是已经有线上地址？
- 你打开项目时是在哪个文件夹运行命令的？
- 你运行过什么命令？完整报错能贴出来吗？
- 启动后应该看到哪个页面、端口、接口或健康检查？
- 如果需要我安装依赖或启动服务，允许我在当前项目目录执行吗？

## Error Rescue

- 这个错误是启动时报、打开页面时报、点按钮时报、提交表单时报，还是部署时报？
- 最近一次正常是什么时候？之后改了什么？
- 报错文字、截图、浏览器控制台、终端输出、网络请求结果里你能提供哪一个？
- AI 已经试过哪些修法？有没有同一个错误反复出现？
- 这个功能涉及前端、后端、数据库、登录权限、第三方服务，还是你不确定？
- 如果我发现之前的修法方向错了，是否允许我先停下来做最小复现和边界定位？

## AI Debt

- 这个项目是不是由多个 AI 对话连续生成或修改过？
- 有没有重复页面、重复组件、重复接口、重复数据库字段或重复配置？
- 有没有页面看起来能用，但实际是 mock 数据、假成功提示或没连后端？
- 有没有 AI 为了修 bug 加了很多临时判断、fallback、备份文件或注释掉的旧代码？
- 有没有同时出现多套 UI 风格、请求方式、状态管理、鉴权方式或数据库访问方式？
- 你现在更想先继续加功能，还是先把影响后续开发的混乱点收掉？

## Technical Selection

- Do not ask this list as a questionnaire. Start with the first unresolved blocking product fact, record the answer, and continue one fact at a time until the foundation-decision sufficiency gate closes.
- 现在有没有最基本的立项资料：目标用户、第一版核心流程、MVP 范围、明确不做什么？
- 下一阶段有哪些能力已经确定，哪些只是“以后也许”的设想？
- 哪些能力现在不用做，但这次选型不能把它堵死？我会说明具体迁移代价，不用“可扩展”空话。
- 如果还没有，先补哪一个当前阻断事实；在它确认前不输出最终技术路线。
- 用户在哪里使用这个产品？
- 第一版部署给谁用，是自己、本地团队、公开用户，还是客户？
- 正常会有多少人同时使用，出现高峰时大概会到什么量级？如果不知道，先按当前可证实场景记录，不虚构规模。
- 哪些操作必须立即完成，哪些可以排队稍后处理？
- 可以接受多长时间不可用，哪些数据绝对不能丢或重复处理？
- 有没有公司规范、历史系统、指定语言或平台限制？
- 是否必须商用，是否需要检查开源协议？
- 公司、客户、现有系统或目标平台是否强制使用或禁止某项技术？没有强制约束时由 AI 根据证据决定。
- 如果是接手已有项目，当前技术栈哪里让你不放心：启动困难、AI 不会维护、文档少、SDK 过期、部署麻烦，还是功能做不下去？
- 如果证据最终支持迁移，现有功能连续可用、停机、数据转换、交付时间和预算中有哪些不可突破的产品边界？

## Feature Start

- 你现在要开始做的功能，用户最后能看到或完成什么？
- 这个功能是否会改变登录、角色、权限、支付、订单状态、核心数据字段或第三方平台？
- 如果这个功能需要动底层架构，你更希望先稳妥重设计，还是先缩小功能范围？

## Data

- 项目里最重要的数据对象是什么？
- 哪些数据一旦删了会出事故？
- 哪些操作会同时影响多张表，比如订单、库存、支付、余额？
- 金额、状态、权限、历史快照有没有特殊规则？

## Frontend

- 产品应该偏工具、后台、内容、SaaS、社区、官网，还是移动端操作？
- 有没有喜欢或讨厌的界面参考？
- 你希望第一眼感觉更偏专业工具、轻量清爽、内容阅读、商业后台、品牌展示，还是移动端效率？
- 有没有必须保留的品牌色、字体、Logo、图片风格或设计稿？
- 页面多不多，是否需要表格、表单、弹窗、列表、详情、后台菜单？
- 是否未来需要多语言或换主题？
- 有没有统一风格要求，比如颜色、字号、间距、按钮、表单、列表都要保持一致？
- 相似页面或组件以后会不会反复出现？

## Backend And Security

- 谁能看、谁能改、谁能删？
- 普通用户是否只能操作自己的数据？
- 管理员有哪些额外能力？
- 密码、密钥、手机号、支付信息、身份证号等敏感信息是否存在？
- 这个接口出错时，用户应该看到什么提示？

## Third-Party Integration

- 这个功能依赖哪个第三方平台、API、SDK 或服务？
- 用户是否已经有第三方账号、应用、client ID、API key 或商户号？
- 现在是测试环境、内部试用，还是准备生产上线？
- 用户做哪个动作时会调用第三方？
- 哪些数据会发给第三方？
- 如果第三方失败、超时、限流、收费或拒绝请求，用户应该看到什么？

## Monetization And Entitlements

- 第一版真的需要收费吗，还是先跑通核心价值再加收费？
- 用户付费后具体解锁什么：功能、报告、下载、额度、会员等级、席位，还是使用次数？
- 是一次性购买、订阅、积分/额度、试用转正、人工开通，还是多种组合？
- 是否已经有支付、商户、应用商店或收款账号？
- 哪些国家、币种、发票、税务或退款规则现在必须考虑？
- 支付成功但系统没开通权益时，应该怎么补救？
- 退款、取消、过期、续费失败后，用户还能访问什么？
- 是否需要管理员手动开通、暂停或取消用户权益？
- 你更希望第一阶段先预留收费边界，还是本阶段就接真实支付？

## Git And Delivery

- 是否已经初始化 Git？
- 当前项目根目录确定了吗？有没有父仓、子仓或第三方参考项目放在项目里？
- 当前状态是否值得保存为一个稳定点？
- 这个仓库未来会不会推到远程 Git 平台？是私有还是公开？
- 远程仓库是私有还是公开？
- 哪些文件不应该推到远程？
- `dev-docs`、AGENTS/宪法、真实案例、商业计划、提示词、客户资料这些是要进代码仓，还是单独本地管理？
- 项目里有没有 `.env`、密钥、证书、数据库备份、真实上传文件、第三方参考库、临时下载包？

## Quality Validation

- 这个功能最重要的正常流程是什么？
- 用户输错、没登录、没权限、空数据、第三方失败时应该看到什么？
- 这个功能会不会写数据库、改状态、扣钱、扣库存、上传文件或发通知？
- 有没有老功能必须确认没有被改坏？

## User Acceptance

- 用户从哪个页面开始，第一步点哪里？
- 每一步成功时应该看到什么文字、状态、数据或跳转？
- 哪些情况你最担心：点了没反应、数据不对、权限不对、样式乱、手机端不好用，还是错误提示看不懂？

## Deployment Route

- 这次只是给你自己用、给团队试用、给客户看，还是正式上线？
- 有没有已经买好的域名、服务器、云平台、数据库或对象存储？
- 你更在意省钱、少维护、上线快、稳定安全，还是以后容易扩展？
- 这个项目能不能公开访问？有没有必须只给内部人员看的页面或数据？
- 谁负责平台账号、账单、密钥、日志和用户反馈？

## Release And Operations

- 这次是本地自用、内测、给客户交付，还是正式上线？
- 如果发布后出问题，能不能回滚？需要保留哪些备份？
- 发布后谁看日志、谁处理用户反馈、谁付云服务或第三方费用？

## Agent Constitution

Inspect the host instruction entry, existing truth documents, owner map, validation commands, synchronization rules, and public/private boundary directly. Ask the user only if a still-unknown public/private or product-policy decision changes what the constitution may contain; never ask them to identify technical owners or validation commands.
