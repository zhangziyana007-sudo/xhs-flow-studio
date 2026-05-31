import { useState, useEffect, useCallback } from 'react'
import { Download, Image, Eye, Play, Loader2, AlertCircle, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task } from '../../../shared/types'
import AgentChat from '../components/AgentChat'

interface Props {
  taskId: string | null
}

const api = window.api

export default function PreviewPanel({ taskId }: Props) {
  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState<string[]>([])
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ success: boolean; message: string } | null>(null)

  const loadOutput = useCallback(async () => {
    if (!api || !taskId) { setLoading(false); return }
    const output = await api.task.getOutput(taskId)
    setImages(output.images || [])
    setOutputPath(output.outputPath || null)
    setLoading(false)
  }, [taskId])

  useEffect(() => { loadOutput() }, [loadOutput])

  const handleScreenshot = async () => {
    if (!api || !taskId) return
    setRunning(true)
    setRunResult(null)
    const result = await api.task.runStep(taskId, 'screenshot')
    setRunning(false)
    if (result.success) {
      setRunResult({ success: true, message: `截图完成：${result.pngFiles?.length || 0} 张 PNG` })
      loadOutput()
    } else {
      setRunResult({ success: false, message: result.error || '截图失败' })
    }
  }

  const handleOpenFolder = () => {
    if (api && outputPath) api.shell.openPath(outputPath)
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">预览 & 导出</h1>
          <p className="text-sm text-gray-400 mt-0.5">截图生成最终 PNG 图片</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScreenshot}
            disabled={running}
            className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            执行截图
          </button>
          {outputPath && (
            <button onClick={handleOpenFolder} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs">
              <FolderOpen size={14} />
              打开目录
            </button>
          )}
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

      {/* 预览区域 */}
      <div className="flex-1 flex items-center justify-center p-6">
        {images.length === 0 ? (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Eye size={40} strokeWidth={1.5} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-500">还没有输出图片</p>
            <p className="text-sm mt-1.5 text-gray-400">完成前面步骤后，点击「执行截图」生成最终图片</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            {/* 图片展示 */}
            <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
              <img
                src={`local-file://${images[currentIndex]}`}
                alt={`第 ${currentIndex + 1} 张`}
                className="w-full h-full object-contain rounded-xl border border-gray-200 bg-gray-50"
              />
            </div>

            {/* 翻页 */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-gray-500">
                {currentIndex + 1} / {images.length}
              </span>
              <button
                onClick={() => setCurrentIndex(Math.min(images.length - 1, currentIndex + 1))}
                disabled={currentIndex === images.length - 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* 信息 */}
            <p className="text-xs text-gray-400">
              输出路径: {outputPath}
            </p>
          </div>
        )}
      </div>

      {/* AI Agent */}
      {taskId && (
        <div className="px-6 pb-4">
          <AgentChat
            taskId={taskId}
            invoke={(tid, msg, hist) => api!.agent.preview(tid, msg, hist)}
            onAction={loadOutput}
            placeholder="例如：帮我执行截图 / 运行完整流程"
            description="AI 助手可以执行截图、运行全流程、查看输出信息"
          />
        </div>
      )}
    </div>
  )
}
