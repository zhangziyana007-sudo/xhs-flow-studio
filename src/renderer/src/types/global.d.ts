import type { Task, PipelineConfig, TriggerConfig } from '../../../shared/types'

declare global {
  interface Window {
    api?: {
      scheduler: {
        list: () => Promise<Task[]>
        create: (task: any) => Promise<Task>
        toggle: (id: string, enabled: boolean) => Promise<Task>
        delete: (id: string) => Promise<{ success: boolean }>
        runNow: (id: string) => Promise<{ success: boolean; outputDir?: string; error?: string }>
      }
      task: {
        get: (id: string) => Promise<Task | undefined>
        update: (id: string, updates: Partial<Pick<Task, 'name' | 'description' | 'pipeline' | 'trigger'>>) => Promise<{ success: boolean; task?: Task; error?: string }>
        runStep: (id: string, step: string) => Promise<{ success: boolean; error?: string; [key: string]: any }>
        getOutput: (id: string) => Promise<{ images: string[]; dataJson: any; outputPath?: string }>
        aiConfig: (message: string) => Promise<{ success: boolean; cards?: any[]; error?: string }>
      }
      creative: {
        createTask: (name?: string) => Promise<Task>
        run: (input: { urls?: string[]; text?: string; prompt?: string; taskId?: string }) => Promise<{ success: boolean; outputDir?: string; taskId?: string; error?: string }>
      }
      settings: {
        get: () => Promise<any>
        set: (settings: any) => Promise<{ success: boolean }>
        testLLM: (config: any) => Promise<{ success: boolean; status?: number; error?: string }>
      }
      templates: {
        list: () => Promise<{ id: string; name: string; desc: string }[]>
      }
      on: (channel: string, callback: (...args: any[]) => void) => any
      off: (channel: string, callback: any) => void
      shell: {
        openPath: (path: string) => void
      }
    }
  }
}

export {}
