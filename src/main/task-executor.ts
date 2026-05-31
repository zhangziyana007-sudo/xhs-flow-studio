/**
 * task-executor.ts — 任务执行引擎
 *
 * 编排完整 pipeline: 数据源卡片 → AI生成 → 渲染HTML → 截图PNG
 */

import { join } from 'node:path'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { app, BrowserWindow } from 'electron'
import { executeSourceCards, generateNews, generateKnowledge, renderPages, renderKnowledgePages, screenshotPages } from './pipeline'
import { getTask, upsertTask, loadSettings, getOutputDir } from './task-store'
import type { Task } from '../shared/types'

export type RunStatus = 'running' | 'success' | 'failed'

interface RunProgress {
  taskId: string
  step: string
  message: string
  progress: number // 0-100
}

function sendProgress(progress: RunProgress): void {
  const wins = BrowserWindow.getAllWindows()
  for (const win of wins) {
    win.webContents.send('task:progress', progress)
  }
}

function getProjectDir(taskId: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return join(getOutputDir(), `${taskId}-${date}`)
}

/** 获取模板目录（优先 app 资源内置，否则回退到 AINewsSkill） */
function getTemplateDir(templateId: string): string {
  // 内置资源路径（开发时）
  const devPath = join(app.getAppPath(), 'resources', 'templates', templateId)
  const { existsSync } = require('node:fs')
  if (existsSync(devPath)) return devPath

  // 开发时回退到 AINewsSkill 的模板
  const fallbackPath = join(app.getAppPath(), '..', '..', 'AINewsSkill', 'templates', templateId)
  if (existsSync(fallbackPath)) return fallbackPath

  // 打包后资源路径
  const prodPath = join(process.resourcesPath || '', 'templates', templateId)
  if (existsSync(prodPath)) return prodPath

  throw new Error(`模板未找到: ${templateId}`)
}

function getFontsDir(): string {
  const { existsSync } = require('node:fs')
  // 开发时回退到 AINewsSkill fonts
  const devPath = join(app.getAppPath(), 'resources', 'fonts')
  if (existsSync(devPath)) return devPath

  const fallbackPath = join(app.getAppPath(), '..', '..', 'AINewsSkill', 'fonts')
  if (existsSync(fallbackPath)) return fallbackPath

  const prodPath = join(process.resourcesPath || '', 'fonts')
  if (existsSync(prodPath)) return prodPath

  return ''
}

/** 执行任务（根据类型分流） */
export async function executeTask(taskId: string): Promise<string> {
  const task = await getTask(taskId)
  if (!task) throw new Error(`任务不存在: ${taskId}`)

  if (task.workflowType === 'manual-creative') {
    return executeCreativeTask(task)
  }
  return executeAutoReportTask(task)
}

