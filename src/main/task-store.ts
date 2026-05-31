/**
 * task-store.ts — JSON 文件持久化任务存储
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { app } from 'electron'
import type { Task } from '../shared/types'

const DATA_DIR = () => join(app.getPath('userData'), 'data')
const TASKS_FILE = () => join(DATA_DIR(), 'tasks.json')
const SETTINGS_FILE = () => join(DATA_DIR(), 'settings.json')

export interface AppSettings {
  deepseekApiKey?: string
  aiBaseUrl?: string
  aiModel?: string
  feishuWebhookUrl?: string
  feishuAppId?: string
  feishuAppSecret?: string
  tavilyApiKey?: string
  outputDir?: string
}

let tasksCache: Task[] | null = null
let settingsCache: AppSettings | null = null

async function ensureDir(): Promise<void> {
  const dir = DATA_DIR()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function loadTasks(): Promise<Task[]> {
  if (tasksCache) return tasksCache
  await ensureDir()
  const file = TASKS_FILE()
  if (!existsSync(file)) {
    tasksCache = []
    return tasksCache
  }
  const raw = await readFile(file, 'utf-8')
  tasksCache = JSON.parse(raw)
  return tasksCache!
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await ensureDir()
  tasksCache = tasks
  await writeFile(TASKS_FILE(), JSON.stringify(tasks, null, 2), 'utf-8')
}

export async function getTask(id: string): Promise<Task | undefined> {
  const tasks = await loadTasks()
  return tasks.find(t => t.id === id)
}

export async function upsertTask(task: Task): Promise<void> {
  const tasks = await loadTasks()
  const idx = tasks.findIndex(t => t.id === task.id)
  if (idx >= 0) {
    tasks[idx] = task
  } else {
    tasks.push(task)
  }
  await saveTasks(tasks)
}

export async function deleteTask(id: string): Promise<void> {
  const tasks = await loadTasks()
  await saveTasks(tasks.filter(t => t.id !== id))
}

export async function loadSettings(): Promise<AppSettings> {
  if (settingsCache) return settingsCache
  await ensureDir()
  const file = SETTINGS_FILE()
  if (!existsSync(file)) {
    settingsCache = {}
    return settingsCache
  }
  const raw = await readFile(file, 'utf-8')
  settingsCache = JSON.parse(raw)
  return settingsCache!
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await ensureDir()
  settingsCache = settings
  await writeFile(SETTINGS_FILE(), JSON.stringify(settings, null, 2), 'utf-8')
}

/** 获取任务输出目录 */
export function getOutputDir(): string {
  return settingsCache?.outputDir || join(app.getPath('userData'), 'output')
}
