/**
 * AgentChat — 通用 Agent 对话组件
 * 各面板可复用，提供统一的 AI 对话交互体验
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Check, Sparkles } from 'lucide-react'

interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: { tool: string; args: any; result: any }[]
}

interface AgentChatProps {
  taskId: string
  placeholder?: string
  description?: string
  /** Agent API 调用函数 */
  invoke: (taskId: string, message: string, history?: any[]) => Promise<{
    success: boolean
    reply?: string
    actions?: any[]
    error?: string
  }>
  /** Agent 执行操作后的回调（刷新面板数据等） */
  onAction?: () => void
}

export default function AgentChat({ taskId, placeholder, description, invoke, onAction }: AgentChatProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    setLoading(true)
    setError('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const result = await invoke(taskId, msg, history)
    setLoading(false)

    if (result.success) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.reply || '完成',
        actions: result.actions
      }])
      if (result.actions && result.actions.length > 0 && onAction) {
        onAction()
      }
    } else {
      setError(result.error || '执行失败')
    }
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-purple-500" />
        <span className="text-xs font-medium text-purple-700">AI 助手</span>
      </div>

      {/* 对话历史 */}
      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-48 overflow-y-auto mb-3 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`text-xs px-3 py-2 rounded-lg ${
              msg.role === 'user'
                ? 'bg-blue-50 text-blue-800 ml-8'
                : 'bg-white text-gray-700 mr-8 border border-gray-100'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-1">
                  {msg.actions.map((a, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-[11px] text-green-600">
                      <Check size={10} />
                      <span>{a.result?.message || `${a.tool}(${JSON.stringify(a.args).slice(0, 50)})`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-purple-500 px-3 py-2">
              <Loader2 size={12} className="animate-spin" />
              AI 正在操作...
            </div>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      {/* 输入框 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
          className="flex-1 px-3 py-2 rounded-lg border border-purple-200 text-sm bg-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          placeholder={placeholder || '告诉 AI 你想怎么配置...'}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      {description && <p className="mt-2 text-[11px] text-gray-400">{description}</p>}
    </div>
  )
}
