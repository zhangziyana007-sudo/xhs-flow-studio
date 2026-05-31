/**
 * trigger-agent.ts — 触发/定时步骤 Agent
 */

import { runAgentLoop, ToolDef, AgentMessage } from './pipeline-agent'
import { getTask, upsertTask } from './task-store'

const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'set_cron',
      description: '设置 cron 表达式定时任务',
      parameters: {
        type: 'object',
        properties: {
          cron: { type: 'string', description: 'cron 表达式（5 段：分 时 日 月 周）' }
        },
        required: ['cron']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_enabled',
      description: '开启/关闭定时任务',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'true=开启, false=关闭' }
        },
        required: ['enabled']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'use_preset',
      description: '使用预设定时方案',
      parameters: {
        type: 'object',
        properties: {
          preset: {
            type: 'string',
            enum: ['every-morning', 'every-evening', 'twice-daily', 'every-hour', 'custom'],
            description: '预设方案'
          }
        },
        required: ['preset']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_config',
      description: '获取当前触发配置',
      parameters: { type: 'object', properties: {} }
    }
  }
]

const PRESETS: Record<string, { cron: string; desc: string }> = {
  'every-morning': { cron: '0 8 * * *', desc: '每天早上 8:00' },
  'every-evening': { cron: '0 20 * * *', desc: '每天晚上 20:00' },
  'twice-daily': { cron: '0 8,20 * * *', desc: '每天 8:00 和 20:00' },
  'every-hour': { cron: '0 * * * *', desc: '每小时整点' }
}

const SYSTEM_PROMPT = `你是 FlowStudio 触发/定时步骤的配置助手，可以直接帮用户设置定时任务。

当前步骤的功能：配置任务的自动执行时间，支持 cron 表达式或预设方案。

预设方案：
- **every-morning**: 每天早上 8:00
- **every-evening**: 每天晚上 20:00
- **twice-daily**: 每天 8:00 和 20:00
- **every-hour**: 每小时整点

Cron 表达式格式：分 时 日 月 周（5 段）
- 例：\`30 9 * * 1-5\` = 工作日 9:30
- 例：\`0 */2 * * *\` = 每 2 小时

操作原则：
- 用户说"每天早上"就直接设 every-morning
- 用户给出具体时间就转换为 cron
- 直接操作，用中文回复`

export async function runTriggerAgent(
  taskId: string,
  userMessage: string,
  history: AgentMessage[] = []
) {
  const task = await getTask(taskId)
  if (!task) return { reply: '任务不存在', actions: [] }

  const executor = async (name: string, args: any) => {
    const t = (await getTask(taskId))!
    if (!t.trigger) {
      t.trigger = { type: 'scheduled', enabled: false, cron: '' }
    }

    switch (name) {
      case 'set_cron':
        t.trigger.cron = args.cron
        t.trigger.type = 'scheduled'
        t.updatedAt = Date.now()
        await upsertTask(t)
        return { success: true, message: `定时表达式已设为「${args.cron}」` }
      case 'set_enabled':
        t.trigger.enabled = args.enabled
        t.updatedAt = Date.now()
        await upsertTask(t)
        return { success: true, message: args.enabled ? '定时任务已开启' : '定时任务已关闭' }
      case 'use_preset': {
        const preset = PRESETS[args.preset]
        if (!preset) return { error: '未知预设' }
        t.trigger.cron = preset.cron
        t.trigger.type = 'scheduled'
        t.trigger.enabled = true
        t.updatedAt = Date.now()
        await upsertTask(t)
        return { success: true, message: `已设为「${preset.desc}」并开启` }
      }
      case 'get_current_config':
        return {
          enabled: t.trigger.enabled ?? false,
          cron: t.trigger.cron || '(未设置)',
          type: t.trigger.type,
          message: t.trigger.enabled
            ? `已开启，执行时间: ${t.trigger.cron}`
            : '定时任务未开启'
        }
      default:
        return { error: `未知工具: ${name}` }
    }
  }

  return runAgentLoop(SYSTEM_PROMPT, TOOLS, userMessage, history, executor)
}
