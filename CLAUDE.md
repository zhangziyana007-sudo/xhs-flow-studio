# FlowStudio 项目上下文

> 供 AI 助手快速接管项目使用。最后更新：2025-05-31

## 项目概述

**FlowStudio** 是一个基于 Electron 的小红书图文创作工作台桌面应用。核心功能是自动化 AI 新闻日报生产流水线：从数据源拉取素材 → AI 生成文案 → HTML 模板渲染 → Playwright 截图导出 PNG。

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 桌面框架 | Electron | 31 |
| 构建工具 | electron-vite | 2.3 |
| 前端 | React + TypeScript | 18 / 5.5 |
| 样式 | Tailwind CSS | 3.4 |
| 状态管理 | React useState（简单状态） | - |
| 图标 | lucide-react | 1.17 |
| AI | DeepSeek API (deepseek-v4-pro) | - |
| 截图 | Playwright | 1.45 |
| 定时 | node-cron | 3 |
| 数据源 | aihot.virxact.com REST API | - |

## 目录结构

```
FlowStudio/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts            # 入口：创建窗口 + 注册协议
│   │   ├── ipc.ts              # IPC 通道处理器
│   │   ├── task-executor.ts    # 任务执行引擎（全流水线编排）
│   │   ├── task-store.ts       # JSON 文件持久化
│   │   └── pipeline/           # 各步骤实现
│   │       ├── index.ts        # 统一导出
│   │       ├── source-executor.ts  # 数据源卡片执行器
│   │       ├── search-news.ts      # Tavily 搜索（备选）
│   │       ├── generate.ts         # DeepSeek AI 生成
│   │       ├── render.ts           # HTML 模板渲染
│   │       └── screenshot.ts       # Playwright 截图
│   ├── preload/
│   │   └── index.ts            # contextBridge API 暴露
│   ├── renderer/
│   │   └── src/
│   │       ├── App.tsx         # 主 Shell（导航 + 面板路由）
│   │       ├── main.tsx        # React 入口
│   │       ├── types/
│   │       │   └── global.d.ts # window.api 类型声明
│   │       ├── panels/
│   │       │   ├── TaskPanel.tsx      # 任务列表管理
│   │       │   ├── SourcePanel.tsx    # 素材数据源配置
│   │       │   ├── GeneratePanel.tsx  # AI 创作配置
│   │       │   ├── StylePanel.tsx     # 样式模板选择
│   │       │   ├── PreviewPanel.tsx   # 预览 & 导出
│   │       │   ├── TriggerPanel.tsx   # 触发器配置
│   │       │   ├── MarketPanel.tsx    # 广场（模板市场）
│   │       │   └── SettingsPanel.tsx  # 设置（API Key 等）
│   │       └── styles/
│   │           └── globals.css
│   └── shared/
│       └── types.ts            # 共享类型定义
├── resources/
│   └── templates/
│       ├── ai-daily/           # Tech Neon 模板（黑底荧光绿）
│       └── knowledge-card/     # 知识卡片模板
├── tsconfig.web.json           # 前端 TS 配置
├── tsconfig.node.json          # 后端 TS 配置
├── electron-vite.config.ts
├── tailwind.config.js
└── package.json
```

## 核心架构

### 数据流

```
任务(Task) → 数据源卡片(SourceCard[]) → materials.md
             → AI生成(DeepSeek) → data.json
             → HTML渲染(模板) → pages/*.html
             → Playwright截图 → images/*.png
```

### IPC 通道

| 通道 | 用途 |
|------|------|
| `scheduler:list/create/toggle/delete/runNow` | 任务 CRUD + 全流程执行 |
| `task:get/update/runStep/getOutput` | 任务详情读写 + 单步执行 |
| `creative:createTask/run` | 创建创作任务 |
| `settings:get/set/testLLM` | 设置管理 |
| `templates:list` | 模板列表 |
| `shell:openPath` | 打开本地目录 |
| `task:progress` (event) | 任务执行进度推送 |

### 任务类型

- **auto-report**: 自动日报（API拉取→AI精选→渲染→截图）
- **manual-creative**: 手动创作（知识卡片等）

### 数据源类型 (SourceCard)

- `api-fetch`: REST API 拉取（默认 aihot.virxact.com）
- `url-scrape`: 网页内容抓取
- `rss`: RSS 订阅
- `video-subtitle`: 视频字幕提取
- `manual-text`: 手动输入文本

## UI 交互模式

1. **默认视图**: 任务列表（左侧导航：任务 / 广场 / 设置）
2. **编辑模式**: 点击任务卡片「编辑」→ 左侧导航切换为创作步骤流程
   - 步骤: 素材 → AI创作 → 样式 → 预览出图 → 触发器
   - 左上角「← 返回任务列表」退出编辑
3. **运行**: 任务卡片「运行」按钮 → 后台全流程执行 → 进度推送到前端

## 关键类型 (src/shared/types.ts)

```typescript
interface Task {
  id: string
  name: string
  description?: string
  workflowType: 'auto-report' | 'manual-creative'
  pipeline: PipelineConfig  // { source, generate, style, output }
  trigger: TriggerConfig    // { type, cron?, enabled }
  lastRun?: RunRecord
  runCount: number
}

interface SourceCard {
  id: string
  name: string
  type: 'api-fetch' | 'url-scrape' | 'rss' | 'video-subtitle' | 'manual-text'
  runMode: 'auto' | 'manual'
  config: { apiUrl?, category?, sinceHours?, urls?, feedUrl?, text?, ... }
}
```

## 数据持久化

- 路径: `app.getPath('userData')/data/`
- `tasks.json`: 任务列表
- `settings.json`: 全局设置（API Key、模型配置等）
- 输出: `app.getPath('userData')/output/<taskId>-<date>/`

## 外部依赖

- **AI HOT API** (`https://aihot.virxact.com/api/public/items`): AI 新闻聚合数据源
  - User-Agent: `FlowStudio/1.0`
  - 参数: mode, category, since
- **DeepSeek API**: 文本生成（JSON 模式输出结构化数据）
  - 需配置 `deepseekApiKey` 和 `aiBaseUrl`

## 开发命令

```bash
npm run dev      # 开发模式（HMR）
npm run build    # 生产构建
npx tsc --noEmit --project tsconfig.web.json   # 前端类型检查
npx tsc --noEmit --project tsconfig.node.json  # 后端类型检查
```

## 注意事项

1. `local-file://` 自定义协议用于 renderer 加载本地 PNG 图片
2. 默认任务「AI 日报」在任务列表为空时自动创建
3. 模板路径优先从 `resources/templates/` 加载，开发时回退到 `../AINewsSkill/templates/`
4. Playwright 截图规格：900×1200 @2x（3:4 比例，小红书标准）
5. 前端无独立「创作」导航入口，创作流程只能通过编辑任务进入
