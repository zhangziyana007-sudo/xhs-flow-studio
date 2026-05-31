import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // 素材相关
  fetchMaterials: (source: string, config?: Record<string, unknown>) =>
    ipcRenderer.invoke('source:fetch', source, config),

  // AI 生成
  generate: (materials: unknown[], prompt: string, options?: Record<string, unknown>) =>
    ipcRenderer.invoke('generate:run', materials, prompt, options),

  // 渲染
  render: (content: unknown, template: string) =>
    ipcRenderer.invoke('render:run', content, template),

  // 截图
  screenshot: (htmlPaths: string[]) =>
    ipcRenderer.invoke('render:screenshot', htmlPaths),

  // 导出发布
  publish: (target: string, data: unknown) =>
    ipcRenderer.invoke('publish:run', target, data),

  // 定时任务
  scheduler: {
    list: () => ipcRenderer.invoke('scheduler:list'),
    create: (task: unknown) => ipcRenderer.invoke('scheduler:create', task),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('scheduler:toggle', id, enabled),
    delete: (id: string) => ipcRenderer.invoke('scheduler:delete', id),
    runNow: (id: string) => ipcRenderer.invoke('scheduler:runNow', id)
  },

  // 任务详情
  task: {
    get: (id: string) => ipcRenderer.invoke('task:get', id),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('task:update', id, updates),
    runStep: (id: string, step: string) => ipcRenderer.invoke('task:runStep', id, step),
    getOutput: (id: string) => ipcRenderer.invoke('task:getOutput', id)
  },

  // 知识创作（集成在任务卡片内）
  creative: {
    run: (input: { urls?: string[]; text?: string; prompt?: string; taskId?: string }) =>
      ipcRenderer.invoke('creative:run', input),
    createTask: (name?: string) => ipcRenderer.invoke('creative:createTask', name)
  },

  // 设置
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: unknown) => ipcRenderer.invoke('settings:set', settings),
    testLLM: (config: unknown) => ipcRenderer.invoke('settings:testLLM', config)
  },

  // 模板
  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    preview: (name: string, content: unknown) => ipcRenderer.invoke('templates:preview', name, content)
  },

  // 事件监听（流式输出等）
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const handler = (_event: any, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return handler
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },

  // Shell 操作
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
