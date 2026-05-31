/**
 * source-executor.ts — 数据源卡片执行器
 *
 * 运行 SourceCard 数组中的每个卡片，输出合并的素材 markdown 文档
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SourceCard } from '../../shared/types'

interface SourceExecutorOptions {
  cards: SourceCard[]
  outputDir: string
  tavilyApiKey?: string
}

interface CardResult {
  cardId: string
  cardName: string
  itemCount: number
  markdown: string
}

/** 执行所有数据源卡片，输出合并 markdown */
export async function executeSourceCards(
  options: SourceExecutorOptions,
  onLog?: (msg: string) => void
): Promise<{ outputFile: string; totalItems: number; results: CardResult[] }> {
  const log = onLog || console.log
  const { cards, outputDir } = options

  if (!cards || cards.length === 0) {
    throw new Error('没有配置数据源卡片')
  }

  const results: CardResult[] = []

  for (const card of cards) {
    if (card.runMode === 'manual' && !hasManualInput(card)) {
      log(`⏭ 跳过手动卡片 "${card.name}"（未提供输入）`)
      continue
    }

    log(`▶ 执行数据源: ${card.name} [${card.type}]`)
    try {
      const result = await executeCard(card, options, log)
      results.push(result)
      log(`✓ ${card.name}: ${result.itemCount} 条素材`)
    } catch (err: any) {
      log(`✗ ${card.name} 失败: ${err.message}`)
    }
  }

  if (results.length === 0) {
    throw new Error('所有数据源执行失败或无数据')
  }

  // 合并为最终 markdown
  const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0)
  const finalMarkdown = mergeResults(results)
  const outputFile = join(outputDir, 'materials.md')
  await writeFile(outputFile, finalMarkdown, 'utf-8')

  log(`📄 素材文档: ${outputFile} (${totalItems} 条)`)
  return { outputFile, totalItems, results }
}

/** 判断手动卡片是否有输入 */
function hasManualInput(card: SourceCard): boolean {
  switch (card.type) {
    case 'url-scrape':
      return !!(card.config.urls && card.config.urls.length > 0)
    case 'manual-text':
      return !!card.config.text
    case 'video-subtitle':
      return !!card.config.videoUrl
    default:
      return false
  }
}

/** 执行单个卡片 */
async function executeCard(
  card: SourceCard,
  options: SourceExecutorOptions,
  log: (msg: string) => void
): Promise<CardResult> {
  switch (card.type) {
    case 'api-fetch':
      return executeApiFetch(card, log)
    case 'url-scrape':
      return executeUrlScrape(card, log)
    case 'manual-text':
      return executeManualText(card)
    case 'rss':
      return executeRss(card, log)
    case 'ai-search':
      return executeAiSearch(card, log)
    default:
      throw new Error(`不支持的卡片类型: ${card.type}`)
  }
}

/** API 拉取卡片（如 AI HOT） */
async function executeApiFetch(card: SourceCard, log: (msg: string) => void): Promise<CardResult> {
  const apiUrl = card.config.apiUrl || 'https://aihot.virxact.com'
  const category = card.config.category || 'ai-models'
  const sinceHours = card.config.sinceHours || 24
  const minCount = card.config.minCount || 25

  const sinceIso = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString()
  const url = `${apiUrl}/api/public/items?mode=all&category=${encodeURIComponent(category)}&since=${encodeURIComponent(sinceIso)}`

  log(`  [API] ${url}`)
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'FlowStudio/1.0',
      'Accept': 'application/json'
    }
  })

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const data: any = await res.json()
  let items = Array.isArray(data.items) ? data.items : []
  log(`  → ${items.length} 条`)

  // 如果不足最低数量，扩大时间窗口
  if (items.length < minCount) {
    log(`  ⚠ 不足 ${minCount} 条，扩展到 48h`)
    const wider = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const url2 = `${apiUrl}/api/public/items?mode=all&category=${encodeURIComponent(category)}&since=${encodeURIComponent(wider)}`
    const res2 = await fetch(url2, {
      headers: { 'User-Agent': 'FlowStudio/1.0', 'Accept': 'application/json' }
    })
    if (res2.ok) {
      const data2: any = await res2.json()
      const items2 = Array.isArray(data2.items) ? data2.items : []
      if (items2.length > items.length) {
        items = items2
        log(`  → 扩展后 ${items.length} 条`)
      }
    }
  }

  // 去重
  const seen = new Set<string>()
  items = items.filter((it: any) => {
    const key = it.url || it.title
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 转为 markdown
  const markdown = items.map((it: any, idx: number) => {
    const lines = [`## [${idx + 1}] ${it.title || '无标题'}`]
    if (it.summary) lines.push(`\n${it.summary}`)
    if (it.url) lines.push(`\n> 来源: ${it.source || '未知'} | ${it.url}`)
    if (it.publishedAt) lines.push(`> 时间: ${it.publishedAt}`)
    return lines.join('\n')
  }).join('\n\n---\n\n')

  return {
    cardId: card.id,
    cardName: card.name,
    itemCount: items.length,
    markdown
  }
}

/** URL 抓取卡片 */
async function executeUrlScrape(card: SourceCard, log: (msg: string) => void): Promise<CardResult> {
  const urls = card.config.urls || []
  if (urls.length === 0) throw new Error('未提供 URL')

  const results: string[] = []

  for (const url of urls) {
    log(`  [抓取] ${url}`)
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FlowStudio/1.0', 'Accept': 'text/html,application/json' }
      })
      if (!res.ok) {
        log(`  ⚠ ${url} → ${res.status}`)
        continue
      }
      const contentType = res.headers.get('content-type') || ''
      const text = await res.text()

      if (contentType.includes('json')) {
        results.push(`## ${url}\n\n\`\`\`json\n${text.slice(0, 5000)}\n\`\`\``)
      } else {
        // 简单提取正文（去除 HTML 标签）
        const body = extractTextFromHtml(text)
        results.push(`## ${url}\n\n${body.slice(0, 5000)}`)
      }
    } catch (err: any) {
      log(`  ✗ ${url}: ${err.message}`)
    }
  }

  return {
    cardId: card.id,
    cardName: card.name,
    itemCount: results.length,
    markdown: results.join('\n\n---\n\n')
  }
}

