import { useState } from 'react'
import { Inbox, Sparkles, Palette, Eye, ListTodo, ChevronRight, Timer, Store, Settings, ArrowLeft } from 'lucide-react'
import SourcePanel from './panels/SourcePanel'
import GeneratePanel from './panels/GeneratePanel'
import StylePanel from './panels/StylePanel'
import PreviewPanel from './panels/PreviewPanel'
import TaskPanel from './panels/TaskPanel'
import TriggerPanel from './panels/TriggerPanel'
import MarketPanel from './panels/MarketPanel'
import SettingsPanel from './panels/SettingsPanel'

type PanelType = 'source' | 'generate' | 'style' | 'preview' | 'trigger' | 'task' | 'market' | 'settings'

const creationSteps: { id: PanelType; label: string; icon: typeof Inbox }[] = [
  { id: 'source', label: '素材', icon: Inbox },
  { id: 'generate', label: 'AI 创作', icon: Sparkles },
  { id: 'style', label: '样式', icon: Palette },
  { id: 'preview', label: '预览出图', icon: Eye },
  { id: 'trigger', label: '触发器', icon: Timer }
]

export default function App() {
  const [activePanel, setActivePanel] = useState<PanelType>('task')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState<string | null>(null)

  // 是否处于编辑任务的创作流程中
  const isEditing = editingTaskId !== null
  const isCreationPanel = isEditing && activePanel !== 'task' && activePanel !== 'market' && activePanel !== 'settings'
  const currentStepIndex = creationSteps.findIndex((s) => s.id === activePanel)

  // 从任务卡片点击编辑 → 进入创作流程
  const handleEditTask = (taskId: string, taskName: string) => {
    setEditingTaskId(taskId)
    setEditingTaskName(taskName)
    setActivePanel('source')
  }

  // 退出编辑 → 回到任务列表
  const handleExitEdit = () => {
    setEditingTaskId(null)
    setEditingTaskName(null)
    setActivePanel('task')
  }

  return (
    <div className="flex h-screen bg-gray-50/80">
      {/* 左侧导航 */}
      <nav className="w-56 bg-gray-50/90 backdrop-blur-sm border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-800">FlowStudio</h1>
          <p className="text-xs text-gray-400 mt-0.5">小红书图文创作工作台</p>
        </div>

        <div className="flex-1 px-3 py-4 flex flex-col gap-1">
          {/* 编辑模式：显示创作流程步骤 */}
          {isEditing && (
            <>
              <button
                onClick={handleExitEdit}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-left text-gray-500 hover:bg-white/60 transition-all mb-2"
              >
                <ArrowLeft size={16} />
                <span className="text-sm">返回任务列表</span>
              </button>
              <div className="px-3.5 mb-3">
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl">
                  编辑: {editingTaskName}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mb-4">
                {creationSteps.map((step, index) => {
                  const Icon = step.icon
                  const isActive = activePanel === step.id
                  const isDone = isCreationPanel && currentStepIndex > index
                  return (
                    <button
                      key={step.id}
                      onClick={() => setActivePanel(step.id)}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : isDone
                            ? 'text-green-600 hover:bg-white/60'
                            : 'text-gray-500 hover:bg-white/60'
                      }`}
                      style={isActive ? { boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)' } : undefined}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : isDone
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                        style={isActive ? { boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)' } : undefined}
                      >
                        {isDone ? '✓' : index + 1}
                      </div>
                      <span className="text-sm">{step.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* 非编辑模式 / 始终显示的主导航 */}
          {!isEditing && (
            <>
              {/* 任务 */}
              <button
                onClick={() => setActivePanel('task')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-300 ${
                  activePanel === 'task' ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-white/60'
                }`}
                style={activePanel === 'task' ? {
                  boxShadow: '0 4px 8px rgba(37, 99, 235, 0.06), 0 8px 20px rgba(0, 0, 0, 0.04)'
                } : undefined}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    activePanel === 'task' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                  style={activePanel === 'task' ? { boxShadow: '0 3px 8px rgba(37, 99, 235, 0.3)' } : { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                >
                  <ListTodo size={18} />
                </div>
                <span className="flex-1 text-sm font-semibold">任务</span>
              </button>

              {/* 广场 */}
              <button
                onClick={() => setActivePanel('market')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-300 ${
                  activePanel === 'market' ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-white/60'
                }`}
                style={activePanel === 'market' ? {
                  boxShadow: '0 4px 8px rgba(37, 99, 235, 0.06), 0 8px 20px rgba(0, 0, 0, 0.04)'
                } : undefined}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    activePanel === 'market' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                  style={activePanel === 'market' ? { boxShadow: '0 3px 8px rgba(37, 99, 235, 0.3)' } : { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                >
                  <Store size={18} />
                </div>
                <span className="flex-1 text-sm font-semibold">广场</span>
              </button>

              {/* 设置 */}
              <button
                onClick={() => setActivePanel('settings')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-300 ${
                  activePanel === 'settings' ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-white/60'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    activePanel === 'settings' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <Settings size={18} />
                </div>
                <span className="flex-1 text-sm font-semibold">设置</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* 顶部进度指示（仅编辑模式下的创作流程） */}
        {isCreationPanel && (
          <div className="flex items-center gap-1 px-6 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-100">
            {creationSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <span
                  className={`text-xs px-3 py-1.5 rounded-xl ${
                    activePanel === step.id
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : currentStepIndex > index
                        ? 'text-green-600'
                        : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {index < creationSteps.length - 1 && (
                  <ChevronRight size={14} className="text-gray-300 mx-1" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* 面板内容 */}
        <div className="flex-1 overflow-hidden">
          {activePanel === 'source' && <SourcePanel taskId={editingTaskId} onNext={() => setActivePanel('generate')} onTaskNameChange={(name) => setEditingTaskName(name)} />}
          {activePanel === 'generate' && <GeneratePanel taskId={editingTaskId} onNext={() => setActivePanel('style')} />}
          {activePanel === 'style' && <StylePanel taskId={editingTaskId} onNext={() => setActivePanel('preview')} />}
          {activePanel === 'preview' && <PreviewPanel taskId={editingTaskId} />}
          {activePanel === 'trigger' && <TriggerPanel taskId={editingTaskId} />}
          {activePanel === 'task' && <TaskPanel onEditTask={handleEditTask} />}
          {activePanel === 'market' && <MarketPanel />}
          {activePanel === 'settings' && <SettingsPanel onClose={() => setActivePanel('task')} />}
        </div>
      </main>
    </div>
  )
}
