/**
 * source-agent.ts — 数据源配置 AI Agent
 *
 * 使用 Function Calling 实现真正的操作能力：
 * AI 不只是建议，而是直接帮用户操作数据源配置
 */

import { loadSettings } from './task-store'
import { getTask, upsertTask } from './task-store'
import type { Task, SourceCard } from '../shared/types'

/** Agent 可调用的工具定义 */
const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'add_source_card',
      description: '添加一个新的数据源卡片到当前任务',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '数据源名称' },
          type: {
            type: 'string',
            enum: ['api-fetch', 'url-scrape', 'rss', 'ai-search', 'manual-text'],
            description: '数据源类型'
          },
          runMode: { type: 'string', enum: ['auto', 'manual'], description: '运行模式' },
          config: {
            type: 'object',
            description: '数据源配置参数',
            properties: {
              apiUrl: { type: 'string' },
              category: { type: 'string' },
              sinceHours: { type: 'number' },
              minCount: { type: 'number' },
              urls: { type: 'array', items: { type: 'string' } },
              feedUrl: { type: 'string' },
              llmBaseUrl: { type: 'string' },
              llmApiKey: { type: 'string' },
              llmModel: { type: 'string' },
              searchPrompt: { type: 'string' },
              enableWebSearch: { type: 'boolean' },
              text: { type: 'string' }
            }
          },
          outputFormat: {
            type: 'object',
            description: '输出格式规范',
            properties: {
              type: { type: 'string', enum: ['news-list', 'text', 'structured'] },
              description: { type: 'string' },
              parsePrompt: { type: 'string' }
            }
          }
        },
        required: ['name', 'type', 'config']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'remove_source_card',
      description: '删除指定的数据源卡片',
      parameters: {
        type: 'object',
        properties: {
          card_id: { type: 'string', description: '要删除的卡片 ID' },
          card_name: { type: 'string', description: '要删除的卡片名称（模糊匹配）' }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_source_card',
      description: '更新已有数据源卡片的配置',
      parameters: {
        type: 'object',
        properties: {
          card_id: { type: 'string', description: '卡片 ID' },
          card_name: { type: 'string', description: '卡片名称（用于匹配）' },
          updates: {
            type: 'object',
            description: '要更新的字段',
            properties: {
              name: { type: 'string' },
              runMode: { type: 'string', enum: ['auto', 'manual'] },
              config: { type: 'object' },
              outputFormat: { type: 'object' }
            }
          }
        },
        required: ['updates']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_source_cards',
      description: '列出当前任务已配置的所有数据源卡片',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_task_info',
      description: '设置任务名称和描述',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '任务名称' },
          description: { type: 'string', description: '任务描述' }
        }
      }
    }
  }
]

const SYSTEM_PROMPT = `你是 FlowStudio 数据源配置助手，拥有直接操作能力。你可以通过工具调用来帮用户配置数据源，而不仅仅是给建议。

当前系统支持以下数据源类型：
1. **api-fetch**: 从 aihot.virxact.com API 拉取新闻
   - config: { apiUrl, category(ai-models/ai-coding/ai-agents/ai-products/industry/papers), sinceHours, minCount }
   - outputFormat: { type: "news-list" }

2. **ai-search**: 调用 LLM API 联网搜索（如 Grok、DeepSeek）
   - config: { llmBaseUrl(如 https://api.x.ai/v1), llmModel(如 grok-3), llmApiKey(留空让用户填), searchPrompt, enableWebSearch }
   - outputFormat: { type: "news-list" 或 "structured", parsePrompt: "输出格式指令" }

3. **url-scrape**: 抓取网页内容
   - config: { urls: ["url1", "url2"] }

4. **rss**: RSS 订阅
   - config: { feedUrl }

5. **manual-text**: 手动文本
   - config: { text }

操作原则：
- 用户描述需求后，直接调用工具执行操作（添加/修改/删除数据源）
- 操作完成后简短告知用户做了什么
- 如果用户需求不明确，先问清楚再操作
- 对 ai-search 类型：llmApiKey 留空让用户手动填写，用 searchPrompt 描述搜索内容
- 输出格式 parsePrompt 要具体，确保 AI 搜索结果是结构化的

用中文回复用户。`

/** Agent 对话消息 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
}

/** Agent 执行结果 */
export interface AgentResult {
  reply: string
  actions: { tool: string; args: any; result: any }[]
  updatedTask?: Task
}

