import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, Play, Loader2, AlertCircle, Palette, Check } from 'lucide-react'
import type { Task } from '../../../shared/types'
import AgentChat from '../components/AgentChat'

interface Props {
  taskId: string | null
  onNext: () => void
}

const api = window.api

export default function StylePanel({ taskId, onNext }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [templates, setTemplates] = useState<{ id: string; name: string; desc: string }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('ai-daily')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ success: boolean; message: string } | null>(null)

  const loadData = useCallback(async () => {
    if (!api || !taskId) { setLoading(false); return }
    const [t, tpls] = await Promise.all([
      api.task.get(taskId),
      api.templates.list()
    ])
    if (t) {
      setTask(t)
      setSelectedTemplate(t.pipeline.style.templateId || 'ai-daily')
    }
    setTemplates(tpls)
    setLoading(false)
  }, [taskId])

  useEffect(() => { loadData() }, [loadData])

  const handleSelectTemplate = async (templateId: string) => {
    if (!api || !taskId || !task) return
    setSelectedTemplate(templateId)
    await api.task.update(taskId, {
      pipeline: { ...task.pipeline, style: { ...task.pipeline.style, templateId } }
    })
  }

  const handleRender = async () => {
    if (!api || !taskId) return
    setRunning(true)
    setRunResult(null)
    const result = await api.task.runStep(taskId, 'render')
    setRunning(false)
    if (result.success) {
      setRunResult({ success: true, message: `渲染完成：${result.htmlFiles?.length || 0} 个 HTML 页面` })
    } else {
      setRunResult({ success: false, message: result.error || '渲染失败' })
    }
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">选择样式</h1>
          <p className="text-sm text-gray-400 mt-0.5">选择模板将文案渲染为 HTML 页面</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRender}
            disabled={running}
            className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            执行渲染
          </button>
          <button onClick={onNext} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs">
            下一步
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 执行结果 */}
      {runResult && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
          runResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {runResult.success ? '✅' : <AlertCircle size={16} />}
          {runResult.message}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* 模板列表 */}
        <label className="text-sm font-medium text-gray-600 block">可用模板</label>
        <div className="grid grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleSelectTemplate(tpl.id)}
              className={`card p-5 text-left transition-all relative ${
                selectedTemplate === tpl.id ? 'border-blue-300 bg-blue-50/50' : 'hover:border-gray-200'
              }`}
              style={selectedTemplate === tpl.id ? { boxShadow: '0 4px 12px rgba(37, 99, 235, 0.1)' } : undefined}
            >
              {selectedTemplate === tpl.id && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
              <Palette size={24} className={selectedTemplate === tpl.id ? 'text-blue-600 mb-3' : 'text-gray-400 mb-3'} />
              <p className={`text-sm font-semibold ${selectedTemplate === tpl.id ? 'text-blue-700' : 'text-gray-700'}`}>{tpl.name}</p>
              <p className="text-xs text-gray-400 mt-1">{tpl.desc}</p>
            </button>
          ))}
        </div>

        {/* 渲染说明 */}
        <div className="card p-4 bg-blue-50/30 border-blue-100 mt-6">
          <p className="text-xs text-blue-600 font-medium mb-1">💡 渲染流程</p>
          <p className="text-xs text-gray-500">
            data.json + HTML模板 → 生成分页 HTML 文件 → 下一步截图生成 PNG 图片（3:4 比例 900×1200 @2x）
          </p>
        </div>

        {/* AI Agent */}
        {taskId && (
          <AgentChat
            taskId={taskId}
            invoke={(tid, msg, hist) => api!.agent.style(tid, msg, hist)}
            onAction={loadData}
            placeholder="例如：帮我换成知识卡片模板，然后执行渲染"
            description="AI 助手可以选择模板、执行渲染操作"
          />
        )}
      </div>
    </div>
  )
}
