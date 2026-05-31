import { useState, useEffect, useCallback } from 'react'
import { Database, Globe, Rss, Video, FileText, ArrowRight, Plus, Trash2, Play, Loader2, ToggleLeft, ToggleRight, AlertCircle, Sparkles, Send, Check, X } from 'lucide-react'
import type { Task, SourceCard } from '../../../shared/types'

interface Props {
  taskId: string | null
  onNext: () => void
  onTaskNameChange?: (name: string) => void
}

type SourceType = SourceCard['type']

const sourceTypeInfo: Record<SourceType, { label: string; icon: typeof Database; desc: string }> = {
  'api-fetch': { label: 'API 拉取', icon: Database, desc: '从 REST API 获取数据' },
  'url-scrape': { label: '网页抓取', icon: Globe, desc: '抓取指定 URL 的内容' },
  'rss': { label: 'RSS 订阅', icon: Rss, desc: '订阅 RSS 源获取更新' },
  'video-subtitle': { label: '视频字幕', icon: Video, desc: '提取视频字幕作为素材' },
  'manual-text': { label: '手动文本', icon: FileText, desc: '直接输入文本素材' }
}

const api = window.api

export default function SourcePanel({ taskId, onNext, onTaskNameChange }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [cards, setCards] = useState<SourceCard[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any[] | null>(null)
  const [aiError, setAiError] = useState('')
  const [showAiHelper, setShowAiHelper] = useState(false)

  const loadTask = useCallback(async () => {
    if (!api || !taskId) { setLoading(false); return }
    const t = await api.task.get(taskId)
    if (t) {
      setTask(t)
      setCards(t.pipeline.source.cards)
      setTaskName(t.name)
      setTaskDesc(t.description || '')
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => { loadTask() }, [loadTask])

  const saveTaskInfo = async (name: string, description: string) => {
    if (!api || !taskId) return
    await api.task.update(taskId, { name, description })
    if (onTaskNameChange && name) onTaskNameChange(name)
  }

  const saveCards = async (newCards: SourceCard[]) => {
    if (!api || !taskId || !task) return
    setCards(newCards)
    await api.task.update(taskId, {
      pipeline: { ...task.pipeline, source: { cards: newCards } }
    })
  }

  const addCard = (type: SourceType) => {
    const newCard: SourceCard = {
      id: `card-${Date.now()}`,
      name: sourceTypeInfo[type].label,
      type,
      runMode: type === 'api-fetch' || type === 'rss' ? 'auto' : 'manual',
      config: type === 'api-fetch' ? {
        apiUrl: 'https://aihot.virxact.com',
        category: 'ai-models',
        sinceHours: 24,
        minCount: 25
      } : {}
    }
    saveCards([...cards, newCard])
    setShowAddCard(false)
  }

  const removeCard = (cardId: string) => {
    saveCards(cards.filter(c => c.id !== cardId))
  }

  const updateCard = (cardId: string, updates: Partial<SourceCard['config']>) => {
    const newCards = cards.map(c => c.id === cardId ? { ...c, config: { ...c.config, ...updates } } : c)
    saveCards(newCards)
  }

  const toggleCard = (cardId: string) => {
    const newCards = cards.map(c => c.id === cardId ? { ...c, runMode: c.runMode === 'auto' ? 'manual' as const : 'auto' as const } : c)
    saveCards(newCards)
  }

  const handleRunSource = async () => {
    if (!api || !taskId) return
    setRunning(true)
    setRunResult(null)
    const result = await api.task.runStep(taskId, 'source')
    setRunning(false)
    if (result.success) {
      setRunResult({ success: true, message: `获取成功：${result.totalItems} 条素材` })
    } else {
      setRunResult({ success: false, message: result.error || '执行失败' })
    }
  }

  const handleAiConfig = async () => {
    if (!api || !aiInput.trim()) return
    setAiLoading(true)
    setAiError('')
    setAiSuggestions(null)
    const result = await api.task.aiConfig(aiInput.trim())
    setAiLoading(false)
    if (result.success && result.cards?.length) {
      setAiSuggestions(result.cards)
    } else {
      setAiError(result.error || '未能生成配置建议')
    }
  }

  const handleAcceptAiCards = async () => {
    if (!aiSuggestions) return
    const newCards: SourceCard[] = aiSuggestions.map((c: any) => ({
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: c.name || '数据源',
      type: c.type || 'api-fetch',
      runMode: c.runMode || 'auto',
      config: c.config || {}
    }))
    await saveCards([...cards, ...newCards])
    setAiSuggestions(null)
    setAiInput('')
    setShowAiHelper(false)
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">素材数据源</h1>
          <p className="text-sm text-gray-400 mt-0.5">配置数据来源（默认：aihot.virxact.com AI 热点 API）</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunSource}
            disabled={running || cards.length === 0}
            className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            测试获取
          </button>
          <button onClick={onNext} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs">
            下一步
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 执行结果提示 */}
      {runResult && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
          runResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {runResult.success ? '✅' : <AlertCircle size={16} />}
          {runResult.message}
        </div>
      )}

      {/* AI 配置助手 */}
      <div className="mx-6 mt-4">
        <button
          onClick={() => setShowAiHelper(!showAiHelper)}
          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 transition-colors"
        >
          <Sparkles size={16} />
          <span className="font-medium">AI 配置助手</span>
          <span className="text-xs text-gray-400">— 用自然语言描述你想要的数据源</span>
        </button>
        {showAiHelper && (
          <div className="mt-3 p-4 rounded-xl border border-purple-100 bg-purple-50/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !aiLoading && handleAiConfig()}
                className="flex-1 px-3 py-2 rounded-lg border border-purple-200 text-sm bg-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                placeholder="例如：每天拉取 AI 模型和编程工具相关的热点新闻"
                disabled={aiLoading}
              />
              <button
                onClick={handleAiConfig}
                disabled={aiLoading || !aiInput.trim()}
                className="px-3 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>

            {aiError && (
              <p className="mt-2 text-xs text-red-500">{aiError}</p>
            )}

            {aiSuggestions && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-purple-700 font-medium">AI 建议添加以下数据源：</p>
                {aiSuggestions.map((card, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-purple-100 text-sm">
                    <Database size={14} className="text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{card.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{card.type}</span>
                      {card.config?.category && <span className="text-xs text-purple-400 ml-1">({card.config.category})</span>}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAcceptAiCards}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs hover:bg-green-600 transition-colors"
                  >
                    <Check size={12} />
                    采纳
                  </button>
                  <button
                    onClick={() => { setAiSuggestions(null); setAiInput('') }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs hover:bg-gray-300 transition-colors"
                  >
                    <X size={12} />
                    忽略
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 任务基本信息 */}
      <div className="px-6 pt-4 pb-2 space-y-2 border-b border-gray-100">
        <input
          type="text"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          onBlur={() => saveTaskInfo(taskName, taskDesc)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold bg-white focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
          placeholder="任务名称"
        />
        <input
          type="text"
          value={taskDesc}
          onChange={(e) => setTaskDesc(e.target.value)}
          onBlur={() => saveTaskInfo(taskName, taskDesc)}
          className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 bg-white focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
          placeholder="任务简介（可选）"
        />
      </div>

      {/* 数据源卡片列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {cards.length === 0 && !showAddCard && (
          <div className="flex flex-col items-center justify-center py-16">
            <Database size={48} className="text-gray-200 mb-4" />
            <p className="text-gray-500 mb-2">还没有数据源</p>
            <p className="text-sm text-gray-400 mb-4">添加一个数据源来获取素材内容</p>
            <button onClick={() => setShowAddCard(true)} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
              <Plus size={16} />
              添加数据源
            </button>
          </div>
        )}

        {cards.map((card) => {
          const typeInfo = sourceTypeInfo[card.type]
          const Icon = typeInfo?.icon || Database
          return (
            <div key={card.id} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 flex-shrink-0">
                  <Icon size={20} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">{card.name}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{typeInfo?.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${card.runMode === 'auto' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                      {card.runMode === 'auto' ? '自动' : '手动'}
                    </span>
                  </div>

                  {/* 配置表单 */}
                  {card.type === 'api-fetch' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={card.config.apiUrl || ''}
                          onChange={(e) => updateCard(card.id, { apiUrl: e.target.value })}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-mono bg-gray-50 focus:outline-none focus:border-blue-300"
                          placeholder="API URL"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={card.config.category || ''}
                          onChange={(e) => updateCard(card.id, { category: e.target.value })}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:outline-none focus:border-blue-300"
                          placeholder="分类 (如 ai-models)"
                        />
                        <input
                          type="number"
                          value={card.config.sinceHours || 24}
                          onChange={(e) => updateCard(card.id, { sinceHours: Number(e.target.value) })}
                          className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:outline-none focus:border-blue-300"
                          placeholder="时间窗口(h)"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400">数据源：aihot.virxact.com · 最近 {card.config.sinceHours || 24}h · 分类 {card.config.category || 'ai-models'}</p>
                    </div>
                  )}

                  {card.type === 'url-scrape' && (
                    <div className="mt-3">
                      <textarea
                        value={(card.config.urls || []).join('\n')}
                        onChange={(e) => updateCard(card.id, { urls: e.target.value.split('\n').filter(Boolean) })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono bg-gray-50 focus:outline-none focus:border-blue-300 resize-none"
                        rows={3}
                        placeholder="每行一个 URL"
                      />
                    </div>
                  )}

                  {card.type === 'rss' && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={card.config.feedUrl || ''}
                        onChange={(e) => updateCard(card.id, { feedUrl: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-mono bg-gray-50 focus:outline-none focus:border-blue-300"
                        placeholder="RSS Feed URL"
                      />
                    </div>
                  )}

                  {card.type === 'manual-text' && (
                    <div className="mt-3">
                      <textarea
                        value={card.config.text || ''}
                        onChange={(e) => updateCard(card.id, { text: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:outline-none focus:border-blue-300 resize-none"
                        rows={4}
                        placeholder="输入文本素材..."
                      />
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleCard(card.id)} className="p-1.5 rounded-lg hover:bg-gray-50" title="切换自动/手动">
                    {card.runMode === 'auto' ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-gray-300" />}
                  </button>
                  <button onClick={() => removeCard(card.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="删除">
                    <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* 添加数据源 */}
        {cards.length > 0 && !showAddCard && (
          <button
            onClick={() => setShowAddCard(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            添加数据源
          </button>
        )}

        {/* 添加数据源类型选择 */}
        {showAddCard && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">选择数据源类型</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(sourceTypeInfo) as [SourceType, typeof sourceTypeInfo['api-fetch']][]).map(([type, info]) => {
                const Icon = info.icon
                return (
                  <button
                    key={type}
                    onClick={() => addCard(type)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                  >
                    <Icon size={18} className="text-blue-500" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{info.label}</p>
                      <p className="text-[10px] text-gray-400">{info.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setShowAddCard(false)} className="mt-3 text-xs text-gray-400 hover:text-gray-600">取消</button>
          </div>
        )}
      </div>
    </div>
  )
}
