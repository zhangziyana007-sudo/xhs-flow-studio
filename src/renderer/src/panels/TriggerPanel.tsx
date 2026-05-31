import { useState, useEffect, useCallback } from 'react'
import { Clock, Play, Calendar, Loader2, Check } from 'lucide-react'
import type { Task, TriggerConfig } from '../../../shared/types'

interface Props {
  taskId: string | null
}

const cronPresets = [
  { label: '每天 8:00', value: '0 8 * * *' },
  { label: '每天 9:00', value: '0 9 * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每 6 小时', value: '0 */6 * * *' },
  { label: '每 12 小时', value: '0 */12 * * *' }
]

const api = window.api

export default function TriggerPanel({ taskId }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [trigger, setTrigger] = useState<TriggerConfig>({ type: 'manual', enabled: true })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  const loadTask = useCallback(async () => {
    if (!api || !taskId) { setLoading(false); return }
    const t = await api.task.get(taskId)
    if (t) {
      setTask(t)
      setTrigger(t.trigger)
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => { loadTask() }, [loadTask])

  const saveTrigger = async (newTrigger: TriggerConfig) => {
    if (!api || !taskId) return
    setTrigger(newTrigger)
    await api.task.update(taskId, { trigger: newTrigger })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">触发器配置</h1>
          <p className="text-sm text-gray-400 mt-0.5">设置任务的执行方式和运行时间</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-xl">
            <Check size={12} />
            已保存
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* 执行模式 */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-3 block">执行模式</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => saveTrigger({ ...trigger, type: 'manual' })}
              className={`card p-4 text-left ${trigger.type === 'manual' ? 'border-blue-200 bg-blue-50/50' : ''}`}
              style={trigger.type === 'manual' ? { boxShadow: '0 4px 12px rgba(37, 99, 235, 0.1)' } : undefined}
            >
              <Play size={20} className={trigger.type === 'manual' ? 'text-blue-600 mb-2' : 'text-gray-400 mb-2'} />
              <p className={`text-sm font-semibold ${trigger.type === 'manual' ? 'text-blue-700' : 'text-gray-700'}`}>手动执行</p>
              <p className="text-xs text-gray-400 mt-0.5">每次手动点击运行</p>
            </button>
            <button
              onClick={() => saveTrigger({ ...trigger, type: 'scheduled', cron: trigger.cron || '0 8 * * *' })}
              className={`card p-4 text-left ${trigger.type === 'scheduled' ? 'border-blue-200 bg-blue-50/50' : ''}`}
              style={trigger.type === 'scheduled' ? { boxShadow: '0 4px 12px rgba(37, 99, 235, 0.1)' } : undefined}
            >
              <Clock size={20} className={trigger.type === 'scheduled' ? 'text-blue-600 mb-2' : 'text-gray-400 mb-2'} />
              <p className={`text-sm font-semibold ${trigger.type === 'scheduled' ? 'text-blue-700' : 'text-gray-700'}`}>定时执行</p>
              <p className="text-xs text-gray-400 mt-0.5">按 Cron 表达式周期运行</p>
            </button>
          </div>
        </div>

        {/* Cron 配置（定时模式） */}
        {trigger.type === 'scheduled' && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">定时配置</span>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1.5 block">Cron 表达式</label>
              <input
                type="text"
                value={trigger.cron || ''}
                onChange={(e) => saveTrigger({ ...trigger, cron: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-mono focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="分 时 日 月 周"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-2 block">快捷选择</label>
              <div className="flex flex-wrap gap-2">
                {cronPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => saveTrigger({ ...trigger, cron: preset.value })}
                    className={`px-3 py-1.5 rounded-xl text-xs transition-all ${
                      trigger.cron === preset.value
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-gray-50 text-gray-500 border border-gray-100 hover:border-blue-200 hover:text-blue-500'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 启用/禁用 */}
        <div className="card p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={trigger.enabled}
              onChange={(e) => saveTrigger({ ...trigger, enabled: e.target.checked })}
              className="w-4 h-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">启用此触发器</span>
          </label>
        </div>
      </div>
    </div>
  )
}
