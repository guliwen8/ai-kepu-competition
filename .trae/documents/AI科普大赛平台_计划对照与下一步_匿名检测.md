# 绍兴市高校 AI 科普大赛平台：计划对照与下一步（匿名检测）

## 1. 结论（我们有没有按计划在开发）

整体结论：**是的，主干开发基本按《AI科普大赛平台\_完善计划.md》的里程碑顺序推进**，且已完成/跑通了里程碑 B、里程碑 C 的关键“提交闭环”，并在里程碑 D 上完成了第一层“格式合规”任务的落地与自动化验证；但计划文档本身的“当前状态分析”已明显过期，需要以仓库现状为准进行一次计划更新（本文件即为更新补丁与下一步计划）。

## 2. 现状盘点（以仓库为准）

已落地（可运行）：

- Monorepo 已搭建：`apps/api`（NestJS）、`apps/admin-web`（Next.js）、`apps/miniapp`（Taro）
- 数据库与领域模型已落库（Prisma）：Submission/Attachment/ReviewCase/ReviewTask 等
- 参赛端“最小闭环”已跑通：
  - 创建作品草稿、上传附件、提交
  - 提交触发 **FORMAT** 审核任务并产出 ReviewCase
- 自动化冒烟测试已可替代 Swagger 手点：根脚本 `npm run smoke`（你已验证 PASS）

关键证据（可导航定位）：

