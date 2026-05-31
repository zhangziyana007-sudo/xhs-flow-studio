/**
 * generate-agent.ts — AI 创作步骤 Agent
 */

import { runAgentLoop, ToolDef, AgentMessage } from './pipeline-agent'
import { getTask, upsertTask } from './task-store'

const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'set_generate_mode',
      description: '设置 AI 创作模式',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['daily-report', 'knowledge-extract', 'custom'],
            description: '创作模式：daily-report(日报整合), knowledge-extract(知识提取), custom(自定义)'
          }
        },
        required: ['mode']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_model',
      description: '设置使用的 AI 模型',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: '模型名称（如 deepseek-chat, gpt-4o）' }
        },
        required: ['model']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_prompt',
      description: '设置/修改创作提示词',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '创作提示词内容' }
        },
        required: ['prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_temperature',
      description: '设置创作温度（创意程度）',
      parameters: {
        type: 'object',
        properties: {
          temperature: { type: 'number', description: '温度值 0-1，越高越有创意' }
        },
        required: ['temperature']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_config',
      description: '获取当前 AI 创作配置',
      parameters: { type: 'object', properties: {} }
    }
  }
]

const SYSTEM_PROMPT = `你是 FlowStudio AI 创作步骤的配置助手，可以直接帮用户操作 AI 创作配置。

当前步骤的功能：将上一步获取的素材，通过 AI 整合生成结构化内容。

可配置项：
- **模式**: daily-report(日报整合：将多条新闻整合为日报), knowledge-extract(知识提取：从素材提取知识点), custom(自定义：完全由 prompt 决定)
- **模型**: 默认 deepseek-chat，支持任何 OpenAI 兼容模型
- **提示词**: 告诉 AI 如何处理素材、输出什么格式
- **温度**: 0-1，控制创作的随机性

操作原则：
- 理解用户需求后直接调用工具修改配置
- 如果用户需求不明确，问清楚再操作
- 用中文回复`

export async function runGenerateAgent(
  taskId: string,
  userMessage: string,
  history: AgentMessage[] = []
) {
  const task = await getTask(taskId)
  if (!task) return { reply: '任务不存在', actions: [] }

  const executor = async (name: string, args: any) => {
    const t = (await getTask(taskId))!
    switch (name) {
      case 'set_generate_mode':
        t.pipeline.generate.mode = args.mode
        t.updatedAt = Date.now()
        await upsertTask(t)
        return { success: true, message: `创作模式已设为「${args.mode}」` }
      case 'set_model':
        t.pipeline.generate.model = args.model
        t.updatedAt = Date.now()
        await upsertTask(t)
        return { success: true, message: `模型已设为「${args.model}」` }
      case 'set_prompt':
        t.pipeline.generate.prompt = args.prompt
        t.updatedAt = Date.now()
        await upsertTask(t)
        return { success: true, message: `提示词已更新` }
      case 'set_temperature':
        t.pipeline.generate.temperature = Math.max(0, Math.min(1, args.temperature))
        t.updatedAt = Date.now()
        await upsertTask(t)
        return { success: true, message: `温度已设为 ${args.temperature}` }
      case 'get_current_config':
        return {
          mode: t.pipeline.generate.mode,
          model: t.pipeline.generate.model,
          prompt: t.pipeline.generate.prompt,
          temperature: t.pipeline.generate.temperature ?? 0.7
        }
      default:
        return { error: `未知工具: ${name}` }
    }
  }

  return runAgentLoop(SYSTEM_PROMPT, TOOLS, userMessage, history, executor)
}
