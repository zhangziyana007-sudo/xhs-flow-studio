/**
 * generate.ts — AI 新闻结构化生成（DeepSeek API）
 */

export interface NewsItem {
  title: string
  keyFact: string
  impact: string
  category: string
  icon: string
}

export interface CoverPreview {
  rank: number
  title: string
  source: string
  icon: string
}

export interface GenerateOutput {
  date: string
  issue: string
  pages: Array<{
    type: 'cover' | 'news' | 'ending'
    title?: string[]
    subtitle?: string
    previews?: CoverPreview[]
    items?: NewsItem[]
    slogan?: string
    cta?: string
    meta?: string
  }>
}

interface GenerateOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  targetCount?: number
  searchContext?: string
  searchSource?: string
}

export async function generateNews(
  options: GenerateOptions = {},
  onLog?: (msg: string) => void
): Promise<GenerateOutput> {
  const log = onLog || console.log

  const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY
  const baseUrl = options.baseUrl || process.env.AI_BASE_URL || 'https://api.deepseek.com'
  const model = options.model || process.env.AI_MODEL || 'deepseek-v4-pro'
  const targetCount = options.targetCount || Number(process.env.AI_TARGET_COUNT || 20)

  if (!apiKey) {
    throw new Error('缺少 API 密钥，请在设置中配置 DEEPSEEK_API_KEY')
  }

  const today = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
  const issueStr = `#${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

  const systemPrompt = `你是一位资深AI大模型行业分析师，负责制作"每日AI大模型早报（Top ${targetCount}）"小红书图文。

## 推送要求
- 条数：必须精确输出 ${targetCount} 条，不能多也不能少
- 筛选：仅保留影响力最大、确定性高的核心动态，剔除传闻、琐碎更新与重复推送
- 真实：所有事实必须来源于素材；不允许编造

## 内容偏好
- 核心关注：国内外主流AI公司的大模型版本更新与API/订阅价格变动
- 重点监控厂商：OpenAI, Google, Microsoft, Anthropic, Meta, xAI, DeepSeek, 智谱AI, 月之暗面, 阿里巴巴, 百度, 字节跳动, 腾讯, 小米

## 信息卡片格式
- title：【厂商】+ 核心动作（≤24字）
- keyFact：核心变化一句话（≤55字）
- impact：影响评语（≤32字）
- category：来源网站名（≤6字）

## 输出要求
严格输出JSON格式（不要输出markdown代码块）：

{
  "date": "${dateStr}",
  "issue": "${issueStr}",
  "pages": [
    {
      "type": "cover",
      "title": ["${dateStr}", "AI 大模型新闻早报"],
      "subtitle": "三个关键词 · 用中间点分隔",
      "previews": [
        {"rank": 1, "title": "【厂商】核心动作", "source": "来源", "icon": "zap"},
        {"rank": 2, "title": "【厂商】核心动作", "source": "来源", "icon": "cpu"},
        {"rank": 3, "title": "【厂商】核心动作", "source": "来源", "icon": "rocket"},
        {"rank": 4, "title": "【厂商】核心动作", "source": "来源", "icon": "brain"}
      ]
    },
    {
      "type": "news",
      "items": [/* ${targetCount} 条 */]
    },
    {
      "type": "ending",
      "slogan": "AI大模型早报 · 每日精选Top ${targetCount}",
      "cta": "关注获取每日推送",
      "meta": "数据来源：公开报道与行业资讯"
    }
  ]
}

关键约束：
- previews 固定 4 条
- news items 必须刚好 ${targetCount} 条
- icon 可选：zap, cpu, robot, code, sparkles, globe, rocket, brain, monitor, smartphone, star`

  const userPrompt = options.searchContext
    ? `以下是今日（${dateStr}）从 ${options.searchSource || '信源'} 拉取的素材：\n\n${options.searchContext}\n\n请精选最重要的 ${targetCount} 条生成早报。`
    : `请根据最新 AI 大模型行业动态生成今日（${dateStr}）早报 Top ${targetCount}。`

  log(`🤖 调用 ${model} 生成AI早报...`)

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 16384,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API 请求失败 (${response.status}): ${errText}`)
  }

  const result: any = await response.json()
  const content = result.choices?.[0]?.message?.content || ''
  const usage = result.usage || {}
  log(`📊 tokens: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}`)

  // 提取 JSON
  let jsonStr = content
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  const data: GenerateOutput = JSON.parse(jsonStr)

  if (!data.pages || !Array.isArray(data.pages)) {
    throw new Error('JSON 格式错误：缺少 pages 数组')
  }

  const newsCount = data.pages
    .filter(p => p.type === 'news')
    .reduce((sum, p) => sum + (p.items?.length || 0), 0)
  log(`✅ 生成完成！精选新闻: ${newsCount} 条`)

  return data
}

