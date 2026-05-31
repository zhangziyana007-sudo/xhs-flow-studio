/**
 * pipeline-agent.ts — 通用 Pipeline Agent 框架
 *
 * 各步骤 Agent 共用的 Function Calling 循环逻辑
 */

import { loadSettings } from './task-store'

export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: any
  }
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: any[]
  tool_call_id?: string
}

export interface AgentAction {
  tool: string
  args: any
  result: any
}

export interface AgentResult {
  reply: string
  actions: AgentAction[]
}

export type ToolExecutor = (name: string, args: any) => Promise<any>

/**
 * 通用 Agent 对话循环
 * @param systemPrompt - Agent 系统提示
 * @param tools - 可用工具列表
 * @param userMessage - 用户本轮消息
 * @param history - 对话历史
 * @param executor - 工具执行函数
 */
export async function runAgentLoop(
  systemPrompt: string,
  tools: ToolDef[],
  userMessage: string,
  history: AgentMessage[],
  executor: ToolExecutor
): Promise<AgentResult> {
  const settings = await loadSettings()
  const apiKey = settings.deepseekApiKey
  if (!apiKey) {
    return { reply: '请先在设置中配置 DeepSeek API Key', actions: [] }
  }

  const baseUrl = settings.aiBaseUrl || 'https://api.deepseek.com'
  const model = settings.aiModel || 'deepseek-chat'

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ]

  const actions: AgentAction[] = []
  const maxIterations = 5

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
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: 0.3
      })
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return { reply: `AI 调用失败: ${resp.status} ${errText.slice(0, 200)}`, actions }
    }

    const data: any = await resp.json()
    const assistantMessage = data.choices?.[0]?.message

    if (!assistantMessage) {
      return { reply: 'AI 无响应', actions }
    }

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return { reply: assistantMessage.content || '完成', actions }
    }

    messages.push(assistantMessage)

    for (const toolCall of assistantMessage.tool_calls) {
      const fn = toolCall.function
      let args: any
      try {
        args = JSON.parse(fn.arguments || '{}')
      } catch {
        args = {}
      }

      let result: any
      try {
        result = await executor(fn.name, args)
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

  return { reply: '操作已完成', actions }
}