/** 手动创作工作流 */
export async function executeCreativeTask(
  task: Task,
  manualInput?: { urls?: string[]; text?: string; prompt?: string }
): Promise<string> {
  const settings = await loadSettings()
  const projectDir = getProjectDir(task.id)
  const pagesDir = join(projectDir, 'pages')
  const imagesDir = join(projectDir, 'images')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(imagesDir, { recursive: true })

  task.lastRun = { at: Date.now(), status: 'running' }
  await upsertTask(task)

  const logs: string[] = []
  const log = (msg: string) => {
    logs.push(msg)
    sendProgress({ taskId: task.id, step: 'log', message: msg, progress: 0 })
  }

  try {
    sendProgress({ taskId: task.id, step: 'source', message: '正在获取素材...', progress: 10 })
    log('▶ 第一步：获取素材')

    if (manualInput) {
      const cards = task.pipeline.source.cards
      if (manualInput.urls?.length) {
        let scrapeCard = cards.find(c => c.type === 'url-scrape')
        if (!scrapeCard) {
          scrapeCard = { id: 'manual-scrape', name: '手动URL抓取', type: 'url-scrape', runMode: 'manual', config: {} }
          cards.push(scrapeCard)
        }
        scrapeCard.config.urls = manualInput.urls
      }
      if (manualInput.text) {
        let textCard = cards.find(c => c.type === 'manual-text')
        if (!textCard) {
          textCard = { id: 'manual-text-input', name: '手动文本输入', type: 'manual-text', runMode: 'manual', config: {} }
          cards.push(textCard)
        }
        textCard.config.text = manualInput.text
      }
    }

    const sourceResult = await executeSourceCards({
      cards: task.pipeline.source.cards,
      outputDir: projectDir,
      tavilyApiKey: settings.tavilyApiKey
    }, log)

    log(`素材收集完成: ${sourceResult.totalItems} 条`)
    const materialsMarkdown = await readFile(sourceResult.outputFile, 'utf-8')

    sendProgress({ taskId: task.id, step: 'generate', message: '正在AI提取知识点...', progress: 30 })
    log('▶ 第二步：AI知识提取')

    const knowledgeResult = await generateKnowledge({
      apiKey: settings.deepseekApiKey,
      baseUrl: settings.aiBaseUrl,
      model: settings.aiModel,
      materials: materialsMarkdown,
      userPrompt: manualInput?.prompt || task.pipeline.generate.prompt,
      sourceLabel: sourceResult.results.map(r => r.cardName).join(', ')
    }, log)

    await writeFile(join(projectDir, 'data.json'), JSON.stringify(knowledgeResult, null, 2), 'utf-8')

    sendProgress({ taskId: task.id, step: 'render', message: '正在渲染知识卡片...', progress: 60 })
    log('▶ 第三步：渲染知识卡片')

    const templateDir = getTemplateDir('knowledge-card')
    const fontsDir = getFontsDir()

    const htmlFiles = await renderKnowledgePages(knowledgeResult, {
      templateDir,
      outputDir: pagesDir,
      fontsDir: fontsDir || undefined
    }, log)

    sendProgress({ taskId: task.id, step: 'screenshot', message: '正在截图生成PNG...', progress: 80 })
    log('▶ 第四步：截图')

    const pngFiles = await screenshotPages({
      inputDir: pagesDir,
      outputDir: imagesDir,
      postProcess: true
    }, log)

    sendProgress({ taskId: task.id, step: 'done', message: `完成！生成 ${pngFiles.length} 张知识卡片`, progress: 100 })
    log(`✅ 知识卡片生成完成！输出: ${projectDir}`)

    task.lastRun = { at: Date.now(), status: 'success', outputPath: projectDir }
    task.runCount = (task.runCount || 0) + 1
    await upsertTask(task)
    return projectDir
  } catch (err: any) {
    log(`❌ 失败: ${err.message}`)
    sendProgress({ taskId: task.id, step: 'error', message: err.message, progress: 0 })
    task.lastRun = { at: Date.now(), status: 'failed', error: err.message }
    await upsertTask(task)
    throw err
  }
}

