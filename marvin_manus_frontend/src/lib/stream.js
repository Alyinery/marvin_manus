/** Decode Spring SSE frames even when UTF-8 characters and line endings span chunks. */
export async function readEvents(stream, onEvent) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let data = []
  let event = 'message'
  function line(text) {
    if (text === '') {
      if (data.length) onEvent({ event, data: data.join('\n') })
      data = []
      event = 'message'
      return
    }
    if (text.startsWith(':')) return
    const colon = text.indexOf(':')
    const field = colon < 0 ? text : text.slice(0, colon)
    let value = colon < 0 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') data.push(value)
    if (field === 'event') event = value
  }
  function drain(final = false) {
    let match
    while ((match = /\r\n|\r|\n/.exec(buffer))) {
      if (!final && match[0] === '\r' && match.index === buffer.length - 1) break
      line(buffer.slice(0, match.index))
      buffer = buffer.slice(match.index + match[0].length)
    }
    if (final && buffer) { line(buffer); buffer = '' }
  }
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      drain()
    }
    buffer += decoder.decode()
    drain(true)
    // A connection that ends mid-frame is incomplete; never present it as a valid result.
    if (data.length) throw new Error('连接在完整结果返回前中断，请检查服务后重试。')
  } finally {
    try { await reader.cancel() } catch { /* the fetch may already have been aborted */ }
    reader.releaseLock()
  }
}

export function classifyEvent(text) {
  if (/执行错误|步骤执行失败|^错误[：:]|Error (reading|writing|generating|downloading|searching|scraping|executing)/i.test(text)) return 'error'
  if (/达到最大步骤|Reached max steps/i.test(text)) return 'limit'
  return 'step'
}
