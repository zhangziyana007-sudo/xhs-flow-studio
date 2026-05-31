/**
 * ipc.ts — IPC 通道处理器注册
 */

import { ipcMain, shell } from 'electron'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  loadTasks, saveTasks, upsertTask, deleteTask,
  loadSettings, saveSettings, getOutputDir
} from './task-store'
import { executeTask, createDefaultAIDailyTask, executeCreativeTask, createCreativeTask, executeTaskStep } from './task-executor'
import { getTask } from './task-store'
import type { Task, PipelineConfig } from '../shared/types'

export function registerIpcHandlers(): void {
  // ── 任务管理 ─────────────────────────────────────

  ipcMain.handle('scheduler:list', async () => {
    const tasks = await loadTasks()
    // 如果没有任何任务，自动创建默认 AI Daily 任务
    if (tasks.length === 0) {
      const defaultTask = createDefaultAIDailyTask()
      await upsertTask(defaultTask)
      return [defaultTask]
    }
    return tasks
  })

  ipcMain.handle('scheduler:create', async (_event, taskData: Task) => {
    taskData.id = taskData.id || `task-${Date.now()}`
    taskData.createdAt = taskData.createdAt || Date.now()
    taskData.updatedAt = Date.now()
    taskData.runCount = taskData.runCount || 0
    await upsertTask(taskData)
    return taskData
  })

  ipcMain.handle('scheduler:toggle', async (_event, id: string, enabled: boolean) => {
    const tasks = await loadTasks()
    const task = tasks.find(t => t.id === id)
    if (task) {
      task.trigger.enabled = enabled
      task.updatedAt = Date.now()
      await saveTasks(tasks)
    }
    return task
  })

  ipcMain.handle('scheduler:delete', async (_event, id: string) => {
    await deleteTask(id)
    return { success: true }
  })

  ipcMain.handle('scheduler:runNow', async (_event, id: string) => {
    try {
      const outputDir = await executeTask(id)
      return { success: true, outputDir }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 设置 ─────────────────────────────────────

  ipcMain.handle('settings:get', async () => {
    return await loadSettings()
  })

  ipcMain.handle('settings:set', async (_event, settings: any) => {
    await saveSettings(settings)
    return { success: true }
  })

  ipcMain.handle('settings:testLLM', async (_event, config: any) => {
    try {
      const response = await fetch(`${config.baseUrl || 'https://api.deepseek.com'}/v1/models`, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` }
      })
      return { success: response.ok, status: response.status }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 模板 ─────────────────────────────────────

  ipcMain.handle('templates:list', async () => {
    return [
      { id: 'ai-daily', name: 'Tech Neon', desc: '黑底 · 荧光绿 · 终端风' },
      { id: 'knowledge-card', name: '知识卡片', desc: '简洁现代 · 渐变紫 · 教学风' }
    ]
  })

  // ── 创作任务 ─────────────────────────────────────

  ipcMain.handle('creative:createTask', async (_event, name?: string) => {
    const task = createCreativeTask(name)
    await upsertTask(task)
    return task
  })

  ipcMain.handle('creative:run', async (_event, input: {
    taskId?: string; urls?: string[]; text?: string; prompt?: string
  }) => {
    try {
      let task: Task | undefined
      if (input.taskId) {
        const tasks = await loadTasks()
        task = tasks.find(t => t.id === input.taskId)
      }
      if (!task) {
        task = createCreativeTask()
        await upsertTask(task)
      }
      const outputDir = await executeCreativeTask(task, {
        urls: input.urls,
        text: input.text,
        prompt: input.prompt
      })
      return { success: true, outputDir, taskId: task.id }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 任务详情/更新 ─────────────────────────────────────

  ipcMain.handle('task:get', async (_event, id: string) => {
    return await getTask(id)
  })

  ipcMain.handle('task:update', async (_event, id: string, updates: Partial<Pick<Task, 'name' | 'description' | 'pipeline' | 'trigger'>>) => {
    const task = await getTask(id)
    if (!task) return { success: false, error: '任务不存在' }
    if (updates.name !== undefined) task.name = updates.name
    if (updates.description !== undefined) task.description = updates.description
    if (updates.pipeline !== undefined) task.pipeline = updates.pipeline
    if (updates.trigger !== undefined) task.trigger = updates.trigger
    task.updatedAt = Date.now()
    await upsertTask(task)
    return { success: true, task }
  })

  /** 单步执行（source / generate / render / screenshot） */
  ipcMain.handle('task:runStep', async (_event, id: string, step: string) => {
    try {
      const result = await executeTaskStep(id, step)
      return { success: true, ...result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  /** 获取任务的输出文件列表 */
  ipcMain.handle('task:getOutput', async (_event, id: string) => {
    const task = await getTask(id)
    if (!task?.lastRun?.outputPath) return { images: [], dataJson: null }
    const outputPath = task.lastRun.outputPath
    const imagesDir = join(outputPath, 'images')
    const dataJsonPath = join(outputPath, 'data.json')

    let images: string[] = []
    if (existsSync(imagesDir)) {
      const files = await readdir(imagesDir)
      images = files.filter(f => f.endsWith('.png')).sort().map(f => join(imagesDir, f))
    }

    let dataJson: any = null
    if (existsSync(dataJsonPath)) {
      const { readFile: rf } = await import('node:fs/promises')
      dataJson = JSON.parse(await rf(dataJsonPath, 'utf-8'))
    }

    return { images, dataJson, outputPath }
  })

  // ── AI 配置助手 ─────────────────────────────────────

  ipcMain.handle('source:aiConfig', async (_event, userMessage: string) => {
    const settings = await loadSettings()
    const apiKey = settings.deepseekApiKey
    if (!apiKey) return { success: false, error: '请先在设置中配置 DeepSeek API Key' }

    const baseUrl = settings.aiBaseUrl || 'https://api.deepseek.com'
    const model = settings.aiModel || 'deepseek-chat'

    const systemPrompt = `你是 FlowStudio 数据源配置助手。用户会用自然语言描述他想获取的内容，你帮他生成对应的数据源卡片配置。

可用数据源类型：
1. api-fetch: 从 aihot.virxact.com API 拉取新闻，可选 category: ai-models/ai-coding/ai-agents/ai-products/industry/papers
2. url-scrape: 抓取指定网页内容
3. rss: 订阅 RSS 源
4. manual-text: 手动文本输入

输出要求：
- 返回一个 JSON 数组，每个元素是一个 SourceCard 配置
- 格式: [{"name":"名称","type":"类型","runMode":"auto或manual","config":{...}}]
- 对 api-fetch 类型: config 包含 apiUrl, category, sinceHours(默认24), minCount(默认25)
- 对 url-scrape 类型: config 包含 urls 数组
- 对 rss 类型: config 包含 feedUrl
- 对 manual-text 类型: config 包含 text

只输出 JSON 数组，不要任何额外解释。`

    try {
      const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })
      if (!resp.ok) {
        const errText = await resp.text()
        return { success: false, error: `API 调用失败: ${resp.status} ${errText.slice(0, 200)}` }
      }
      const data = await resp.json() as any
      const content = data.choices?.[0]?.message?.content || ''
      // 解析 JSON（可能被包裹在 ```json ... ``` 里）
      let jsonStr = content.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      const parsed = JSON.parse(jsonStr)
      // 支持 {cards:[...]} 或直接数组
      const cards = Array.isArray(parsed) ? parsed : (parsed.cards || [parsed])
      return { success: true, cards }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 通用操作 ─────────────────────────────────────

  ipcMain.handle('shell:openPath', async (_event, path: string) => {
    await shell.openPath(path)
  })
}