- 提交流程与 FORMAT 审核： [submissions.service.ts](file:///Users/zhengyunzhineng/trae/AI科普大赛/apps/api/src/submissions/submissions.service.ts#L201-L242)
- ReviewTaskType 已包含 ANONYMITY： [schema.prisma](file:///Users/zhengyunzhineng/trae/AI科普大赛/apps/api/prisma/schema.prisma#L39-L51)

尚未落地（与计划差距最大）：

- 里程碑 D：匿名检测（ANONYMITY）、内容导向初审（CONTENT）、人工复核台、队列异步化
- 里程碑 E/F/G：评审、对外公示与巡展、AI 辅助中心（工具库/选题/合规）
- 计划文档《AI科普大赛平台\_完善计划.md》中的“当前状态分析（仓库为空）”已过期，需要修订

## 3. 里程碑对照表（计划 vs 已实现）

- 里程碑 A（需求锁定与对齐）
  - 计划：抽取建设方案+通知，形成字段/规则/流程与验收
  - 现状：通知规则已落到后端数据模型与校验（格式、人数、提交上限等）；建设方案全文级抽取仍可继续补齐（不阻塞匿名检测）
- 里程碑 B（工程初始化）
  - 计划：Monorepo + 后端/前端骨架 + DB + Swagger + 本地链路
  - 现状：已完成，并可通过 `npm run smoke` 验证主链路
- 里程碑 C（报名与作品提交）
  - 计划：团队/成员 + 报名表 + 附件上传 + 双端校验 + 进度/通知
  - 现状：团队/成员 + 作品草稿/上传/提交 + 后端校验已完成；“进度页/站内通知/完整报名表 UI”仍是待补项
- 里程碑 D（三层审核引擎）
  - 计划：FORMAT → ANONYMITY → CONTENT + 人工复核 + 可重跑 + 队列
  - 现状：已完成 FORMAT（同步执行）；ANONYMITY/CONTENT/人工复核/队列未实现

## 4. 下一阶段目标（锁定：匿名检测，规则 + OpenAI 兼容 LLM，同步执行）

目标：在现有 FORMAT 基础上增加第二层 **ANONYMITY** 审核任务，实现“提交即产出 FORMAT→ANONYMITY 结果”，并把结构化 findings 写入 `ReviewTask.findings`，支持参赛端/后台查询展示。

成功标准（验收）：

1. 用户提交作品后：
   - FORMAT 通过时：继续执行 ANONYMITY 检测
   - FORMAT 失败时：不执行 ANONYMITY（或标记为 PENDING/跳过，需在实现中固定一条规则）
2. ANONYMITY 命中时：
   - ReviewTask(type=ANONYMITY).status=FAIL
   - Submission.status=NEED_FIX
   - findings 中包含命中项证据（字段名/命中片段/规则编号/置信度或理由）
3. `npm run smoke` 新增匿名用例：构造包含手机号/姓名/单位等敏感信息的标题/简介，能够稳定触发 FAIL，并可通过接口拉取 latest review 验证
4. LLM Provider：
   - 默认可关闭（无 key 时仅规则引擎）
   - 配置 OpenAI 兼容 baseUrl+apiKey 时，可对“疑似信息”做补充判定并给出结构化理由（不在日志中输出 key 与完整提示词）

## 5. 设计决策（Decision Complete）

### 5.1 检测范围

- 文本字段（优先级从高到低）：
  - `title`, `intro`, `aiToolsUsage`, `teacherName`, `teacherContact`
- 附件相关（MVP 只做轻量、可实现部分）：
  - `Attachment.originalName`
  - `Attachment.meta` 中已存在的字段（若有）：如作者、软件信息、时长等

### 5.2 规则引擎（必须有，可离线）

- 手机号：`1[3-9]\d{9}`
- 身份证号：`(\d{17}[\dXx])`
- 常见单位/学校关键词：`大学|学院|中学|小学|研究所|公司|集团|医院`（可配置词表）
- 常见姓名模式（弱规则，避免误杀）：2-4 个中文字符且前后有“作者/指导老师/联系人”等提示词时才命中

### 5.3 LLM 增强（OpenAI 兼容，可选）

- 目标：降低误报、补充解释，不替代硬性规则
- 输入：仅传入“待检测字段名 + 文本片段（截断）+ 已命中的规则摘要”
- 输出：结构化 JSON（是否属于泄露身份/单位/联系方式、原因、建议动作）

### 5.4 审核结果结构（写入 ReviewTask.findings）

统一 findings 结构（数组）：

- `code`: string（规则编号，如 `PHONE`, `ID_CARD`, `ORG_KEYWORD`, `LLM_SUSPECT`）
- `message`: string（面向用户/运营可读的说明）
- `detail`: object（字段名 field、命中片段 evidence、位置 position 可选、置信度 confidence 可选）

## 6. 拟改动清单（按文件）

### 6.1 后端：匿名检测实现

- 新增匿名规则与检测器
  - 新文件：`apps/api/src/reviews/anonymity-rules.ts`
    - 导出 `runAnonymityRules(input)`：返回 `{ pass: boolean, findings: Finding[] }`
- 新增 LLM Provider 抽象（OpenAI 兼容）
  - 新目录：`apps/api/src/ai/*`（或 `apps/api/src/reviews/llm/*`，以现有模块风格为准）
  - 关键接口：
    - `AiProvider#extractAnonymityRisk(textChunks): Promise<{ findings: Finding[] }>`
  - 环境变量（在 `.env.example` 补齐）：
    - `LLM_PROVIDER=openai_compatible|none`
    - `LLM_BASE_URL=...`
    - `LLM_API_KEY=...`
- 串联审核流水线（同步执行）
  - 修改：`apps/api/src/submissions/submissions.service.ts`
    - 当前 `submit()` 只创建 FORMAT task
    - 改为：
      - 先做 FORMAT；FAIL 则结束
      - PASS 时继续做 ANONYMITY（规则引擎 + 可选 LLM）
      - 在同一个 ReviewCase 下创建 2 个 tasks（FORMAT + ANONYMITY）
      - 依据两层结果更新 `ReviewCase.summary` 与 `Submission.status`

### 6.2 接口与展示

- 参赛端与后台无需新增接口即可先跑通：
  - 继续复用 `GET /reviews/submissions/:id/latest` 返回 tasks 列表
- 若需要“重跑匿名检测”：
  - 新增 `POST /reviews/submissions/:id/rerun?types=ANONYMITY`（可选，计划内但可拆到下一迭代）

### 6.3 自动化验证

- 修改：`apps/api/scripts/smoke.ts`
  - 增加第二条用例（或通过环境变量切换）：
    - 用包含手机号/单位的 `title/intro` 创建草稿并提交
    - 断言 latest review 中存在 `ANONYMITY` task 且 status=FAIL

## 7. 风险与处理

- 误报/漏报：规则命中尽量“强规则优先”；姓名类弱规则要有上下文词触发；LLM 仅作为解释与复核建议
- 性能：同步执行下 LLM 请求可能拖慢提交；实现中需设置超时与降级（超时即仅规则结果）
- 隐私与日志：不记录 API Key；不落库完整提示词；findings 中仅保留必要证据片段（截断）

## 8. 本阶段完成后的下一步（顺序建议）

1. 里程碑 D：补齐 CONTENT 审核（规则+LLM）与人工复核台
2. 里程碑 C：补齐参赛端“进度页/站内通知/完整报名表 UI”
3. 里程碑 E：评审端闭环（账号、分配、五维度评分）
