# DeepSeek × 猎头业务实验

从一个具体问题开始：客户给出的招聘需求，怎样整理成顾问可以核实、补充和持续更新的岗位档案？

本项目记录 DeepSeek Harness 与 Super-agent 研究原型的试用，以及“岗位启动助手”的业务适配思考。当前交付包括研究记录、提示模板、虚构案例、规则代码与可运行的客户反馈变更草稿实验。

## 已经做了什么

- 安装并启动本地 Super-agent 面板，读取管理接口状态。
- 通过独立 Harness 运行环境的命令行普通会话，发送一次虚构招聘需求并获得回答。
- 检查原型的 GitHub 同账号接单限制，以及 Windows 环境的测试结果。
- 在独立实验室接入 DeepSeek：客户反馈生成多条变更草稿、原文摘录和待确认问题，人工编辑并确认后保存版本。

独立实验室仍未接入 Super-agent 面板。GitHub 自动接单、任务 Worker 执行和 PR 交付尚未跑通。没有人工计时对照，暂不报告节省时间或匹配准确率。

## 阅读与试用

| 内容 | 用途 |
| --- | --- |
| [业务适配方案](docs/business-adaptation.md) | 为什么先做岗位启动，准备调整哪些环节 |
| [岗位启动提示模板](prompts/job-kickoff.md) | 在普通会话中约束角色、证据与输出 |
| [岗位档案模板](templates/job-record.md) | 人工维护已确认条件、偏好、问题和变更 |
| [虚构案例与实际回答](examples/hr-saas-ai-pm.md) | 查看本轮模型调用结果，继续测试需求变更 |
| [本轮实测记录](docs/trial-results.md) | 区分本地启动、模型调用与完整流程验证 |
| [验证计划](docs/validation-plan.md) | 用业务案例检查效果，留下可比较的结果 |
| [LinkedIn Hiring Assistant 2 研究](docs/linkedin-hiring-assistant-2-study.md) | 官方能力、记忆与反馈机制，以及业务取舍 |
| [实现设计与核心代码思路](docs/scoped-memory-implementation.md) | 数据边界、版本事务、反馈范围、证据卡与模型接入 |
| [最小代码示例](examples/scoped-memory/README.md) | 用纯 Python 验证岗位修订与记忆过滤，10 项测试通过 |
| [招聘记忆实验室](examples/scoped-memory/web/README.md) | 可交互前端：需求变更、范围过滤和证据复核，含本地运行说明 |
| [客户反馈草稿实测](docs/feedback-draft-results.md) | 10 条真实模型调用的固定案例、原始结果与验证边界 |

普通会话中先粘贴提示模板，再输入案例的第一轮需求。拿到回答后补充第二轮信息，用岗位档案模板检查它有没有正确修订。模板本身不会自动写入或保存业务数据。

2026-11-03 新增的规则示例在内存中运行，尚未接入 DeepSeek 面板、数据库或真实招聘流程；它验证程序规则，不证明模型或业务效果。

同日补充浏览器交互演示，以 JavaScript 映射 Python 规则。可以亲自体验版本冲突、记忆过滤与证据复核；不调用模型，刷新即清空虚构实验数据。

2026-11-04 接入独立的服务端模型接口，支持自由文本客户反馈转可编辑草稿。数据仍在浏览器内存中，刷新即清空；不自动联系候选人或执行岗位筛选。

## 第一轮的业务目标

客户原始需求 → 岗位画像与澄清问题 → 顾问补充 → 修订寻访方向 → 保存人工确认记录。

先判断这条流程是否有用，再决定是否接入自动任务分派。候选人的最终推荐、联系及录用判断仍由人负责。

## 上游来源

- [DeepSeek Super-agent 研究原型](https://github.com/deepseek-ai/dsh-superagent-prototype)，本轮检查提交：`6337fc823ce20251c8de8085948165c81aaa701e`。
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，本轮独立安装版本：`0.2.1-rc.3`。

上游将 Super-agent 定位为研究原型，并明确它不是正式 DeepSeek 产品。此仓库存放独立业务研究，没有复制上游代码或模型权重；相关软件的使用条件以各自许可证为准。

记录始于 2026-11-02。