/** 将搜索结果格式化为 AI 上下文 */
export function formatSearchContext(results: Array<{ title: string; content: string; source: string; publishedAt: string; url: string }>): string {
  return results.slice(0, 50).map((r, i) => {
    const lines = [`[${i + 1}] ${r.title}`]
    if (r.content) lines.push(`    摘要: ${r.content.slice(0, 240)}`)
    if (r.source) lines.push(`    信源: ${r.source}`)
    if (r.publishedAt) lines.push(`    时间: ${r.publishedAt}`)
    if (r.url) lines.push(`    链接: ${r.url}`)
    return lines.join('\n')
  }).join('\n\n')
}

// ═══════════════════════════════════════════════════════════
// 知识提取模式 — 手动创作工作流
// ═══════════════════════════════════════════════════════════

export interface KnowledgeCard {
  title: string
  subtitle?: string
  points: string[]
  highlight?: string
  category?: string
}

export interface KnowledgeOutput {
  topic: string
  summary: string
  cards: KnowledgeCard[]
  source?: string
}

interface KnowledgeGenerateOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  materials: string         // 原始素材文本
  userPrompt?: string       // 用户附加的创作指令
  sourceLabel?: string      // 来源标注
}

export async function generateKnowledge(
  options: KnowledgeGenerateOptions,
  onLog?: (msg: string) => void
): Promise<KnowledgeOutput> {
  const log = onLog || console.log

  const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY
  const baseUrl = options.baseUrl || process.env.AI_BASE_URL || 'https://api.deepseek.com'
  const model = options.model || process.env.AI_MODEL || 'deepseek-v4-pro'

  if (!apiKey) {
    throw new Error('缺少 API 密钥，请在设置中配置 DEEPSEEK_API_KEY')
  }

  const systemPrompt = `你是一位擅长知识提炼的内容创作者，需要将输入的素材（文章/视频字幕/笔记）转化为结构化的"知识卡片"系列。

## 你的任务
1. 深入理解素材内容
2. 提炼核心知识点和干货
3. 将内容分成多张卡片，每张卡片聚焦一个主题/知识点
4. 每张卡片包含 2-4 个子要点，语言简洁有力

## 输出规则
- topic: 整体主题（≤20字，吸引人的标题）
- summary: 一句话概要（≤50字）
- cards: 知识卡片数组，每张卡片:
  - title: 卡片标题（≤15字）
  - subtitle: 可选副标题（≤20字）
  - points: 2-4个知识点，每个≤60字，用**加粗**标注关键词
  - highlight: 可选金句/重点总结（≤40字）
  - category: 可选分类标签（≤6字）

## 内容风格
- 干货优先，去除废话和过渡语句
- 知识点要具体、可行动，不要泛泛而谈
- 适合小红书/社交平台的教学分享风格
- 每个 point 开头用关键词加粗

## 卡片数量
- 根据内容复杂度自动决定：通常 3-8 张
- 内容少则少，内容多则多，不强制凑数

## 输出格式
严格输出 JSON（不要输出 markdown 代码块）：
{
  "topic": "主题标题",
  "summary": "一句话概要",
  "cards": [
    {
      "title": "卡片标题",
      "subtitle": "副标题",
      "points": ["**关键词**：具体知识点内容", "..."],
      "highlight": "金句或核心结论",
      "category": "分类"
    }
  ]
}`

  const userContent = options.userPrompt
    ? `用户要求：${options.userPrompt}\n\n以下是需要提炼的素材：\n\n${options.materials}`
    : `以下是需要提炼为知识卡片的素材：\n\n${options.materials}`

  log(`🧠 调用 ${model} 提取知识卡片...`)

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.5,
      max_tokens: 8192,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API 请求失败 (${response.status}): ${errText}`)
  }

  const result: any = await response.json()
  const content = result.choices?.[0]?.message?.content || ''
  const usage = result.usage || {}
  log(`📊 tokens: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}`)

  // 提取 JSON
  let jsonStr = content
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  const data: KnowledgeOutput = JSON.parse(jsonStr)

  if (!data.cards || !Array.isArray(data.cards) || data.cards.length === 0) {
    throw new Error('AI 输出格式错误：缺少 cards 数组')
  }

  log(`✅ 知识提取完成！生成 ${data.cards.length} 张知识卡片`)
  return data
}
