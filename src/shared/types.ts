/** 数据源脚本卡片 — 每个卡片是一个可执行的数据获取单元 */
export interface SourceCard {
  id: string
  name: string                  // 如 "AI热点新闻拉取"、"网页文章抓取"
  type: 'api-fetch' | 'url-scrape' | 'rss' | 'video-subtitle' | 'manual-text'
  runMode: 'auto' | 'manual'   // auto=任务运行时自动执行, manual=需手动输入URL后执行
  config: {
    // api-fetch 配置
    apiUrl?: string             // API 地址
    category?: string           // 分类
    sinceHours?: number         // 拉取时间窗口
    minCount?: number           // 最少结果数
    // url-scrape 配置
    urls?: string[]             // 待抓取的 URL 列表
    // rss 配置
    feedUrl?: string
    // video-subtitle 配置
    videoUrl?: string
    // manual-text 配置
    text?: string
    // 通用
    keywords?: string[]
    maxItems?: number
  }
  lastRun?: {
    at: number
    outputFile?: string         // 输出的 markdown 文件路径
    itemCount?: number
  }
}

/** 任务管道 - 素材源配置（现在是卡片数组） */
export interface SourceConfig {
  cards: SourceCard[]
}

/** 任务管道 - AI创作配置 */
export interface GenerateConfig {
  model: string
  mode: 'daily-report' | 'knowledge-extract' | 'custom'  // 日报整合 | 知识提取 | 自定义
  prompt: string
  temperature?: number
}

/** 知识卡片数据结构 — AI 输出格式 */
export interface KnowledgeCard {
  title: string                   // 卡片标题
  subtitle?: string               // 副标题/来源
  points: string[]                // 知识点列表
  highlight?: string              // 重点高亮文本
  category?: string               // 分类标签
}

/** AI 生成结果 — 知识提取模式 */
export interface KnowledgeOutput {
  topic: string                   // 主题
  summary: string                 // 一句话概要
  cards: KnowledgeCard[]          // 知识卡片列表（每张一页）
  source?: string                 // 素材来源
}

/** 任务管道 - 样式配置 */
export interface StyleConfig {
  templateId: string
  overrides?: Record<string, string>
}

/** 任务管道 - 输出配置 */
export interface OutputConfig {
  format: 'png' | 'pdf' | 'html'
  exportPath?: string
  publishMode: 'immediate' | 'review' | 'save-only'
  channels: PublishChannel[]
}

/** 发布渠道 */
export interface PublishChannel {
  id: string
  type: 'local' | 'xhs-package' | 'feishu' | 'wecom' | 'dingtalk' | 'api' | 'webhook'
  name: string
  enabled: boolean
  config: {
    webhookUrl?: string
    apiEndpoint?: string
    directory?: string
    includeText?: boolean
    template?: string
  }
}

/** 完整管道配置 */
export interface PipelineConfig {
  source: SourceConfig
  generate: GenerateConfig
  style: StyleConfig
  output: OutputConfig
}

/** 触发方式 */
export interface TriggerConfig {
  type: 'scheduled' | 'manual'
  cron?: string
  enabled: boolean
}

/** 运行记录 */
export interface RunRecord {
  at: number
  status: 'success' | 'failed' | 'running'
  outputPath?: string
  error?: string
}

/** 待审核发布项 */
export interface PendingPublish {
  id: string
  taskId: string
  taskName: string
  createdAt: number
  outputPath: string
  imageCount: number
  thumbnails?: string[]
  channels: PublishChannel[]
}

/** 工作流类型 */
export type WorkflowType = 'auto-report' | 'manual-creative'

/** 任务 */
export interface Task {
  id: string
  name: string
  description?: string
  workflowType: WorkflowType       // 自动定时报告 or 手动创作
  createdAt: number
  updatedAt: number
  pipeline: PipelineConfig
  trigger: TriggerConfig
  lastRun?: RunRecord
  runCount: number
}