/** 手动文本卡片 */
async function executeManualText(card: SourceCard): Promise<CardResult> {
  const text = card.config.text || ''
  return {
    cardId: card.id,
    cardName: card.name,
    itemCount: 1,
    markdown: `## 手动输入素材\n\n${text}`
  }
}

/** RSS 卡片 */
async function executeRss(card: SourceCard, log: (msg: string) => void): Promise<CardResult> {
  const feedUrl = card.config.feedUrl
  if (!feedUrl) throw new Error('未配置 RSS URL')

  log(`  [RSS] ${feedUrl}`)
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'FlowStudio/1.0', 'Accept': 'application/rss+xml,application/xml,text/xml' }
  })
  if (!res.ok) throw new Error(`RSS ${res.status}`)
  const xml = await res.text()

  // 简单 RSS 解析（提取 <item> 中的 title 和 description）
  const items: { title: string; desc: string; link: string }[] = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || ''
    const desc = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] || ''
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || ''
    items.push({ title: title.trim(), desc: stripHtml(desc).trim(), link: link.trim() })
  }

  const maxItems = card.config.maxItems || 20
  const markdown = items.slice(0, maxItems).map((it, idx) => {
    return `## [${idx + 1}] ${it.title}\n\n${it.desc.slice(0, 500)}\n\n> ${it.link}`
  }).join('\n\n---\n\n')

  return {
    cardId: card.id,
    cardName: card.name,
    itemCount: Math.min(items.length, maxItems),
    markdown
  }
}

/** 合并多个卡片结果为一份 markdown */
function mergeResults(results: CardResult[]): string {
  const header = `# 素材文档\n\n> 生成时间: ${new Date().toISOString()}\n> 数据源: ${results.map(r => r.cardName).join(', ')}\n> 总素材数: ${results.reduce((s, r) => s + r.itemCount, 0)}\n\n---\n\n`
  const body = results.map(r => {
    return `# 【${r.cardName}】(${r.itemCount} 条)\n\n${r.markdown}`
  }).join('\n\n---\n\n')
  return header + body
}

/** 简单从 HTML 中提取纯文本 */
function extractTextFromHtml(html: string): string {
  // 移除 script/style
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  // 移除标签
  text = text.replace(/<[^>]+>/g, ' ')
  // 解码常用实体
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  // 压缩空白
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

/** 去除 HTML 标签 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
}

/** AI 搜索卡片 — 调用 LLM API（支持联网搜索）获取信息作为素材 */
async function executeAiSearch(card: SourceCard, log: (msg: string) => void): Promise<CardResult> {
  const { llmBaseUrl, llmApiKey, llmModel, searchPrompt, enableWebSearch } = card.config
  if (!llmApiKey) throw new Error('未配置 AI 搜索的 API Key')
  if (!searchPrompt) throw new Error('未配置搜索提示词')

  const baseUrl = llmBaseUrl || 'https://api.x.ai/v1'
  const model = llmModel || 'grok-3'

  log(`  [AI搜索] 模型: ${model} | 联网: ${enableWebSearch ? '是' : '否'}`)
  log(`  [AI搜索] 提示: ${searchPrompt.slice(0, 80)}...`)

  // 构建系统提示，包含输出格式要求
  let systemContent = '你是一个信息搜索助手。请根据用户的查询要求，搜索并整理相关信息。用中文回复。'
  if (card.outputFormat?.parsePrompt) {
    systemContent += `\n\n输出格式要求：${card.outputFormat.parsePrompt}`
  } else if (card.outputFormat?.type === 'news-list') {
    systemContent += '\n\n输出格式：以 markdown 列表形式输出，每条信息包含标题、摘要、来源URL、发布时间。'
  }

  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: searchPrompt }
  ]

  const body: any = { model, messages, temperature: 0.3 }

  // 根据不同 API 提供商启用联网搜索
  if (enableWebSearch) {
    // xAI Grok 格式
    if (baseUrl.includes('x.ai')) {
      body.search_parameters = { mode: 'auto' }
    }
    // OpenAI 兼容格式（部分提供商支持）
    else {
      body.tools = [{ type: 'web_search' }]
    }
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmApiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`AI 搜索 API ${resp.status}: ${errText.slice(0, 300)}`)
  }

  const data: any = await resp.json()
  const content = data.choices?.[0]?.message?.content || ''

  if (!content.trim()) {
    throw new Error('AI 搜索未返回有效内容')
  }

  log(`  ✓ AI 搜索返回 ${content.length} 字符`)

  // 统计条目数（以 ## 或数字列表开头的行数）
  const itemCount = Math.max(1, (content.match(/^(?:##|\d+[\.\)、])/gm) || []).length)

  return {
    cardId: card.id,
    cardName: card.name,
    itemCount,
    markdown: `## AI 搜索结果 — ${card.name}\n\n> 模型: ${model} | 联网搜索: ${enableWebSearch ? '是' : '否'}\n> 提示: ${searchPrompt}\n\n---\n\n${content}`
  }
}