/** 自动报告工作流 */
async function executeAutoReportTask(task: Task): Promise<string> {
  const settings = await loadSettings()
  const projectDir = getProjectDir(task.id)
  const pagesDir = join(projectDir, 'pages')
  const imagesDir = join(projectDir, 'images')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(imagesDir, { recursive: true })

  // 更新任务状态为运行中
  task.lastRun = { at: Date.now(), status: 'running' }
  await upsertTask(task)

  const logs: string[] = []
  const log = (msg: string) => {
    logs.push(msg)
    sendProgress({ taskId: task.id, step: 'log', message: msg, progress: 0 })
  }

  try {
    // ═══ Step 1: 执行数据源卡片 → 输出素材 markdown ═══
    sendProgress({ taskId: task.id, step: 'source', message: '正在执行数据源卡片...', progress: 10 })
    log('▶ 第一步：执行数据源卡片')

    const sourceResult = await executeSourceCards({
      cards: task.pipeline.source.cards,
      outputDir: projectDir,
      tavilyApiKey: settings.tavilyApiKey
    }, log)

    log(`素材收集完成: ${sourceResult.totalItems} 条 → ${sourceResult.outputFile}`)

    // 读取素材 markdown 作为 AI 上下文
    const materialsMarkdown = await readFile(sourceResult.outputFile, 'utf-8')

    // ═══ Step 2: AI 生成 ═══
    sendProgress({ taskId: task.id, step: 'generate', message: '正在调用AI生成早报...', progress: 30 })
    log('▶ 第二步：AI生成')

    const generateResult = await generateNews({
      apiKey: settings.deepseekApiKey,
      baseUrl: settings.aiBaseUrl,
      model: settings.aiModel,
      searchContext: materialsMarkdown,
      searchSource: sourceResult.results.map(r => r.cardName).join('+')
    }, log)

    // 保存生成结果
    await writeFile(
      join(projectDir, 'data.json'),
      JSON.stringify(generateResult, null, 2),
      'utf-8'
    )

    // ═══ Step 3: 渲染 HTML ═══
    sendProgress({ taskId: task.id, step: 'render', message: '正在渲染HTML页面...', progress: 60 })
    log('▶ 第三步：渲染HTML')

    const templateId = task.pipeline.style.templateId || 'ai-daily'
    const templateDir = getTemplateDir(templateId)
    const fontsDir = getFontsDir()

    const htmlFiles = await renderPages(generateResult, {
      templateDir,
      outputDir: pagesDir,
      fontsDir: fontsDir || undefined
    }, log)

    // ═══ Step 4: 截图 ═══
    sendProgress({ taskId: task.id, step: 'screenshot', message: '正在截图生成PNG...', progress: 80 })
    log('▶ 第四步：截图')

    const pngFiles = await screenshotPages({
      inputDir: pagesDir,
      outputDir: imagesDir,
      postProcess: true
    }, log)

    // ═══ 完成 ═══
    sendProgress({ taskId: task.id, step: 'done', message: `完成！生成 ${pngFiles.length} 张图片`, progress: 100 })
    log(`✅ 流水线完成！输出: ${projectDir}`)

    // 更新任务状态
    task.lastRun = { at: Date.now(), status: 'success', outputPath: projectDir }
    task.runCount = (task.runCount || 0) + 1
    await upsertTask(task)

    return projectDir
  } catch (err: any) {
    log(`❌ 失败: ${err.message}`)
    sendProgress({ taskId: task.id, step: 'error', message: err.message, progress: 0 })

    task.lastRun = { at: Date.now(), status: 'failed', error: err.message }
    await upsertTask(task)

    throw err
  }
}

/** 创建默认 AI Daily 任务 */
export function createDefaultAIDailyTask(): Task {
  return {
    id: 'ai-daily-default',
    name: 'AI 日报',
    description: '每日AI大模型新闻早报 Top20 · 自动拉取 → AI精选 → 渲染出图',
    workflowType: 'auto-report',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pipeline: {
      source: {
        cards: [
          {
            id: 'aihot-fetch',
            name: 'AI热点新闻拉取',
            type: 'api-fetch',
            runMode: 'auto',
            config: {
              apiUrl: 'https://aihot.virxact.com',
              category: 'ai-models',
              sinceHours: 24,
              minCount: 25
            }
          }
        ]
      },
      generate: {
        model: 'deepseek-v4-pro',
        mode: 'daily-report',
        prompt: '精选今日最重要的20条AI大模型新闻',
        temperature: 0.3
      },
      style: {
        templateId: 'ai-daily',
        overrides: {}
      },
      output: {
        format: 'png',
        publishMode: 'review',
        channels: [
          { id: 'local', type: 'local', name: '本地保存', enabled: true, config: {} },
          { id: 'xhs', type: 'xhs-package', name: '小红书素材包', enabled: true, config: {} }
        ]
      }
    },
    trigger: {
      type: 'manual',
      enabled: true
    },
    runCount: 0
  }
}

/** 创建手动创作任务 */
export function createCreativeTask(name?: string): Task {
  return {
    id: `creative-${Date.now()}`,
    name: name || '知识卡片创作',
    description: '输入文章/视频链接或文本 → AI提取干货 → 生成知识卡片图文',
    workflowType: 'manual-creative',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pipeline: {
      source: { cards: [] },
      generate: {
        model: 'deepseek-v4-pro',
        mode: 'knowledge-extract',
        prompt: '提炼核心知识点，生成教学卡片',
        temperature: 0.5
      },
      style: { templateId: 'knowledge-card', overrides: {} },
      output: {
        format: 'png',
        publishMode: 'review',
        channels: [
          { id: 'local', type: 'local', name: '本地保存', enabled: true, config: {} }
        ]
      }
    },
    trigger: { type: 'manual', enabled: true },
    runCount: 0
  }
}

