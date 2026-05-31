import { useState, useEffect, useCallback } from 'react'
import { Plus, Clock, Play, Pencil, Trash2, ToggleLeft, ToggleRight, Calendar, Zap, Loader2, FolderOpen } from 'lucide-react'
import type { Task } from '../../../shared/types'

const api = window.api

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

interface Props {
  onEditTask?: (taskId: string, taskName: string) => void
}

export default function TaskPanel({ onEditTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set())
  const [progressLog, setProgressLog] = useState<Record<string, { step: string; message: string; progress: number }>>({})

  const loadTasks = useCallback(async () => {
    if (!api) { setLoading(false); return }
    try { setTasks(await api.scheduler.list()) }
    catch (err) { console.error('Failed to load tasks:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  // 监听进度
  useEffect(() => {
    if (!api) return
    const handler = (data: { taskId: string; step: string; message: string; progress: number }) => {
      setProgressLog(prev => ({ ...prev, [data.taskId]: data }))
      if (data.step === 'done' || data.step === 'error') {
        setRunningTasks(prev => { const n = new Set(prev); n.delete(data.taskId); return n })
        loadTasks()
      }
    }
    const unsub = api.on('task:progress', handler)
    return () => { api.off('task:progress', unsub) }
  }, [loadTasks])

  const handleRun = async (taskId: string) => {
    if (!api) return
    setRunningTasks(prev => new Set(prev).add(taskId))
    setProgressLog(prev => ({ ...prev, [taskId]: { step: 'starting', message: '准备中...', progress: 0 } }))
    const result = await api.scheduler.runNow(taskId)
    if (!result.success) {
      setProgressLog(prev => ({ ...prev, [taskId]: { step: 'error', message: result.error || '执行失败', progress: 0 } }))
      setRunningTasks(prev => { const n = new Set(prev); n.delete(taskId); return n })
      loadTasks()
    }
  }

  const handleNewTask = async () => {
    if (!api) return
    const task = await api.creative.createTask()
    loadTasks()
    // 创建后直接进入编辑
    if (task && onEditTask) onEditTask(task.id, task.name)
  }

  const handleDelete = async (taskId: string) => { if (api) { await api.scheduler.delete(taskId); loadTasks() } }
  const handleToggle = async (taskId: string, enabled: boolean) => { if (api) { await api.scheduler.toggle(taskId, enabled); loadTasks() } }
  const handleOpenOutput = (path: string) => { if (api) api.shell.openPath(path) }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">我的任务</h1>
          <p className="text-sm text-gray-400 mt-0.5">点击编辑进入创作流程，配置数据源和生成规则</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm" onClick={handleNewTask}>
          <Plus size={16} />新建任务
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-4">
          {tasks.map((task) => {
            const isRunning = runningTasks.has(task.id)
            const progress = progressLog[task.id]

            return (
              <div key={task.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-semibold text-gray-800 truncate">{task.name}</h3>
                      {task.trigger.type === 'scheduled' ? (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium"><Calendar size={12} />定时</span>
                      ) : (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 bg-orange-50 text-orange-600 rounded-full text-xs font-medium"><Zap size={12} />手动</span>
                      )}
                      {!isRunning && task.lastRun?.status === 'success' && <span className="w-2 h-2 bg-green-400 rounded-full" />}
                      {!isRunning && task.lastRun?.status === 'failed' && <span className="w-2 h-2 bg-red-400 rounded-full" />}
                      {isRunning && <Loader2 size={14} className="animate-spin text-blue-500" />}
                    </div>
                    {task.description && <p className="text-sm text-gray-400 mt-1 truncate">{task.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {task.trigger.type === 'scheduled' && task.trigger.cron && <span className="flex items-center gap-1"><Clock size={12} />{task.trigger.cron}</span>}
                      {task.lastRun && <span>上次: {formatTime(task.lastRun.at)}</span>}
                      {task.runCount > 0 && <span>已运行 {task.runCount} 次</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {task.trigger.type === 'scheduled' && (
                      <button className="p-2 rounded-xl hover:bg-gray-50 transition-colors" title={task.trigger.enabled ? '暂停' : '启用'} onClick={() => handleToggle(task.id, !task.trigger.enabled)}>
                        {task.trigger.enabled ? <ToggleRight size={22} className="text-blue-600" /> : <ToggleLeft size={22} className="text-gray-300" />}
                      </button>
                    )}
                    <button className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50" onClick={() => handleRun(task.id)} disabled={isRunning}>
                      {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {isRunning ? '运行中' : '运行'}
                    </button>
                    <button className="p-2 rounded-xl hover:bg-gray-50 transition-colors" title="编辑" onClick={() => onEditTask?.(task.id, task.name)}>
                      <Pencil size={16} className="text-gray-400" />
                    </button>
                    <button className="p-2 rounded-xl hover:bg-gray-50 transition-colors" title="删除" onClick={() => handleDelete(task.id)}>
                      <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>

                {/* 运行进度 */}
                {isRunning && progress && (
                  <div className="mt-3 px-3 py-2 bg-blue-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-blue-700 font-medium">{progress.message}</span>
                      <span className="text-xs text-blue-500">{progress.progress}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress.progress}%` }} />
                    </div>
                  </div>
                )}

                {/* 结果 */}
                {!isRunning && task.lastRun?.status === 'failed' && task.lastRun.error && (
                  <div className="mt-3 px-3 py-2 bg-red-50 rounded-xl text-xs text-red-600">{task.lastRun.error}</div>
                )}
                {!isRunning && task.lastRun?.status === 'success' && task.lastRun.outputPath && (
                  <div className="mt-3 px-3 py-2 bg-green-50 rounded-xl text-xs text-green-700 flex items-center justify-between">
                    <span className="flex items-center gap-2 truncate"><FolderOpen size={13} />{task.lastRun.outputPath}</span>
                    <button onClick={() => handleOpenOutput(task.lastRun!.outputPath!)} className="ml-2 px-2 py-1 bg-green-100 rounded text-green-700 hover:bg-green-200 transition-colors whitespace-nowrap">打开</button>
                  </div>
                )}
                {!isRunning && progress?.step === 'error' && (
                  <div className="mt-3 px-3 py-2 bg-red-50 rounded-xl text-xs text-red-600">{progress.message}</div>
                )}
              </div>
            )
          })}
        </div>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Zap size={48} className="mb-4 opacity-30" />
            <p className="text-sm">还没有任务，点击右上角新建</p>
          </div>
        )}
      </div>
    </div>
  )
}
