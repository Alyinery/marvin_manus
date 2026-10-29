<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './components/Icon.vue'
import { checkHealth, runRequest } from './lib/api.js'
import { classifyEvent } from './lib/stream.js'

const STORAGE = 'marvin.manus.workspace.v1'
const sessions = ref(loadSessions())
const selectedId = ref(null)
const mode = ref('agent')
const draft = ref('')
const busy = ref(false)
const online = ref(null)
const checking = ref(false)
const showHelp = ref(false)
const mobileOpen = ref(false)
const toast = ref('')
const composer = ref(null)
const helpDialog = ref(null)
const log = ref(null)
const lastModeButton = ref(null)
let controller, healthTimer, toastTimer
let storageWarned = false
const current = computed(() => sessions.value.find(s => s.id === selectedId.value))
const messages = computed(() => current.value?.messages || [])
const title = computed(() => mode.value === 'agent' ? '任务助手' : '情感对话')
const suggestions = computed(() => mode.value === 'agent' ? [
  { icon: 'search', title: '让信息更有条理', description: '搜索资料，整理关键观点', prompt: '搜索最近的 AI Agent 应用案例，整理 3 个案例的用途、特点和来源链接。' },
  { icon: 'globe', title: '读懂一个网页', description: '提取网页信息，生成摘要', prompt: '读取这个网页并总结主要观点、关键数据和适用场景：' },
  { icon: 'file', title: '把想法变成文档', description: '组织内容，生成 PDF', prompt: '帮我制定一份为期 7 天的 Java 学习计划，并生成 PDF 文档。' }
] : [
  { icon: 'chat', title: '聊聊沟通中的困扰', description: '梳理感受，找到表达方式', prompt: '我想改善和伴侣的沟通，能帮我一起梳理最近的困扰吗？' },
  { icon: 'spark', title: '了解自己的需要', description: '从真实经历开始聊起', prompt: '我不太清楚自己在亲密关系中最看重什么，能引导我思考一下吗？' },
  { icon: 'layers', title: '一起整理思路', description: '把复杂的问题慢慢说清', prompt: '最近有一件感情上的事让我很纠结，我想先讲讲事情的经过。' }
])
const tools = [
  { icon: 'search', title: '联网搜索', description: '搜索引擎信息检索' },
  { icon: 'globe', title: '网页阅读', description: '获取网页正文内容' },
  { icon: 'folder', title: '文件操作', description: '本地文件读取与写入' },
  { icon: 'download', title: '资源下载', description: '将资源保存到本机' },
  { icon: 'file', title: 'PDF 文档', description: '组织内容并生成文档' },
  { icon: 'terminal', title: '终端执行', description: '运行本机终端命令' }
]
const id = () => crypto.randomUUID()
function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter(s => typeof s.id === 'string' && ['agent', 'chat'].includes(s.mode) && typeof s.title === 'string' && Array.isArray(s.messages)).slice(0, 20).map(s => ({ ...s, messages: s.messages.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.text === 'string' && Array.isArray(m.steps)).map(m => ({ ...m, status: m.status === 'running' ? 'interrupted' : m.status })) }))
  } catch { return [] }
}
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify(sessions.value.slice(0, 20))) }
  catch { if (!storageWarned) { notify('浏览器存储空间不足，本次记录暂时只保存在页面中。'); storageWarned = true } }
}
function notify(text) { toast.value = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = '' }, 4200) }
function startNew(nextMode = mode.value) {
  if (busy.value) return
  selectedId.value = null; mode.value = nextMode; draft.value = ''; mobileOpen.value = false
  nextTick(() => composer.value?.focus())
}
function selectSession(session) {
  if (busy.value) return
  selectedId.value = session.id; mode.value = session.mode; draft.value = ''; mobileOpen.value = false
}
function removeSession(session) {
  if (busy.value) return
  sessions.value = sessions.value.filter(s => s.id !== session.id)
  if (selectedId.value === session.id) startNew()
  persist()
}
function useSuggestion(prompt) { draft.value = prompt; nextTick(() => composer.value?.focus()) }
async function refreshHealth() {
  if (checking.value) return
  checking.value = true; online.value = await checkHealth(); checking.value = false
}
async function scrollToBottom() {
  await nextTick()
  if (log.value) log.value.scrollTop = log.value.scrollHeight
}
async function submit() {
  const prompt = draft.value.trim()
  if (!prompt || busy.value) return
  if (prompt.length > 3000) { notify('请将单次输入控制在 3000 字以内。'); return }
  if (!current.value) {
    const session = { id: id(), mode: mode.value, title: prompt.slice(0, 26), createdAt: Date.now(), messages: [] }
    sessions.value.unshift(session); sessions.value = sessions.value.slice(0, 20); selectedId.value = session.id
  }
  const session = current.value
  const message = { id: id(), role: 'assistant', text: '', steps: [], status: 'running', startedAt: Date.now(), error: '' }
  session.messages.push({ id: id(), role: 'user', text: prompt, steps: [] }, message)
  // Use the reactive proxy so arriving chunks update the view immediately.
  const result = session.messages.at(-1)
  draft.value = ''; busy.value = true; controller = new AbortController(); persist(); scrollToBottom()
  let received = false
  try {
    await runRequest({ mode: session.mode, prompt, chatId: session.id, signal: controller.signal, onEvent: text => {
      received = true
      if (session.mode === 'agent') {
        const match = /^Step\s+(\d+):\s*([\s\S]*)$/i.exec(text)
        const kind = classifyEvent(text)
        result.steps.push({ number: match ? Number(match[1]) : null, text: match ? match[2] : text, kind })
        if (kind === 'error') result.status = 'error'
        if (kind === 'limit' && result.status !== 'error') result.status = 'limit'
      } else result.text += text
      scrollToBottom()
    } })
    if (!received) throw new Error('连接已结束，但没有收到内容，请检查模型配置后重试。')
    if (result.status === 'running') result.status = 'done'
  } catch (error) {
    if (error.name === 'AbortError') {
      result.status = 'stopped'
      result.error = '已停止接收。后台任务可能仍在执行。'
    } else {
      result.status = 'error'
      result.error = error.message === 'Failed to fetch' ? '连接中断或服务不可用，请检查后端后重试。' : error.message
    }
  } finally {
    result.finishedAt = Date.now(); busy.value = false; controller = null; persist(); scrollToBottom()
  }
}
function keydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit() }
}
function label(status) { return ({ running: '执行中', done: '响应结束', error: '需要检查', stopped: '已停止接收', interrupted: '上次连接中断', limit: '达到步数上限' })[status] || '已记录' }
function duration(message) { return `${Math.max(1, Math.round(((message.finishedAt || Date.now()) - message.startedAt) / 1000))} 秒` }
function dateLabel(timestamp) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(timestamp) }
async function copy(message) {
  const text = message.text || message.steps.map(s => `${s.number ? `步骤 ${s.number}\n` : ''}${s.text}`).join('\n\n')
  try { await navigator.clipboard.writeText(text); notify('内容已复制') } catch { notify('无法访问剪贴板，请选中文字复制。') }
}
function retry(index) { const prior = messages.value.slice(0, index).findLast(m => m.role === 'user'); if (prior) { draft.value = prior.text; composer.value?.focus() } }
function openHelp(event) { lastModeButton.value = event.currentTarget; showHelp.value = true }
function closeHelp() { showHelp.value = false; nextTick(() => lastModeButton.value?.focus()) }
function trapFocus(event) {
  if (event.key === 'Escape') { closeHelp(); return }
  if (event.key !== 'Tab') return
  const elements = [...helpDialog.value.querySelectorAll('button, a[href]')]
  if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1).focus() }
  else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus() }
}
watch(showHelp, async value => { if (value) { await nextTick(); helpDialog.value?.querySelector('button')?.focus() } })
onMounted(() => { refreshHealth(); healthTimer = setInterval(refreshHealth, 30000) })
onBeforeUnmount(() => { controller?.abort(); clearInterval(healthTimer); clearTimeout(toastTimer) })
</script>

