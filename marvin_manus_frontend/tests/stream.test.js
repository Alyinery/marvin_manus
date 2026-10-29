import test from 'node:test'
import assert from 'node:assert/strict'
import { readEvents, classifyEvent } from '../src/lib/stream.js'

function stream(chunks) { return new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close() } }) }
test('preserves UTF-8 split across packets, CRLF boundaries, multiline data and leading spaces', async () => {
  const bytes = new TextEncoder().encode(': ping\r\ndata: 中文\r\ndata:  保留空格\r\n\r\nevent: message\ndata: done\n\n')
  const chunks = [...bytes].map(b => new Uint8Array([b]))
  const events = []
  await readEvents(stream(chunks), e => events.push(e))
  assert.deepEqual(events, [{ event: 'message', data: '中文\n 保留空格' }, { event: 'message', data: 'done' }])
})
test('does not turn truncated frames into successful messages', async () => {
  await assert.rejects(readEvents(stream([new TextEncoder().encode('data: unfinished')]), () => assert.fail()), /中断/)
})
test('reports execution errors and step limit separately from normal steps', () => {
  assert.equal(classifyEvent('Step 2: 工具 search 返回的结果：ok'), 'step')
  assert.equal(classifyEvent('Step 3: 步骤执行失败：timeout'), 'error')
  assert.equal(classifyEvent('执行结束：达到最大步骤（20）'), 'limit')
})