/** 单步执行：只运行 pipeline 中的某一步 */
export async function executeTaskStep(taskId: string, step: string): Promise<Record<string, any>> {
  const task = await getTask(taskId)
  if (!task) throw new Error(`任务不存在: ${taskId}`)

  const settings = await loadSettings()
  const projectDir = getProjectDir(task.id)
  const pagesDir = join(projectDir, 'pages')
  const imagesDir = join(projectDir, 'images')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(imagesDir, { recursive: true })

  const logs: string[] = []
  const log = (msg: string) => {
    logs.push(msg)
    sendProgress({ taskId: task.id, step, message: msg, progress: 0 })
  }

  switch (step) {
    case 'source': {
      sendProgress({ taskId: task.id, step: 'source', message: '正在执行数据源...', progress: 10 })
      const sourceResult = await executeSourceCards({
        cards: task.pipeline.source.cards,
        outputDir: projectDir,
        tavilyApiKey: settings.tavilyApiKey
      }, log)
      sendProgress({ taskId: task.id, step: 'done', message: `素材获取完成: ${sourceResult.totalItems} 条`, progress: 100 })
      return { totalItems: sourceResult.totalItems, outputFile: sourceResult.outputFile }
    }
    case 'generate': {
      sendProgress({ taskId: task.id, step: 'generate', message: '正在AI生成...', progress: 30 })
      const materialsFile = join(projectDir, 'materials.md')
      const { existsSync: ex } = require('node:fs')
      if (!ex(materialsFile)) throw new Error('请先执行素材获取步骤')
      const materialsMarkdown = await readFile(materialsFile, 'utf-8')

      let result: any
      if (task.pipeline.generate.mode === 'knowledge-extract') {
        result = await generateKnowledge({
          apiKey: settings.deepseekApiKey,
          baseUrl: settings.aiBaseUrl,
          model: settings.aiModel,
          materials: materialsMarkdown,
          userPrompt: task.pipeline.generate.prompt,
          sourceLabel: 'pipeline'
        }, log)
      } else {
        result = await generateNews({
          apiKey: settings.deepseekApiKey,
          baseUrl: settings.aiBaseUrl,
          model: settings.aiModel,
          searchContext: materialsMarkdown,
          searchSource: 'pipeline'
        }, log)
      }
      await writeFile(join(projectDir, 'data.json'), JSON.stringify(result, null, 2), 'utf-8')
      sendProgress({ taskId: task.id, step: 'done', message: 'AI 生成完成', progress: 100 })
      return { data: result }
    }
    case 'render': {
      sendProgress({ taskId: task.id, step: 'render', message: '正在渲染HTML...', progress: 60 })
      const dataFile = join(projectDir, 'data.json')
      const { existsSync: ex2 } = require('node:fs')
      if (!ex2(dataFile)) throw new Error('请先执行AI生成步骤')
      const data = JSON.parse(await readFile(dataFile, 'utf-8'))
      const templateId = task.pipeline.style.templateId || 'ai-daily'
      const templateDir = getTemplateDir(templateId)
      const fontsDir = getFontsDir()

      let htmlFiles: string[]
      if (task.pipeline.generate.mode === 'knowledge-extract') {
        htmlFiles = await renderKnowledgePages(data, { templateDir, outputDir: pagesDir, fontsDir: fontsDir || undefined }, log)
      } else {
        htmlFiles = await renderPages(data, { templateDir, outputDir: pagesDir, fontsDir: fontsDir || undefined }, log)
      }
      sendProgress({ taskId: task.id, step: 'done', message: `渲染完成: ${htmlFiles.length} 页`, progress: 100 })
      return { htmlFiles }
    }
    case 'screenshot': {
      sendProgress({ taskId: task.id, step: 'screenshot', message: '正在截图...', progress: 80 })
      const pngFiles = await screenshotPages({ inputDir: pagesDir, outputDir: imagesDir, postProcess: true }, log)
      // 更新任务状态
      task.lastRun = { at: Date.now(), status: 'success', outputPath: projectDir }
      task.runCount = (task.runCount || 0) + 1
      await upsertTask(task)
      sendProgress({ taskId: task.id, step: 'done', message: `截图完成: ${pngFiles.length} 张`, progress: 100 })
      return { pngFiles, outputPath: projectDir }
    }
    default:
      throw new Error(`未知步骤: ${step}`)
  }
}
