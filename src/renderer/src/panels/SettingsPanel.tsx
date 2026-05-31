import { useState, useEffect } from 'react'
import { Save, Eye, EyeOff, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'

const api = (window as any).api as any

interface Settings {
  deepseekApiKey?: string
  aiBaseUrl?: string
  aiModel?: string
  tavilyApiKey?: string
  outputDir?: string
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warn'; msg: string } | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | 'testing' | null>(null)

  const showToast = (type: 'success' | 'error' | 'warn', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!api) { setLoading(false); return }
    api.settings.get().then((s: Settings) => {
      setSettings(s || {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!api) {
      showToast('warn', '仅 Electron 环境下可保存设置')
      return
    }
    setSaving(true)
    try {
      await api.settings.set(settings)
      showToast('success', '设置已保存')
    } catch (err: any) {
      showToast('error', `保存失败: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!api) {
      showToast('warn', '仅 Electron 环境下可测试')
      return
    }
    if (!settings.deepseekApiKey) {
      showToast('warn', '请先输入 API Key')
      return
    }
    setTestResult('testing')
    try {
      const res = await api.settings.testLLM({
        apiKey: settings.deepseekApiKey,
        baseUrl: settings.aiBaseUrl
      })
      setTestResult(res.success ? 'ok' : 'fail')
      showToast(res.success ? 'success' : 'error', res.success ? '连接成功！API 可用' : `连接失败 (${res.status || res.error || '未知错误'})`)
    } catch (err: any) {
      setTestResult('fail')
      showToast('error', `测试失败: ${err.message}`)
    }
  }

  const update = (key: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">设置</h1>
          <p className="text-sm text-gray-400 mt-0.5">配置 API 密钥和运行参数</p>
        </div>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          返回
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* DeepSeek API */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">DeepSeek API（AI 生成必需）</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Key</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 pr-10"
                    placeholder="sk-..."
                    value={settings.deepseekApiKey || ''}
                    onChange={e => update('deepseekApiKey', e.target.value)}
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  onClick={handleTest}
                  disabled={testResult === 'testing'}
                  className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 whitespace-nowrap disabled:opacity-50"
                >
                  {testResult === 'testing' ? <Loader2 size={14} className="animate-spin" /> : '测试连接'}
                </button>
                {testResult === 'ok' && <CheckCircle size={20} className="text-green-500 self-center" />}
                {testResult === 'fail' && <XCircle size={20} className="text-red-500 self-center" />}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Base URL</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="https://api.deepseek.com（默认）"
                value={settings.aiBaseUrl || ''}
                onChange={e => update('aiBaseUrl', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">模型</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="deepseek-v4-pro（默认）"
                value={settings.aiModel || ''}
                onChange={e => update('aiModel', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Tavily API */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Tavily API（备用搜索源，可选）</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">API Key</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="tvly-..."
              value={settings.tavilyApiKey || ''}
              onChange={e => update('tavilyApiKey', e.target.value)}
            />
          </div>
        </section>

        {/* 输出目录 */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">输出配置</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">输出目录（留空使用默认）</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="~/FlowStudio-Output"
              value={settings.outputDir || ''}
              onChange={e => update('outputDir', e.target.value)}
            />
          </div>
        </section>
      </div>

      {/* 底部保存 */}
      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          保存设置
        </button>
      </div>

      {/* Toast 提示 */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-yellow-50 text-yellow-700 border border-yellow-200'
        }`}>
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <XCircle size={16} />}
          {toast.type === 'warn' && <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* 非 Electron 环境提示 */}
      {!api && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700 flex items-center gap-2">
          <AlertTriangle size={14} />
          当前为浏览器预览模式，设置功能需在 Electron 桌面端使用
        </div>
      )}
    </div>
  )
}
