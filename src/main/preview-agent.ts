/**
 * preview-agent.ts — 预览/截图步骤 Agent
 */

import { runAgentLoop, ToolDef, AgentMessage } from './pipeline-agent'
import { getTask } from './task-store'
import { executeTaskStep } from './task-executor'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'run_screenshot',
      description: '执行截图（将 HTML 页面截图为 PNG 图片）',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_images',
      description: '列出当前任务已生成的图片',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_output_info',
      description: '获取输出目录信息',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_full_pipeline',
      description: '运行整个流程（素材获取 → AI 生成 → 渲染 → 截图）',
      parameters: { type: 'object', properties: {} }
    }
  }
]

const SYSTEM_PROMPT = `你是 FlowStudio 预览/截图步骤的助手，可以帮用户查看输出和执行截图操作。

当前步骤的功能：将渲染好的 HTML 页面通过 Playwright 截图为 3:4 比例的 PNG 图片（900×1200 @2x）。

可执行操作：
- 执行截图
- 列出已生成的图片
- 查看输出信息
- 运行完整流程

操作原则：
- 直接执行用户请求的操作
- 用中文回复`

export async function runPreviewAgent(
  taskId: string,
  userMessage: string,
  history: AgentMessage[] = []
) {
  const task = await getTask(taskId)
  if (!task) return { reply: '任务不存在', actions: [] }

  const executor = async (name: string, _args: any) => {
    const t = (await getTask(taskId))!
    switch (name) {
      case 'run_screenshot':
        try {
          const result = await executeTaskStep(taskId, 'screenshot')
          return { success: true, message: '截图完成', ...result }
        } catch (err: any) {
          return { error: err.message }
        }
      case 'list_images': {
        const outputPath = t.lastRun?.outputPath
        if (!outputPath) return { images: [], message: '还没有输出，请先运行流程' }
        const imagesDir = join(outputPath, 'images')
        if (!existsSync(imagesDir)) return { images: [], message: '图片目录不存在' }
        const files = await readdir(imagesDir)
        const pngs = files.filter(f => f.endsWith('.png')).sort()
        return { images: pngs, count: pngs.length, message: `共 ${pngs.length} 张图片` }
      }
      case 'get_output_info':
        return {
          outputPath: t.lastRun?.outputPath || '(未运行)',
          lastRunAt: t.lastRun?.at ? new Date(t.lastRun.at).toLocaleString() : '从未',
          runCount: t.runCount || 0
        }
      case 'run_full_pipeline':
        try {
          // 按顺序执行所有步骤
          await executeTaskStep(taskId, 'source')
          await executeTaskStep(taskId, 'generate')
          await executeTaskStep(taskId, 'render')
          const result = await executeTaskStep(taskId, 'screenshot')
          return { success: true, message: '全流程运行完成！', ...result }
        } catch (err: any) {
          return { error: `流程执行失败: ${err.message}` }
        }
      default:
        return { error: `未知工具: ${name}` }
    }
  }

  return runAgentLoop(SYSTEM_PROMPT, TOOLS, userMessage, history, executor)
}
