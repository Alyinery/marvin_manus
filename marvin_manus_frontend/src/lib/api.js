import { readEvents } from './stream.js'

export async function checkHealth() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch('/api/health', { signal: controller.signal })
    return response.ok && (await response.text()).trim() === 'ok'
  } catch { return false }
  finally { clearTimeout(timeout) }
}

export async function runRequest({ mode, prompt, chatId, signal, onEvent }) {
  const endpoint = mode === 'agent' ? '/api/ai/manus/chat' : '/api/ai/love_app/chat/server_sent_event'
  const params = new URLSearchParams({ message: prompt })
  if (mode === 'chat') params.set('chatId', chatId)
  const response = await fetch(`${endpoint}?${params}`, { signal, headers: { Accept: 'text/event-stream' } })
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? '模型服务鉴权失败，请检查后端配置的 API Key。'
      : `请求未能完成（HTTP ${response.status}），请检查后端服务和模型配置。`
    throw new Error(message)
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error('服务未返回预期的流式响应，请检查接口配置。')
  }
  await readEvents(response.body, ({ event, data }) => {
    if (event === 'error') throw new Error('服务执行出错，请查看后端日志。')
    if (data !== '[DONE]') onEvent(data)
  })
}
