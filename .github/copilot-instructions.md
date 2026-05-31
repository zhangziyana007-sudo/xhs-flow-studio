# FlowStudio - AI Agent 项目指引

> 此文件为 AI 编程助手提供项目上下文和开发规范。

## 快速入门

这是一个 **Electron 31 + React 18 + TypeScript 5.5** 桌面应用，使用 `electron-vite` 构建。

```bash
cd FlowStudio
npm install
npm run dev  # 启动开发服务器 + Electron
```

## 项目定位

小红书图文自动化生产工具。用户配置数据源和 AI 参数后，一键生成可发布的 3:4 图文 PNG。

## 架构要点

### 三进程模型
- **main** (`src/main/`): Node.js 环境，管理任务、执行 pipeline、调用外部 API
- **preload** (`src/preload/`): contextBridge，暴露 `window.api` 给 renderer
- **renderer** (`src/renderer/`): React SPA，Tailwind CSS 样式

### Pipeline 架构
```
SourceCard[] → executeSourceCards() → materials.md
    → generateNews()/generateKnowledge() → data.json
    → renderPages()/renderKnowledgePages() → pages/*.html
    → screenshotPages() → images/*.png
```

### Agent 架构（每步骤均配备 AI Agent）
- **通用框架**: `pipeline-agent.ts` 提供 `runAgentLoop()` — Function Calling 循环
- **各步骤 Agent**: 通过 DeepSeek Function Calling 直接操作配置/执行任务
  - `source-agent.ts`: 添加/删除/修改数据源卡片
  - `generate-agent.ts`: 设模式/模型/提示词/温度
  - `style-agent.ts`: 选模板/执行渲染
  - `preview-agent.ts`: 截图/全流程运行/查看输出
  - `trigger-agent.ts`: 设 cron/预设/开关
- **前端组件**: `AgentChat.tsx` 通用对话 UI，各面板复用
- **设计理念**: AI 不是只给建议，而是直接帮用户操作

### 状态管理
- 使用 React useState + IPC 调用
- 持久化到 JSON 文件 (`userData/data/tasks.json`)
- 无 Redux/Zustand（已安装 zustand 但未使用）

## 代码规范

- **语言**: TypeScript strict 模式
- **样式**: Tailwind CSS utility classes，自定义 `.card`、`.btn-primary` 等组件类
- **组件**: 函数组件 + hooks，每个面板一个文件
- **IPC**: preload 层暴露类型安全的 `window.api` 对象
- **类型**: 共享类型放在 `src/shared/types.ts`

## 关键文件说明

| 文件 | 职责 |
|------|------|
| `src/main/task-executor.ts` | 核心：任务执行调度、pipeline 编排 |
| `src/main/ipc.ts` | 所有 IPC 通道注册 |
| `src/main/pipeline-agent.ts` | Agent 通用框架（runAgentLoop） |
| `src/main/source-agent.ts` | 素材步骤 Agent |
| `src/main/generate-agent.ts` | AI 创作步骤 Agent |
| `src/main/style-agent.ts` | 样式步骤 Agent |
| `src/main/preview-agent.ts` | 预览步骤 Agent |
| `src/main/trigger-agent.ts` | 触发步骤 Agent |
| `src/main/pipeline/source-executor.ts` | 数据源执行（API/网页/RSS/AI搜索/文本） |
| `src/main/pipeline/generate.ts` | DeepSeek AI 调用 |
| `src/renderer/src/components/AgentChat.tsx` | 通用 Agent 对话 UI 组件 |
| `src/renderer/src/App.tsx` | UI Shell + 导航逻辑 |
| `src/renderer/src/panels/*.tsx` | 各功能面板（均集成 Agent） |
| `src/shared/types.ts` | Task/SourceCard/Pipeline 等类型 |

## 当前功能状态

| 功能 | 状态 |
|------|------|
| 任务 CRUD | ✅ 完成 |
| 数据源配置（aihot API + AI 搜索） | ✅ 完成 |
| AI 生成（DeepSeek） | ✅ 完成 |
| 每步骤 Agent（Function Calling） | ✅ 完成 |
| HTML 模板渲染 | ✅ 完成 |
| Playwright 截图 | ✅ 完成 |
| 单步执行 | ✅ 完成 |
| 全流程运行 | ✅ 完成 |
| 定时任务 | ⚠️ 后端有 cron 支持，前端配置面板完成 |
| 图片预览 | ✅ 完成（local-file:// 协议） |
| 设置面板 | ✅ 完成 |
| 广场/模板市场 | 🚧 占位页面 |
| 发布渠道 | 🚧 数据结构定义完成，UI 未实现 |

## 常见操作

### 添加新 IPC 通道
1. `src/main/ipc.ts` - 注册 `ipcMain.handle()`
2. `src/preload/index.ts` - 添加到 `api` 对象
3. `src/renderer/src/types/global.d.ts` - 更新 Window.api 类型

### 添加新面板
1. 创建 `src/renderer/src/panels/XxxPanel.tsx`
2. `App.tsx` 添加 PanelType 联合类型 + 路由

### 添加新数据源类型
1. `src/shared/types.ts` - SourceCard.type 联合
2. `src/main/pipeline/source-executor.ts` - executeCard switch case
3. `src/renderer/src/panels/SourcePanel.tsx` - sourceTypeInfo + 配置表单

### 添加新 Agent 工具
1. `src/main/<step>-agent.ts` - TOOLS 数组添加工具定义 + executor switch case
2. Agent 工具通过 `pipeline-agent.ts` 的 `runAgentLoop()` 自动集成

## 外部 API

- **AI HOT**: `https://aihot.virxact.com/api/public/items` (User-Agent: FlowStudio/1.0)
- **DeepSeek**: 通过设置面板配置 `apiKey` 和 `baseUrl`
- **Tavily**: 可选搜索引擎（需配置 `tavilyApiKey`）

## TypeScript 配置

- `tsconfig.web.json`: 前端（renderer + shared）
- `tsconfig.node.json`: 后端（main + preload + shared）
- 编译检查: `npx tsc --noEmit --project tsconfig.web.json && npx tsc --noEmit --project tsconfig.node.json`
