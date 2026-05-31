/**
 * render.ts — AI Daily HTML 渲染器
 *
 * 读取 JSON 数据 → 套用 HTML 模板 → 输出静态 HTML 页面
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'

export interface RenderOptions {
  templateDir: string
  outputDir: string
  fontsDir?: string
}

// ── 简易模板引擎 ─────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getNestedValue(obj: any, path: string): any {
  if (path === '@index') return obj['@index']
  if (path === '@index1') return obj['@index1']
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

function renderTemplate(html: string, data: any): string {
  let result = html
  let safety = 0

  while (result.includes('{{') && safety++ < 20) {
    let changed = false

    // {{#each}}
    const eachRe = /\{\{#each\s+([\w.@]+)\}\}([\s\S]*?)\{\{\/each\}\}/
    let match
    while ((match = eachRe.exec(result)) !== null) {
      const [full, path, body] = match
      const arr = getNestedValue(data, path)
      let replacement = ''
      if (Array.isArray(arr)) {
        replacement = arr.map((item, index) => {
          const ctx = typeof item === 'object'
            ? { ...data, ...item, '@index': index, '@index1': index + 1 }
            : { ...data, this: item, '@index': index, '@index1': index + 1 }
          return renderTemplate(body, ctx)
        }).join('')
      }
      result = result.slice(0, match.index) + replacement + result.slice(match.index + full.length)
      changed = true
    }

    // {{#if}}
    const ifRe = /\{\{#if\s+([\w.@]+)\}\}([\s\S]*?)\{\{\/if\}\}/
    while ((match = ifRe.exec(result)) !== null) {
      const [full, path, body] = match
      const val = getNestedValue(data, path)
      const replacement = val ? renderTemplate(body, data) : ''
      result = result.slice(0, match.index) + replacement + result.slice(match.index + full.length)
      changed = true
    }

    // {{this}}
    result = result.replace(/\{\{this\}\}/g, () => {
      const v = data.this ?? data
      return typeof v === 'string' ? escapeHtml(v) : String(v ?? '')
    })

    // {{@index1}} {{@index}}
    result = result.replace(/\{\{@index1\}\}/g, String(data['@index1'] ?? ''))
    result = result.replace(/\{\{@index\}\}/g, String(data['@index'] ?? ''))

    // {{variable}}
    result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const val = getNestedValue(data, path)
      if (val === undefined || val === null) return ''
      if (Array.isArray(val)) return val.length.toString()
      return escapeHtml(String(val))
    })

    if (!changed && !result.match(/\{\{#/)) break
  }

  return result
}

// ── 分页逻辑 ───────────────────────────────
function splitNewsIntoPages(items: any[]): any[][] {
  const COVER_FIRST = 3
  const COVER_CONT = 4
  const pages: any[][] = []
  for (let i = 0; i < items.length;) {
    const isFirst = pages.length === 0
    const size = isFirst ? COVER_FIRST : COVER_CONT
    pages.push(items.slice(i, i + size))
    i += size
  }
  return pages
}

// ── 封面图标 SVG ──────────────────────
function getCoverIcon(name: string): string {
  const icons: Record<string, string> = {
    brain: '<svg viewBox="0 0 24 24"><path d="M9.5 2a3.5 3.5 0 0 0-3.2 4.9A3.5 3.5 0 0 0 4 10.5a3.5 3.5 0 0 0 1.8 3.1A3.5 3.5 0 0 0 7 17.5a3.5 3.5 0 0 0 3.5 3.5c.8 0 1.5-.3 2-.7"/><path d="M14.5 2a3.5 3.5 0 0 1 3.2 4.9A3.5 3.5 0 0 1 20 10.5a3.5 3.5 0 0 1-1.8 3.1A3.5 3.5 0 0 1 17 17.5a3.5 3.5 0 0 1-3.5 3.5c-.8 0-1.5-.3-2-.7"/><path d="M12 2v20"/></svg>',
    code: '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
    monitor: '<svg viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
    smartphone: '<svg viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>',
    zap: '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    cpu: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
    robot: '<svg viewBox="0 0 24 24"><rect width="18" height="10" x="3" y="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" x2="8" y1="16" y2="16"/><line x1="16" x2="16" y1="16" y2="16"/></svg>',
    rocket: '<svg viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    star: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  }
  return icons[name] || icons.zap
}

// ── 主渲染函数 ───────────────────────────────────
export async function renderPages(
  data: any,
  options: RenderOptions,
  onLog?: (msg: string) => void
): Promise<string[]> {
  const log = onLog || console.log
  const { templateDir, outputDir, fontsDir } = options

  // 读取模板
  const coverTpl = await readFile(join(templateDir, 'cover.html'), 'utf-8')
  const coverContTpl = await readFile(join(templateDir, 'cover-cont.html'), 'utf-8')

  // 确保输出目录
  await mkdir(outputDir, { recursive: true })

  // 清理旧 HTML
  if (existsSync(outputDir)) {
    const existing = await readdir(outputDir)
    for (const f of existing) {
      if (/^page\d+\.html$/.test(f)) {
        await unlink(join(outputDir, f))
      }
    }
  }

  // 复制 styles.css（修正字体路径）
  let cssContent = await readFile(join(templateDir, 'styles.css'), 'utf-8')
  if (fontsDir) {
    cssContent = cssContent.replace(/url\('\.\.\/\.\.\/fonts\//g, `url('${fontsDir}/`)
  }
  await writeFile(join(outputDir, 'styles.css'), cssContent, 'utf-8')

  // 解析数据
  const newsItems = data.pages
    .filter((p: any) => p.type === 'news')
    .flatMap((p: any) => p.items || [])

  const shared = {
    date: data.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    issue: data.issue || `#${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    totalPages: 0
  }

  const coverData = data.pages.find((p: any) => p.type === 'cover') || {}
  const allItems = newsItems.map((item: any, i: number) => ({
    rank: i + 1,
    title: item.title,
    keyFact: item.keyFact || '',
    impact: item.impact || '',
    source: item.category || '',
    icon: item.icon || 'zap'
  }))

  const coverPages = splitNewsIntoPages(allItems)
  shared.totalPages = coverPages.length

  const pages: string[] = []
  let rankOffset = 0

  for (let i = 0; i < coverPages.length; i++) {
    const items = coverPages[i].map((item: any, idx: number) => ({
      ...item,
      rank: String(rankOffset + idx + 1).padStart(2, '0')
    }))
    rankOffset += coverPages[i].length

    const previewCount = items.length
    const isSparse = i > 0 && previewCount < 4
    const sparseClass = isSparse ? ' cover-previews--sparse' : ''
    const previewsHtml = `<div class="cover-previews${i > 0 ? ' cover-previews-cont' : ''}${sparseClass}" data-count="${previewCount}">
      ${items.map((p: any) => {
      const iconSvg = getCoverIcon(p.icon || 'zap')
      const keyFactHtml = p.keyFact ? `\n          <div class="preview-fact">${escapeHtml(p.keyFact)}</div>` : ''
      const impactHtml = p.impact ? `\n          <div class="preview-impact">${escapeHtml(p.impact)}</div>` : ''
      return `<div class="preview-card${p.keyFact ? ' preview-card--rich' : ''}">
        <div class="preview-rank">${escapeHtml(p.rank)}</div>
        <div class="preview-body">
          <div class="preview-title">${escapeHtml(p.title)}</div>${keyFactHtml}${impactHtml}
          <div class="preview-source">${escapeHtml(p.source)}</div>
        </div>
        <div class="preview-icon">${iconSvg}</div>
      </div>`
    }).join('\n      ')}
    </div>`

    const tpl = i === 0 ? coverTpl : coverContTpl
    let coverHtml = renderTemplate(tpl, {
      ...shared,
      titleLines: coverData.title || ['AI', '日报'],
      subtitle: coverData.subtitle || '',
      pageNum: i + 1
    })
    coverHtml = coverHtml.replace(/\s*<div class="cover-previews[^"]*">\s*%%SLOT_COVER_PREVIEWS%%\s*<\/div>/, previewsHtml)
    pages.push(coverHtml)
  }

  // 写入文件
  const outputFiles: string[] = []
  for (let i = 0; i < pages.length; i++) {
    const filename = `page${i + 1}.html`
    const filePath = join(outputDir, filename)
    await writeFile(filePath, pages[i], 'utf-8')
    outputFiles.push(filePath)
    log(`✅ ${filename} (${pages[i].length} bytes)`)
  }

  log(`🎉 渲染完成: ${pages.length} 页 → ${outputDir}`)
  return outputFiles
}

// ═══════════════════════════════════════════════════════════
// 知识卡片渲染
// ═══════════════════════════════════════════════════════════

export interface KnowledgeRenderData {
  topic: string
  summary: string
  cards: Array<{
    title: string
    subtitle?: string
    points: string[]
    highlight?: string
    category?: string
  }>
  source?: string
}

export async function renderKnowledgePages(
  data: KnowledgeRenderData,
  options: RenderOptions,
  onLog?: (msg: string) => void
): Promise<string[]> {
  const log = onLog || console.log
  const { templateDir, outputDir, fontsDir } = options

  // 读取模板
  const coverTpl = await readFile(join(templateDir, 'cover.html'), 'utf-8')
  const contentTpl = await readFile(join(templateDir, 'content.html'), 'utf-8')

  // 确保输出目录
  await mkdir(outputDir, { recursive: true })

  // 清理旧 HTML
  if (existsSync(outputDir)) {
    const existing = await readdir(outputDir)
    for (const f of existing) {
      if (/^page\d+\.html$/.test(f)) {
        await unlink(join(outputDir, f))
      }
    }
  }

  // 复制 styles.css（修正字体路径）
  let cssContent = await readFile(join(templateDir, 'styles.css'), 'utf-8')
  if (fontsDir) {
    cssContent = cssContent.replace(/url\('\.\.\/\.\.\/fonts\//g, `url('${fontsDir}/`)
  }
  await writeFile(join(outputDir, 'styles.css'), cssContent, 'utf-8')

  const totalPages = data.cards.length + 1  // 封面 + 每张卡片一页
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  const outputFiles: string[] = []

  // ── 封面 ──
  const coverHtml = renderTemplate(coverTpl, {
    topic: data.topic,
    summary: data.summary,
    category: data.cards[0]?.category || '知识分享',
    source: data.source || '',
    date: dateStr
  })
  const coverFile = join(outputDir, 'page1.html')
  await writeFile(coverFile, coverHtml, 'utf-8')
  outputFiles.push(coverFile)
  log(`✅ page1.html (封面)`)

  // ── 内容页 ──
  for (let i = 0; i < data.cards.length; i++) {
    const card = data.cards[i]
    const pageHtml = renderTemplate(contentTpl, {
      pageNum: i + 1,
      totalPages: totalPages - 1,  // 不含封面计数
      cardTitle: card.title,
      cardSubtitle: card.subtitle || '',
      points: card.points,
      highlight: card.highlight || '',
      category: card.category || '',
      source: data.source || '',
      date: dateStr
    })
    const filename = `page${i + 2}.html`
    const filePath = join(outputDir, filename)
    await writeFile(filePath, pageHtml, 'utf-8')
    outputFiles.push(filePath)
    log(`✅ ${filename} (${card.title})`)
  }

  log(`🎉 知识卡片渲染完成: ${outputFiles.length} 页 → ${outputDir}`)
  return outputFiles
}
