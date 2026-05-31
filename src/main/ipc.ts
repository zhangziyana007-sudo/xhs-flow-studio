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
import { runSourceAgent } from './source-agent'
import { runGenerateAgent } from './generate-agent'
import { runStyleAgent } from './style-agent'
import { runPreviewAgent } from './preview-agent'
import { runTriggerAgent } from './trigger-agent'
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

  // ── AI 配置助手（Agent 模式：直接操作） ─────────────────────────────────────

  ipcMain.handle('source:aiConfig', async (_event, taskId: string, userMessage: string, history?: any[]) => {
    try {
      const result = await runSourceAgent(taskId, userMessage, history || [])
      return {
        success: true,
        reply: result.reply,
        actions: result.actions,
        updatedTask: result.updatedTask
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('generate:agent', async (_event, taskId: string, userMessage: string, history?: any[]) => {
    try {
      const result = await runGenerateAgent(taskId, userMessage, history || [])
      return { success: true, reply: result.reply, actions: result.actions }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('style:agent', async (_event, taskId: string, userMessage: string, history?: any[]) => {
    try {
      const result = await runStyleAgent(taskId, userMessage, history || [])
      return { success: true, reply: result.reply, actions: result.actions }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('preview:agent', async (_event, taskId: string, userMessage: string, history?: any[]) => {
    try {
      const result = await runPreviewAgent(taskId, userMessage, history || [])
      return { success: true, reply: result.reply, actions: result.actions }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('trigger:agent', async (_event, taskId: string, userMessage: string, history?: any[]) => {
    try {
      const result = await runTriggerAgent(taskId, userMessage, history || [])
      return { success: true, reply: result.reply, actions: result.actions }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── 通用操作 ─────────────────────────────────────

  ipcMain.handle('shell:openPath', async (_event, path: string) => {
    await shell.openPath(path)
  })
}
