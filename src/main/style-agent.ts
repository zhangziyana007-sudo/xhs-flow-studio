/**
 * style-agent.ts — 样式/模板步骤 Agent
 */

import { runAgentLoop, ToolDef, AgentMessage } from './pipeline-agent'
import { getTask, upsertTask } from './task-store'
import { executeTaskStep } from './task-executor'

const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'list_templates',
      description: '列出所有可用模板',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'select_template',
      description: '选择/切换模板',
      parameters: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            enum: ['ai-daily', 'knowledge-card'],
            description: '模板名称'
          }
        },
        required: ['template']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_render',
      description: '执行渲染（将 AI 生成的内容渲染为 HTML 页面）',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_config',
      description: '获取当前样式/模板配置',
      parameters: { type: 'object', properties: {} }
    }
  }
]

const SYSTEM_PROMPT = `你是 FlowStudio 样式/模板步骤的配置助手，可以直接帮用户操作模板配置。

当前步骤的功能：将 AI 生成的结构化内容，套用 HTML 模板渲染为可视化页面。

可用模板：
- **ai-daily** (Tech Neon): 黑底荧光绿终端风格，适合科技新闻日报
- **knowledge-card** (知识卡片): 简洁现代渐变紫风格，适合知识点展示

可执行操作：
- 列出模板、选择模板、执行渲染

操作原则：
- 理解用户需求后直接操作
- 用中文回复`

export async function runStyleAgent(
  taskId: string,
  userMessage: string,
  history: AgentMessage[] = []
) {
  const task = await getTask(taskId)
  if (!task) return { reply: '任务不存在', actions: [] }

  const executor = async (name: string, args: any) => {
    const t = (await getTask(taskId))!
    switch (name) {
      case 'list_templates':
        return {
          templates: [
            { id: 'ai-daily', name: 'Tech Neon', desc: '黑底 · 荧光绿 · 终端风' },
            { id: 'knowledge-card', name: '知识卡片', desc: '简洁现代 · 渐变紫 · 教学风' }
          ]
        }
      case 'select_template':
        t.pipeline.style = { ...t.pipeline.style, templateId: args.template }
        t.updatedAt = Date.now()
        await upsertTask(t)
        return { success: true, message: `模板已切换为「${args.template}」` }
      case 'run_render':
        try {
          const result = await executeTaskStep(taskId, 'render')
          return { success: true, message: '渲染完成', ...result }
        } catch (err: any) {
          return { error: err.message }
        }
      case 'get_current_config':
        return {
          template: t.pipeline.style?.templateId || 'ai-daily',
          message: `当前使用模板: ${t.pipeline.style?.templateId || 'ai-daily'}`
        }
      default:
        return { error: `未知工具: ${name}` }
    }
  }

  return runAgentLoop(SYSTEM_PROMPT, TOOLS, userMessage, history, executor)
}
