import { useState, useEffect, useCallback } from 'react'
import { Sparkles, ArrowRight, Play, Loader2, AlertCircle, Settings, FileText } from 'lucide-react'
import type { Task, GenerateConfig } from '../../../shared/types'
import AgentChat from '../components/AgentChat'

interface Props {
  taskId: string | null
  onNext: () => void
}

const modeOptions: { id: GenerateConfig['mode']; label: string; desc: string }[] = [
  { id: 'daily-report', label: '日报整合', desc: '多条素材精选为一期日报' },
  { id: 'knowledge-extract', label: '知识提炼', desc: '提取核心知识点生成卡片' },
  { id: 'custom', label: '自定义', desc: '自由输入 Prompt 控制输出' }
]

const api = window.api

export default function GeneratePanel({ taskId, onNext }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [config, setConfig] = useState<GenerateConfig>({
    model: 'deepseek-v4-pro',
    mode: 'daily-report',
    prompt: '',
    temperature: 0.3
  })
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const loadTask = useCallback(async () => {
    if (!api || !taskId) { setLoading(false); return }
    const t = await api.task.get(taskId)
    if (t) {
      setTask(t)
      setConfig(t.pipeline.generate)
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => { loadTask() }, [loadTask])

  const saveConfig = async (newConfig: GenerateConfig) => {
    if (!api || !taskId || !task) return
    setConfig(newConfig)
    await api.task.update(taskId, {
      pipeline: { ...task.pipeline, generate: newConfig }
    })
  }

  const handleModeChange = (mode: GenerateConfig['mode']) => {
    const prompts: Record<string, string> = {
      'daily-report': '精选今日最重要的20条AI大模型新闻',
      'knowledge-extract': '提炼核心知识点，生成教学卡片',
      'custom': config.prompt || ''
    }
    saveConfig({ ...config, mode, prompt: prompts[mode] || '' })
  }

  const handleRunGenerate = async () => {
    if (!api || !taskId) return
    setRunning(true)
    setRunResult(null)
    const result = await api.task.runStep(taskId, 'generate')
    setRunning(false)
    if (result.success) {
      setRunResult({ success: true, message: 'AI 生成完成！可进入下一步渲染。' })
    } else {
      setRunResult({ success: false, message: result.error || '生成失败' })
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
          <h1 className="text-xl font-semibold text-gray-800">AI 创作</h1>
          <p className="text-sm text-gray-400 mt-0.5">选择加工模式，AI 将素材转化为结构化文案</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunGenerate}
            disabled={running}
            className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            执行生成
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

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* 加工模式 */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-3 block">加工模式</label>
          <div className="grid grid-cols-3 gap-3">
            {modeOptions.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                className={`card p-4 text-left transition-all ${
                  config.mode === mode.id ? 'border-blue-200 bg-blue-50/50' : 'hover:border-gray-200'
                }`}
                style={config.mode === mode.id ? { boxShadow: '0 4px 12px rgba(37, 99, 235, 0.1)' } : undefined}
              >
                <Sparkles size={18} className={config.mode === mode.id ? 'text-blue-600 mb-2' : 'text-gray-400 mb-2'} />
                <p className={`text-sm font-semibold ${config.mode === mode.id ? 'text-blue-700' : 'text-gray-700'}`}>{mode.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-2 block">
            <FileText size={14} className="inline mr-1" />
            创作指令 (Prompt)
          </label>
          <textarea
            value={config.prompt}
            onChange={(e) => saveConfig({ ...config, prompt: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm resize-none focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
            rows={4}
            placeholder="描述你想要的创作方向..."
          />
        </div>

        {/* 高级设置 */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <Settings size={14} />
            高级设置
          </button>
          {showAdvanced && (
            <div className="mt-3 card p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">模型</label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => saveConfig({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono bg-gray-50 focus:outline-none focus:border-blue-300"
                  placeholder="deepseek-v4-pro"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">温度 (Temperature): {config.temperature ?? 0.3}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={config.temperature ?? 0.3}
                  onChange={(e) => saveConfig({ ...config, temperature: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>精确</span>
                  <span>创意</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 管道说明 */}
        <div className="card p-4 bg-blue-50/30 border-blue-100">
          <p className="text-xs text-blue-600 font-medium mb-1">💡 执行流程</p>
          <p className="text-xs text-gray-500">
            素材 markdown → DeepSeek API (JSON模式) → 结构化文案数据 → 保存为 data.json
          </p>
        </div>

        {/* AI Agent */}
        {taskId && (
          <AgentChat
            taskId={taskId}
            invoke={(tid, msg, hist) => api!.agent.generate(tid, msg, hist)}
            onAction={loadTask}
            placeholder="例如：帮我切换到知识提炼模式，温度调高一点"
            description="AI 助手可以直接帮你修改创作配置（模式、模型、提示词、温度）"
          />
        )}
      </div>
    </div>
  )
}
