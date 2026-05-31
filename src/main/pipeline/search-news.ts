/**
 * search-news.ts — 拉取 AI 新闻素材（主：AI HOT；备：Tavily）
 */

export interface SearchResult {
  title: string
  url: string
  content: string
  score: number
  source: string
  publishedAt: string
  category: string
}

export interface SearchOutput {
  searchDate: string
  source: string
  queries: string[]
  totalResults: number
  results: SearchResult[]
}

interface SearchNewsOptions {
  aihotBase?: string
  aihotCategory?: string
  sinceHours?: number
  minCount?: number
  userAgent?: string
  tavilyApiKey?: string
}

function isoNHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

async function fetchAiHot(opts: Required<Pick<SearchNewsOptions, 'aihotBase' | 'aihotCategory' | 'userAgent'>>, sinceHours: number): Promise<SearchResult[]> {
  const sinceIso = isoNHoursAgo(sinceHours)
  const url = `${opts.aihotBase}/api/public/items?mode=all&category=${encodeURIComponent(opts.aihotCategory)}&since=${encodeURIComponent(sinceIso)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': opts.userAgent,
      'Accept': 'application/json'
    }
  })
  if (!res.ok) {
    throw new Error(`AI HOT API ${res.status}: ${await res.text().catch(() => '')}`)
  }
  const data: any = await res.json()
  const items = Array.isArray(data.items) ? data.items : []
  return items.map((it: any, idx: number) => ({
    title: it.title || it.title_en || '',
    url: it.url || '',
    content: it.summary || '',
    score: 1 - idx / Math.max(items.length, 1),
    source: it.source || '',
    publishedAt: it.publishedAt || '',
    category: it.category || opts.aihotCategory
  }))
}

const TAVILY_QUERIES = [
  'AI大模型 最新新闻 今日',
  'OpenAI Google Anthropic latest AI news today'
]

async function tavilySearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: 10,
      include_answer: false,
      include_raw_content: false
    })
  })
  if (!res.ok) throw new Error(`Tavily API ${res.status}`)
  const data: any = await res.json()
  return (data.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
    source: '',
    publishedAt: '',
    category: ''
  }))
}

export async function searchNews(
  options: SearchNewsOptions = {},
  onLog?: (msg: string) => void
): Promise<SearchOutput> {
  const log = onLog || console.log
  const aihotBase = options.aihotBase || process.env.AIHOT_BASE || 'https://aihot.virxact.com'
  const aihotCategory = options.aihotCategory || process.env.AIHOT_CATEGORY || 'ai-models'
  const sinceHours = options.sinceHours || Number(process.env.AIHOT_SINCE_HOURS || 24)
  const minCount = options.minCount || Number(process.env.AIHOT_MIN_COUNT || 25)
  const userAgent = options.userAgent || process.env.AIHOT_USER_AGENT || 'FlowStudio/1.0'
  const tavilyApiKey = options.tavilyApiKey || process.env.TAVILY_API_KEY || ''

  let results: SearchResult[] = []
  let sourceUsed = 'aihot'
  let queries: string[] = []

  try {
    log(`[AI HOT] mode=all category=${aihotCategory} since=${sinceHours}h`)
    results = await fetchAiHot({ aihotBase, aihotCategory, userAgent }, sinceHours)
    log(`→ ${results.length} 条`)

    if (results.length < minCount) {
      log(`⚠️ 不足 ${minCount} 条，回退 48h 窗口`)
      const wider = await fetchAiHot({ aihotBase, aihotCategory, userAgent }, 48)
      if (wider.length > results.length) {
        results = wider
        log(`→ 扩展后 ${results.length} 条`)
      }
    }
    queries = [`AI HOT mode=all&category=${aihotCategory}&since=${sinceHours}h`]
  } catch (err: any) {
    log(`❌ AI HOT 失败: ${err.message}`)
    if (tavilyApiKey) {
      log(`🔁 尝试 Tavily 兜底...`)
      for (const q of TAVILY_QUERIES) {
        try {
          const rs = await tavilySearch(q, tavilyApiKey)
          results.push(...rs)
          log(`[Tavily] "${q}" → ${rs.length} 条`)
        } catch (e: any) {
          log(`[Tavily] ⚠️ ${q} 失败: ${e.message}`)
        }
      }
      sourceUsed = 'tavily'
      queries = TAVILY_QUERIES
    }
  }

  if (results.length === 0) {
    throw new Error('所有信源都失败或无数据')
  }

  // 去重（按 URL）
  const seen = new Set<string>()
  const deduped = results.filter(r => {
    if (!r.url || seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  if (sourceUsed === 'tavily') {
    deduped.sort((a, b) => (b.score || 0) - (a.score || 0))
  }

  return {
    searchDate: new Date().toISOString().slice(0, 10),
    source: sourceUsed,
    queries,
    totalResults: deduped.length,
    results: deduped
  }
}