<template>
  <div class="workspace">
    <div v-if="mobileOpen" class="sidebar-scrim" @click="mobileOpen = false"></div>
    <aside class="sidebar" :class="{ open: mobileOpen }" aria-label="工作空间导航">
      <a class="brand" href="#" @click.prevent="startNew('agent')" aria-label="Marvin Manus 首页">
        <span class="brand-mark"><svg viewBox="0 0 32 32" fill="none"><path d="M6 24V8l10 10L26 8v16" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        <span class="brand-name">Marvin<span>MANUS WORKSPACE</span></span>
      </a>
      <button class="new-task" :disabled="busy" @click="startNew()"><Icon name="plus" :size="18" /> 新建{{ mode === 'agent' ? '任务' : '对话' }}<span>＋</span></button>
      <p class="nav-label">工作空间</p>
      <nav>
        <button :class="{ active: mode === 'agent' }" :disabled="busy" @click="startNew('agent')"><Icon name="grid" />任务助手<span class="nav-dot" v-if="mode === 'agent'"></span></button>
        <button :class="{ active: mode === 'chat' }" :disabled="busy" @click="startNew('chat')"><Icon name="chat" />情感对话<span class="nav-dot" v-if="mode === 'chat'"></span></button>
      </nav>
      <div class="history-heading"><span class="nav-label">最近记录</span><span>{{ sessions.length.toString().padStart(2, '0') }}</span></div>
      <div class="history-list">
        <div v-if="!sessions.length" class="history-empty"><Icon name="clock" :size="19" /><span>从第一个任务开始<br><small>最近记录会保存在这里</small></span></div>
        <div v-for="session in sessions" :key="session.id" class="history-item" :class="{ selected: selectedId === session.id }">
          <button class="history-select" :disabled="busy" @click="selectSession(session)" :title="session.title"><Icon :name="session.mode === 'agent' ? 'layers' : 'chat'" :size="16" /><span>{{ session.title }}</span></button>
          <button class="delete-history" :disabled="busy" :aria-label="`删除记录：${session.title}`" @click="removeSession(session)"><Icon name="x" :size="14" /></button>
        </div>
      </div>
      <div class="sidebar-bottom"><div class="local-note"><Icon name="info" :size="15" /><span>记录仅保存在当前浏览器</span></div><div class="profile"><span class="avatar">M</span><div><strong>我的工作空间</strong><small>LOCAL WORKSPACE</small></div><span class="profile-dot"></span></div></div>
    </aside>

    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumbs"><button class="icon-button mobile-menu" aria-label="打开导航" @click="mobileOpen = true"><Icon name="menu" /></button><span class="crumb-root">工作空间</span><Icon name="chevron" :size="13" /><strong>{{ title }}</strong></div>
        <div class="topbar-actions"><button class="connection" :class="{ offline: online === false }" @click="refreshHealth" :disabled="checking" title="检查后端连接，连接正常不代表模型配置就绪"><span class="status-dot" :class="{ checking }"></span>{{ checking ? '检查连接' : online ? '后端已连接' : '后端未连接' }}<Icon name="refresh" :size="12" /></button><span class="top-divider"></span><button class="help-button" @click="openHelp"><Icon name="help" :size="17" /><span>使用说明</span></button></div>
      </header>

      <main class="main-content" :class="{ 'has-messages': messages.length }">
        <section v-if="!messages.length" class="welcome">
          <div class="welcome-copy"><span class="eyebrow"><span></span> A LITTLE LESS WORK. A LITTLE MORE POSSIBILITY.</span><h1 v-if="mode === 'agent'">把想法，<span>交给行动。</span></h1><h1 v-else>留一点空间，<span>聊聊自己。</span></h1><p>{{ mode === 'agent' ? '从一个目标开始，让助手调用工具、整理信息，陪你把事情做完。' : '说说你的经历与感受，在连续对话中梳理亲密关系里的困扰。' }}</p></div>
          <div class="hero-symbol" aria-hidden="true"><span class="orbit"></span><span class="hero-core"><Icon :name="mode === 'agent' ? 'spark' : 'chat'" :size="38" /></span><span class="orbit-small one"><Icon name="file" :size="16" /></span><span class="orbit-small two"><Icon name="search" :size="16" /></span><span class="orbit-small three"><Icon name="check" :size="15" /></span></div>
        </section>

        <div v-if="online === false" class="connection-banner" role="status"><Icon name="info" :size="17" /><span>后端暂时无法连接。启动服务后，点击右上角重新检查。</span></div>

        <section v-if="messages.length" class="conversation" aria-label="任务记录">
          <div class="conversation-heading"><div><span class="eyebrow">{{ mode === 'agent' ? 'TASK ACTIVITY' : 'CONVERSATION' }}</span><h1>{{ current.title }}</h1></div><span class="date-badge"><Icon name="clock" :size="14" />{{ dateLabel(current.createdAt) }}</span></div>
          <div ref="log" class="message-list" role="log" aria-label="执行结果" aria-live="polite" aria-relevant="additions text">
            <article v-for="(message, index) in messages" :key="message.id" class="message" :class="message.role">
              <div class="message-avatar" :class="message.role"><Icon v-if="message.role === 'assistant'" name="spark" :size="19" /><span v-else>M</span></div>
              <div class="message-body"><div class="message-header"><strong>{{ message.role === 'user' ? '你' : 'Marvin Manus' }}</strong><template v-if="message.role === 'assistant'"><span class="run-status" :class="message.status"><span v-if="message.status === 'running'" class="tiny-spinner"></span>{{ label(message.status) }}</span><small v-if="message.finishedAt">{{ duration(message) }}</small></template></div>
                <p v-if="message.text" class="message-text">{{ message.text }}</p>
                <div v-if="message.steps.length" class="steps">
                  <details v-for="(step, stepIndex) in message.steps" :key="stepIndex" class="step" :class="step.kind" open><summary><span class="step-index">{{ step.number || '·' }}</span><strong>{{ step.number ? `执行步骤 ${step.number}` : '执行反馈' }}</strong><span>{{ step.kind === 'error' ? '出现错误' : step.kind === 'limit' ? '已达上限' : '已返回' }}</span><Icon name="chevron" :size="14" /></summary><pre>{{ step.text }}</pre></details>
                </div>
                <div v-if="message.status === 'running'" class="waiting"><span class="loading-dots"><i></i><i></i><i></i></span>{{ mode === 'agent' ? '正在等待下一步结果…' : '正在回复…' }}</div>
                <p v-if="message.error" class="error-message" role="alert"><Icon name="info" :size="16" />{{ message.error }}</p>
                <div v-if="message.role === 'assistant' && message.status !== 'running'" class="message-actions"><button v-if="message.text || message.steps.length" @click="copy(message)"><Icon name="copy" :size="14" />复制内容</button><button v-if="['error','interrupted','stopped','limit'].includes(message.status)" :disabled="busy" @click="retry(index)"><Icon name="refresh" :size="14" />重新编辑请求</button></div>
              </div>
            </article>
          </div>
        </section>

        <form class="composer" :class="{ compact: messages.length }" @submit.prevent="submit">
          <label class="sr-only" for="prompt">{{ mode === 'agent' ? '任务目标' : '对话内容' }}</label>
          <textarea id="prompt" ref="composer" v-model="draft" :disabled="busy" maxlength="3000" :rows="messages.length ? 2 : 4" @keydown="keydown" :placeholder="mode === 'agent' ? '想完成什么？描述你的目标，或者从下面的灵感开始…' : '今天想聊些什么？你可以从一件具体的事情开始…'"></textarea>
          <div class="composer-bottom"><div class="composer-mode"><Icon :name="mode === 'agent' ? 'spark' : 'chat'" :size="16" /><strong>{{ mode === 'agent' ? 'Agent 任务' : '连续对话' }}</strong><span class="mode-divider"></span><span>{{ mode === 'agent' ? '自主调用工具' : '保留本次对话上下文' }}</span></div><button v-if="busy" type="button" class="stop-button" @click="controller?.abort()" title="关闭当前连接，后台任务可能仍在执行"><Icon name="stop" :size="15" />停止接收</button><button v-else class="submit-button" :disabled="!draft.trim()" type="submit"><span>{{ mode === 'agent' ? '开始任务' : '发送消息' }}</span><Icon name="send" :size="17" /></button></div>
        </form>
        <div class="composer-hint"><span>{{ mode === 'agent' ? '每次提交为独立任务，最多执行 20 步。' : '当前接入情感咨询对话，历史上下文在后端内存中保存。' }}</span><span class="keyboard-hint"><kbd>Enter</kbd> 发送 · <kbd>Shift Enter</kbd> 换行</span></div>

        <template v-if="!messages.length">
          <section class="suggestion-section"><div class="section-heading"><h2>不知道从哪里开始？</h2><span>试试这些灵感</span></div><div class="suggestions"><button v-for="suggestion in suggestions" :key="suggestion.title" class="suggestion" @click="useSuggestion(suggestion.prompt)"><span class="suggestion-icon"><Icon :name="suggestion.icon" :size="21" /></span><Icon class="suggestion-arrow" name="arrow" :size="17" /><h3>{{ suggestion.title }}</h3><p>{{ suggestion.description }}</p></button></div></section>
          <section v-if="mode === 'agent'" class="tools-section"><div class="section-heading"><h2>从目标到结果，一起完成</h2><span class="tool-count">6 类可调用工具</span></div><div class="tool-grid"><div v-for="tool in tools" :key="tool.title" class="tool-item"><Icon :name="tool.icon" :size="19" /><div><h3>{{ tool.title }}</h3><p>{{ tool.description }}</p></div></div></div><p class="tools-note">联网搜索需要配置搜索服务；生成的文件保存在后端所在电脑。</p></section>
          <div v-else class="chat-note"><Icon name="chat" :size="22" /><div><strong>慢慢说，没关系。</strong><p>同一对话会沿用上下文。想换一个话题，可以点击「新建对话」。</p></div></div>
          <footer class="workspace-footer"><span class="footer-line"></span><Icon name="spark" :size="14" /><span>让复杂的事情，从一句话开始。</span><span class="footer-line"></span></footer>
        </template>
      </main>
    </div>

    <div v-if="toast" class="toast" role="status"><Icon name="info" :size="16" />{{ toast }}</div>
    <div v-if="showHelp" class="modal-backdrop" @click.self="closeHelp"><section ref="helpDialog" class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" @keydown="trapFocus"><div class="dialog-heading"><span class="eyebrow">GETTING STARTED</span><button class="icon-button" aria-label="关闭使用说明" @click="closeHelp"><Icon name="x" /></button></div><h2 id="help-title">一个目标，就可以开始。</h2><div class="help-item"><span>01</span><div><h3>说清目标与期望结果</h3><p>任务助手可以搜索、读写文件、下载资源、生成 PDF 和执行本机命令。请明确描述需要处理的内容与范围。</p></div></div><div class="help-item"><span>02</span><div><h3>跟随执行进展</h3><p>页面会展示后端返回的每一步结果。响应结束仅代表本次连接结束，请根据结果确认任务是否完成。</p></div></div><div class="help-item"><span>03</span><div><h3>继续交流或开始新任务</h3><p>情感对话支持连续上下文；Agent 每次提交都是独立任务。历史记录保存在当前浏览器，删除记录不会删除后端生成的文件。</p></div></div><div class="help-footnote"><Icon name="info" :size="17" /><p>后端连接正常后仍需要有效的模型配置。停止接收会关闭页面连接，不能保证取消后台任务。当前页面未接入知识库检索和文件下载接口。</p></div><button class="dialog-done" @click="closeHelp">开始使用<Icon name="arrow" :size="17" /></button></section></div>
  </div>
</template>
