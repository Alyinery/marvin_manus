# Marvin Manus

Marvin Manus 是一个基于 Java 21、Spring Boot 和 Spring AI 构建的多工具任务 Agent。系统采用 ReAct 执行模式，将任务拆分为推理、工具选择、执行反馈和后续决策，并通过 SSE 将每一步结果实时返回前端。

项目配套 Vue 3 工作台，可用于提交任务、查看执行步骤、保存本地历史记录和处理流式响应。

## 核心能力

- **ReAct 执行循环**：按照 Think -> Act -> Observation 流程持续处理任务。
- **显式工具执行**：使用 `ToolCallingManager` 执行工具，并将工具结果写回消息上下文。
- **请求状态隔离**：每次任务创建独立 Agent 实例，避免不同请求共享消息和执行状态。
- **执行过程反馈**：通过 `SseEmitter` 返回任务步骤，前端实时展示执行进度和异常状态。
- **任务边界控制**：通过 Agent 状态机和最大步数限制约束执行循环。
- **知识检索实验**：包含查询重写、关键词元信息增强、文档向量化和问答增强实现。
- **MCP 扩展实验**：包含 Spring AI MCP Client 配置和图片搜索 MCP Server 模块。

## 工具列表

| 工具     | 功能              |
| ------ | --------------- |
| 联网搜索   | 调用搜索服务获取相关信息    |
| 网页抓取   | 读取并解析网页内容       |
| 文件操作   | 读取和写入本地文件       |
| 资源下载   | 将网络资源保存到本地      |
| 终端执行   | 在后端所在计算机执行命令    |
| PDF 生成 | 将指定内容生成 PDF 文件  |
| 终止工具   | 在任务完成或无法继续时结束循环 |

## 执行流程

```text
用户目标
   |
   v
创建独立 Agent 实例
   |
   v
Think：分析上下文并选择工具
   |
   v
Act：显式执行工具调用
   |
   v
Observation：将执行结果写回上下文
   |
   +---- 继续执行下一步
   |
   +---- 调用终止工具 / 达到步数上限
   |
   v
通过 SSE 返回执行结果
```

## 技术栈

### 后端

- Java 21
- Spring Boot 3.4
- Spring AI 1.0、Spring AI Alibaba
- ReAct、Tool Calling、Chat Memory
- RAG、SimpleVectorStore、可选 PgVector / HNSW
- MCP Client / Server
- Reactor Flux、SseEmitter
- Jsoup、Hutool、iText、Kryo

### 前端

- Vue 3、Vite
- Fetch、ReadableStream、SSE
- 响应式桌面与移动端布局
- 本地历史记录、步骤展示和错误状态管理

## 项目结构

```text
marvin_manus/
├─ src/main/java/com/marvin/marvin_manus/
│  ├─ agent/                 # Agent 生命周期、ReAct 和工具执行
│  ├─ controller/            # HTTP 与 SSE 接口
│  ├─ tools/                 # 工具注册与实现
│  ├─ rag/                   # 查询重写、向量检索和文档增强
│  ├─ advisor/               # 自定义 Advisor
│  ├─ chatmemory/            # 会话记忆实验实现
│  └─ config/                # Web 与跨域配置
├─ src/main/resources/
│  ├─ document/              # 知识库文档
│  ├─ application.yml        # 通用配置
│  └─ application-local.yml  # 本地配置
├─ image_search_mcp_server/  # 图片搜索 MCP Server 实验模块
└─ marvin_manus_frontend/    # Vue 3 任务工作台
```

## 环境要求

- JDK 21
- Maven 3.9+
- Node.js 18+
- DashScope API Key
- 可选：SearchAPI Key、PostgreSQL + pgvector、MCP 服务

## 本地配置

项目通过环境变量读取本地密钥，避免将真实凭据提交到 Git：

```powershell
$env:DASHSCOPE_API_KEY = "你的 DashScope API Key"
$env:SEARCH_API_KEY = "你的 SearchAPI Key"
```

`SEARCH_API_KEY` 只在使用联网搜索工具时需要。

## 启动后端

```powershell
mvn clean package
java -jar target/marvin_manus-0.0.1-SNAPSHOT.jar
```

默认服务地址：

- 健康检查：`http://127.0.0.1:8123/api/health`
- 接口文档：`http://127.0.0.1:8123/api/doc.html`
- Agent SSE：`GET /api/ai/manus/chat?message=...`

## 启动前端

```powershell
cd marvin_manus_frontend
npm ci
npm run dev
```

访问 `http://127.0.0.1:3000`。开发服务器会将 `/api` 请求代理到本地后端。

## 测试与构建

后端：

```powershell
mvn test
```

前端：

```powershell
cd marvin_manus_frontend
npm test
npm run build
```

前端测试覆盖 SSE 分包、UTF-8 跨分片、CRLF、多行数据、连接截断和执行状态分类。

## 当前状态

| 模块             | 状态   | 说明                                       |
| -------------- | ---- | ---------------------------------------- |
| Spring Boot 启动 | 可用   | 健康检查返回 `200 ok`                          |
| Vue 任务工作台      | 可用   | 构建、桌面和移动端检查通过                            |
| 模型调用           | 需配置  | 需要有效的 `DASHSCOPE_API_KEY`                |
| Agent 工具注册     | 待修复  | `ToolCallback[]` 需要通过 `toolCallbacks` 注册 |
| Agent 异常终止     | 待修复  | 工具注册或模型调用失败时应立即结束循环                      |
| 内存向量检索         | 实验功能 | 需要可用的 Embedding 模型                       |
| PgVector       | 默认关闭 | 需要数据库和数据源配置                              |
| MCP            | 默认关闭 | 需要独立启用 Client 或 Server 配置                |

## 安全说明

- 终端执行、文件写入和资源下载工具只应在可信的本地环境中运行。
- 当前项目没有用户认证、工具授权审批和后台任务取消机制，不适合直接暴露到公网。
- API Key 应通过环境变量或未提交的本地配置提供。
- 生产使用前应为文件路径、终端命令和网络访问增加白名单、超时、审计和沙箱隔离。
