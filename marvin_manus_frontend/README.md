# Marvin Manus Workspace

基于现有后端接口重新实现的 Vue 3 前端。界面和交互代码均为新实现，不依赖旧前端页面、路由或组件。

## 本地运行

需要 Node.js 18 或更高版本。先启动端口 8123 的后端，再在本目录执行：

```sh
npm ci
npm run dev
```

访问 http://127.0.0.1:3000 。Vite 将 `/api` 代理到 `http://127.0.0.1:8123`。

```sh
npm test
npm run build
```

## 对接范围

| 功能 | 接口 | 行为 |
| --- | --- | --- |
| 连接状态 | GET /api/health | 仅检查后端连通性，不代表模型或工具已配置 |
| Agent 任务 | GET /api/ai/manus/chat?message=... | 每次独立任务，逐步展示真实 SSE 数据 |
| 情感对话 | GET /api/ai/love_app/chat/server_sent_event?message=...&chatId=... | 复用会话 ID，拼接流式文本 |

使用 Fetch + ReadableStream，正常 EOF 表示响应结束；不会像 EventSource 一样自动重连、重复执行任务。支持分块 UTF-8、CRLF、多行 data，以及截断检测。结果作为纯文本呈现，不执行模型输出的 HTML。

浏览器记录使用 localStorage，保留最近 20 个会话，刷新时将未完成响应标为中断。删除页面记录不清除后端对话记忆或生成文件。停止接收仅关闭请求，后台任务不保证取消。

当前后端没有对外知识库检索、文件下载和任务取消接口，所以页面不提供对应操作。Agent 接口不返回模型思考过程或独立最终答案，页面只展示实际收到的步骤与工具反馈。云模型与搜索需要在后端配置有效凭据。

## 部署

`npm run build` 生成 `dist/`。生产部署时将 `/api/` 反向代理至后端，并为 SPA 配置首页回退。应用不在浏览器保存 API Key。