/** 执行 Agent 对话（含工具调用循环） */
export async function runSourceAgent(
  taskId: string,
  userMessage: string,
  history: AgentMessage[] = []
): Promise<AgentResult> {
  const settings = await loadSettings()
  const apiKey = settings.deepseekApiKey
  if (!apiKey) {
    return { reply: '请先在设置中配置 DeepSeek API Key', actions: [] }
  }

  const baseUrl = settings.aiBaseUrl || 'https://api.deepseek.com'
  const model = settings.aiModel || 'deepseek-chat'

  let task = await getTask(taskId)
  if (!task) {
    return { reply: '任务不存在', actions: [] }
  }

  // 构建消息列表
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage }
  ]

  const actions: { tool: string; args: any; result: any }[] = []
  const maxIterations = 5  // 防止无限循环

  for (let i = 0; i < maxIterations; i++) {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.3
      })
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return { reply: `AI 调用失败: ${resp.status} ${errText.slice(0, 200)}`, actions }
    }

    const data: any = await resp.json()
    const choice = data.choices?.[0]
    const assistantMessage = choice?.message

    if (!assistantMessage) {
      return { reply: 'AI 无响应', actions }
    }

    // 如果没有工具调用，返回文本回复
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        reply: assistantMessage.content || '完成',
        actions,
        updatedTask: task
      }
    }

    // 有工具调用 → 执行并继续循环
    messages.push(assistantMessage)

    for (const toolCall of assistantMessage.tool_calls) {
      const fn = toolCall.function
      const args = JSON.parse(fn.arguments || '{}')
      let result: any

      try {
        // 重新加载最新的 task
        task = (await getTask(taskId))!

        switch (fn.name) {
          case 'add_source_card':
            result = await toolAddSourceCard(task, args)
            break
          case 'remove_source_card':
            result = await toolRemoveSourceCard(task, args)
            break
          case 'update_source_card':
            result = await toolUpdateSourceCard(task, args)
            break
          case 'list_source_cards':
            result = toolListSourceCards(task)
            break
          case 'set_task_info':
            result = await toolSetTaskInfo(task, args)
            break
          default:
            result = { error: `未知工具: ${fn.name}` }
        }
      } catch (err: any) {
        result = { error: err.message }
      }

      actions.push({ tool: fn.name, args, result })
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      })
    }
  }

  return { reply: '操作已完成（达到最大迭代次数）', actions, updatedTask: task }
}

// ── 工具实现 ──────────────────────────────────────

async function toolAddSourceCard(task: Task, args: any): Promise<any> {
  const card: SourceCard = {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: args.name || '新数据源',
    type: args.type || 'api-fetch',
    runMode: args.runMode || 'auto',
    config: args.config || {},
    outputFormat: args.outputFormat || undefined
  }
  task.pipeline.source.cards.push(card)
  task.updatedAt = Date.now()
  await upsertTask(task)
  return { success: true, cardId: card.id, message: `已添加数据源「${card.name}」` }
}

async function toolRemoveSourceCard(task: Task, args: any): Promise<any> {
  const cards = task.pipeline.source.cards
  let idx = -1
  if (args.card_id) {
    idx = cards.findIndex(c => c.id === args.card_id)
  } else if (args.card_name) {
    idx = cards.findIndex(c => c.name.includes(args.card_name))
  }
  if (idx === -1) return { error: '未找到匹配的数据源卡片' }
  const removed = cards.splice(idx, 1)[0]
  task.updatedAt = Date.now()
  await upsertTask(task)
  return { success: true, message: `已删除数据源「${removed.name}」` }
}

async function toolUpdateSourceCard(task: Task, args: any): Promise<any> {
  const cards = task.pipeline.source.cards
  let card: SourceCard | undefined
  if (args.card_id) {
    card = cards.find(c => c.id === args.card_id)
  } else if (args.card_name) {
    card = cards.find(c => c.name.includes(args.card_name))
  }
  if (!card) return { error: '未找到匹配的数据源卡片' }

  const updates = args.updates || {}
  if (updates.name) card.name = updates.name
  if (updates.runMode) card.runMode = updates.runMode
  if (updates.config) card.config = { ...card.config, ...updates.config }
  if (updates.outputFormat) card.outputFormat = { ...card.outputFormat, ...updates.outputFormat }

  task.updatedAt = Date.now()
  await upsertTask(task)
  return { success: true, message: `已更新数据源「${card.name}」` }
}

function toolListSourceCards(task: Task): any {
  const cards = task.pipeline.source.cards
  if (cards.length === 0) return { cards: [], message: '当前没有配置数据源' }
  return {
    cards: cards.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      runMode: c.runMode,
      config: c.config,
      outputFormat: c.outputFormat
    })),
    message: `当前有 ${cards.length} 个数据源`
  }
}

async function toolSetTaskInfo(task: Task, args: any): Promise<any> {
  if (args.name) task.name = args.name
  if (args.description) task.description = args.description
  task.updatedAt = Date.now()
  await upsertTask(task)
  return { success: true, message: `任务信息已更新: ${task.name}` }
}
