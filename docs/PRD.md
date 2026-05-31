# FlowStudio — 小红书图文创作工作台

> 版本：v0.4 (2025-05-31)
> 前身项目：AINewsSkill v3.1.0

---

## 1. 产品概述

### 1.1 定位

FlowStudio 是一个**专注小红书图文创作的桌面工作台**。创作者打开工作台，从"找素材"到"出图发布"的整条链路都在这里完成。

### 1.2 核心模型

```
素材输入  ──→  AI 加工  ──→  样式渲染  ──→  预览出图  ──→  触发/发布
(确定的)     (素材→文案)    (模板+AI)     (确认的)     (自动化的)
```

两端是**确定的工程能力**，中间的 AI 加工将素材数据转化为小红书文案，样式面板支持 AI 创建/改良模板。

**社区层**：任务广场允许用户上传/下载任务卡片，形成创作工作流的共享生态。

### 1.3 设计原则

| 原则 | 含义 |
|------|------|
| 管道确定，创作自由 | 两端（输入/输出）是可靠的工程，中间是不设限的 AI 创作空间 |
| 对话驱动配置 | 所有复杂配置通过 AI 对话完成，降低认知负担 |
| 卡片化 UI | 所有信息以圆角卡片呈现，可扫视、可操作 |
| 所见即所得 | 模板预览实时可见，调参即刻更新 |
| 任务隔离 | 每个任务独立拥有完整的 5 步配置数据 |
| 可自动化 | 重复性创作任务可设定时自动执行 |

### 1.4 开发方法论

```
UI/UE 先行 → PRD 建立映射 → 后续补功能代码
```

- 每个阶段先实现 UI 和交互
- 然后在 PRD 中为每个 UI 元素建立「界面 → 功能」映射
- 后续按映射表逐一实现功能代码
- 每次规划新功能前，先画 UI → 记录到 PRD → 再开发

---

## 2. UI 设计系统

### 2.1 卡片设计规范

| 属性 | 值 | 说明 |
|------|-----|------|
| 圆角 | `rounded-3xl` (24px) | 卡片统一大圆角 |
| 按钮圆角 | `rounded-2xl` (16px) | 按钮次级圆角 |
| 阴影 | 3层紧贴型（blur≤14px，大负spread） | 阴影跟随圆角轮廓 |
| hover | 阴影加深 + 上浮6px (`-translate-y-1.5`) | |
| 品牌色投影 | 蓝色按钮带蓝色发光阴影 | `rgba(37,99,235,0.2)` |
| 空状态 | 96px 渐变容器 + 内阴影 | 磨砂玻璃质感 |

### 2.2 CSS 类

```css
.card           /* 基础卡片：白底+圆角+3层阴影+hover上浮 */
.card-elevated  /* 高级卡片：无border+更大阴影 */
.btn-primary    /* 蓝色主按钮+蓝色发光投影 */
.btn-success    /* 绿色按钮+绿色发光投影 */
.btn-secondary  /* 灰色辅助按钮 */
.btn-pill       /* 圆润胶囊按钮 */
.empty-icon-box /* 空状态图标容器 */
```

---

## 3. 工作台整体布局

### 3.0 导航结构

```
┌─────────────────────────────────────────────────────────────┐
│                    FlowStudio 工作台                          │
├───────┬─────────────────────────────────────────────────────┤
│       │  [素材] → [AI创作] → [样式] → [出图] → [触发器]     │
│ 侧    ├─────────────────────────────────────────────────────┤
│ 边    │                                                     │
│ 导    │         当前面板内容区                                │
│ 航    │                                                     │
│       │                                                     │
│ ┌───┐ │                                                     │
│ │创作│ │                                                     │
│ │ 1│ │                                                     │
│ │ 2│ │                                                     │
│ │ 3│ │                                                     │
│ │ 4│ │                                                     │
│ │ 5│ │                                                     │
│ └───┘ │                                                     │
│ ┌───┐ │                                                     │
│ │任务│ │                                                     │
│ └───┘ │                                                     │
└───────┴─────────────────────────────────────────────────────┘
```

| 层级 | 内容 | 说明 |
|------|------|------|
| 一级 | 创作 | 可展开/折叠，包含 5 步子功能 |
| 二级 | 素材 / AI加工 / 样式 / 预览出图 / 触发器 | 创作的 5 个步骤 |
| 一级 | 任务 | 管理已保存的任务列表 |
| 一级 | 广场 | 任务广场 — 社区任务分享与下载 |

### 3.1 编辑模式

- 从任务列表点击"编辑" → 进入创作视图编辑该任务
- 顶部面包屑显示 "← 返回任务" + "编辑: [任务名]"
- 保存按钮变为"保存更改"
- 每个任务的 5 步配置数据完全隔离

---

## 4. 面板功能映射

### 4.1 素材面板 — AI 对话式配置

**UI 布局**：左侧对话区 + 右侧已配置源面板（可折叠）

#### UI 组件

| 组件 | 位置 | 交互状态 | 文件 |
|------|------|----------|------|
| AI 对话消息列表 | 左侧主体 | 正常/等待AI回复/错误重试 | `SourcePanel.tsx` |
| 消息输入框 | 左侧底部 | 正常/发送中/禁用 | `SourcePanel.tsx` |
| 快捷提示标签 | 输入框上方 | 正常/hover高亮 | `SourcePanel.tsx` |
| 已配置数据源卡片列表 | 右侧面板 | 正常/空状态 | `SourcePanel.tsx` |
| 数据源卡片 | 右侧 | 启用/禁用/编辑中 | `SourcePanel.tsx` |
| "已配置(N)" 按钮 | 标题栏右侧 | 展开/收起 | `SourcePanel.tsx` |

#### 数据流

```
用户自然语言描述 → AI 理解意图 → 生成 SourceConfig → 显示为数据源卡片
```

- **输入**: 用户对话文本
- **输出**: `SourceConfig[]`（数据源配置数组）
- **格式**: 引用 `shared/types.ts → SourceConfig`

#### 功能映射

| UI 元素 | 功能描述 | 接口签名 | 阶段 | 验收标准 |
|---------|---------|----------|------|---------|
| 发送按钮 | 发送消息给AI，AI解析并生成配置 | `sendMessage(text: string): Promise<AIChatResponse>` | MVP | AI正确识别数据源类型并返回配置 |
| 快捷标签 | 预填对话输入框 | 纯前端，`setInputValue(hint)` | MVP | 点击后输入框显示对应文本 |
| 数据源开关 | 启用/禁用某个源 | `toggleSource(id: string, enabled: boolean)` | MVP | 切换后卡片变灰且不参与任务执行 |
| 编辑按钮 | 通过对话修改已有源 | `editSource(id: string)` → 打开子对话 | v1.1 | 修改后卡片信息更新 |
| 删除按钮 | 移除数据源 | `deleteSource(id: string)` | MVP | 卡片消失，配置移除 |

#### 支持的数据源类型

| 类型 | 标识 | AI 识别关键词 |
|------|------|--------------|
| RSS/Atom 订阅 | `rss` | "订阅""RSS""Feed" |
| 网页链接 | `webpage` | "网页""文章""博客""URL" |
| 搜索引擎 | `search` | "搜索""热点""关键词" |
| API 接口 | `api` | "API""接口""数据" |
| 视频链接 | `video` | "视频""B站""YouTube""字幕" |
| 本地文件 | `file` | "文件""上传""导入" |

---

### 4.2 AI 加工面板 — 素材数据→小红书文案

**UI 布局**：全屏对话式（顶部素材摘要条 + 对话列表 + 快捷模式折叠区 + 输入区）

**核心定位**：将上一步获取的素材数据加工为适合小红书的结构化图文文案。

#### UI 组件

| 组件 | 位置 | 交互状态 | 文件 |
|------|------|----------|------|
| 素材摘要条 | 顶部（蓝色背景） | 显示已导入素材数/来源/关键词 | `GeneratePanel.tsx` |
| AI 对话消息列表 | 主体 | 正常/生成中(流式)/错误 | `GeneratePanel.tsx` |
| AI 消息操作按钮 | AI消息下方(hover显示) | 复制/重新生成 | `GeneratePanel.tsx` |
| 生成完成标记+操作 | AI最终消息下 | "去选样式"/"重新生成"按钮 | `GeneratePanel.tsx` |
| 快捷模式网格 | 输入区上方(可折叠) | 6个模式卡片 | `GeneratePanel.tsx` |
| 快捷修改标签 | 输入区上方 | 点击填入输入框 | `GeneratePanel.tsx` |
| 模型选择器 | 标题栏右侧 | DeepSeek/GPT-4o/Claude | `GeneratePanel.tsx` |
| 消息输入框 | 底部 | textarea + 发送按钮 | `GeneratePanel.tsx` |

#### 数据流

```
SourceConfig[] → 获取素材 → RawMaterial[] → AI加工(对话) → GenerateResult{pages[], xhsTitle[], hashtags[]}
```

- **输入**: 上一步的 `SourceConfig[]` + 用户加工指令
- **输出**: `GenerateResult`（结构化文案：分页内容 + 标题候选 + 话题标签）
- **格式**: 引用 `shared/types.ts → GenerateResult`

#### 功能映射

| UI 元素 | 功能描述 | 接口签名 | 阶段 | 验收标准 |
|---------|---------|----------|------|---------|
| 发送加工指令 | 将素材+指令发给AI生成文案 | `generate(materials: RawMaterial[], prompt: string): AsyncStream<GenerateResult>` | MVP | AI输出结构化文案（封面+正文页+尾页） |
| 快捷模式选择 | 预设加工方式快速处理 | `generateWithMode(mode: string, materials)` | MVP | 选择后AI按模式直接加工 |
| 复制按钮 | 复制AI消息内容 | 纯前端 `navigator.clipboard.writeText()` | MVP | 复制成功提示 |
| 重新生成 | 重跑当前内容 | `regenerate(): AsyncStream<GenerateResult>` | MVP | 清除旧结果，重新生成 |
| 素材摘要条 | 显示已导入素材信息 | 从store读取 `SourceConfig[]` 摘要 | MVP | 显示数量/来源/关键词 |
| 快捷修改标签 | 快速输入修改意见 | 纯前端填充输入框 | MVP | 点击后文字出现在输入框 |

#### 快捷加工模式

| 模式 | AI 行为 | 适用场景 |
|------|---------|----------|
| 日报整合 | 多条素材→一期日报，按热度排列 | AI/科技日报 |
| 知识提炼 | 提取核心观点，卡片式 | 读书笔记、知识分享 |
| 种草测评 | 优缺对比文案 | 产品推荐 |
| 深度精讲 | 单篇素材展开解读 | 深度内容 |
| 热点快评 | 犀利观点输出 | 时事评论 |
| AI 自由发挥 | AI 判断最佳方式 | 实验性创作 |

#### 输出数据结构

```typescript
interface GenerateResult {
  pages: PageContent[]
  xhsTitle: string[]      // 小红书标题候选（3个）
  hashtags: string[]      // 话题标签（5个）
}

interface PageContent {
  type: 'cover' | 'content' | 'end'
  title: string
  body?: string
  highlight?: string      // 金句
  subtitle?: string       // 副标题（封面）
  tagline?: string        // 期刊标识（封面）
  rank?: string           // 排序编号（正文页）
  cta?: string            // CTA文案（尾页）
}
```

---

### 4.3 样式面板 — 模板选择 + AI 创建/改良

**UI 布局**：三栏式（左侧模板列表 + 中间实时预览 + 右侧AI对话面板可折叠）

**核心理念**：内置模板极少（当前仅 Tech Neon），用户通过 AI 对话创建自己的新模板或改良现有模板。

#### UI 组件

| 组件 | 位置 | 交互状态 | 文件 |
|------|------|----------|------|
| 模板列表 | 左侧 | 选中(黑底白字)/未选 | `StylePanel.tsx` |
| 模板缩略图 | 列表项左侧 | 显示模板色彩缩略 | `StylePanel.tsx` |
| "AI 创建模板" 按钮 | 模板列表下方 | 虚线边框+hover变紫 | `StylePanel.tsx` |
| "AI 改良当前模板" 按钮 | 左侧底部 | 紫色背景 | `StylePanel.tsx` |
| 3:4 实时预览卡片 | 中间主体 | 渲染实际文案内容 | `StylePanel.tsx` |
| 翻页按钮 | 预览两侧 | 正常/禁用(首尾页) | `StylePanel.tsx` |
| 页码指示器 | 预览下方 | 当前页高亮拉宽 | `StylePanel.tsx` |
| AI 模板助手对话面板 | 右侧(可折叠) | 打开/关闭 | `StylePanel.tsx` |
| AI 快捷指令标签 | 对话面板内 | 点击发送给AI | `StylePanel.tsx` |
| 页码标注 | 预览下方栏 | 封面/第N页/尾页 | `StylePanel.tsx` |
| 全屏预览按钮 | 底部右侧 | 正常/hover | `StylePanel.tsx` |

#### 数据流

```
GenerateResult.pages[] + TemplateId → 模板渲染器 → 实时预览
AI对话 → 生成新模板CSS/配置 → 加入模板列表
```

- **输入**: 上一步的 `GenerateResult` + 用户选择/AI生成的模板
- **输出**: `StyleConfig`（模板ID + 覆盖参数）
- **格式**: 引用 `shared/types.ts → StyleConfig`

#### 功能映射

| UI 元素 | 功能描述 | 接口签名 | 阶段 | 验收标准 |
|---------|---------|----------|------|---------|
| 模板列表选择 | 切换模板 | `selectTemplate(templateId: string)` | MVP | 预览实时更新到对应模板风格 |
| AI 创建模板 | AI 从零生成模板 | `aiCreateTemplate(prompt: string): Promise<TemplateConfig>` | MVP | 对话完成后新模板出现在列表中 |
| AI 改良模板 | 修改当前模板风格 | `aiModifyTemplate(templateId, prompt): Promise<TemplateConfig>` | MVP | 修改后预览实时更新 |
| 翻页按钮 | 切换预览页面 | 纯前端 `setCurrentPage(n)` | MVP | 预览内容切换 |
| 全屏预览 | 全屏查看预览 | 打开全屏弹窗 | v1.1 | 全屏3:4预览 |
| AI 快捷指令 | 快速发送常用修改 | 填充AI输入框并发送 | MVP | 点击后AI执行相应修改 |

#### 内置模板

| 模板名 | 视觉风格 | 来源 |
|--------|----------|------|
| Tech Neon | 黑底+荧光绿+网格+扫描线+monospace | 来自 AINewsSkill 真实模板 |

> 其他模板由用户通过 AI 对话创建，不预设固定列表。

#### AI 模板能力

| 能力 | 说明 | 示例指令 |
|------|------|----------|
| 修改配色 | 更换模板主色系 | "配色换成蓝紫色系" |
| 修改风格 | 改变整体视觉基调 | "改成白底简约风" |
| 修改排版 | 调整布局和间距 | "字体再大一号" "加圆角卡片" |
| 从零创建 | 根据描述生成全新模板 | "做一个赛博朋克风格的模板" |
| 参考图片 | 根据图片风格生成模板 | "参考这张图的配色和排版" |

---

### 4.4 预览 & 导出面板

**UI 布局**：预览区 + 操作按钮 + 保存/发布配置

#### UI 组件

| 组件 | 位置 | 交互状态 | 文件 |
|------|------|----------|------|
| 图片预览区 | 主体中央 | 空状态/加载中/已渲染(可翻页) | `PreviewPanel.tsx` |
| 导出按钮组 | 标题栏右侧 | 正常/导出中/完成 | `PreviewPanel.tsx` |
| 保存为任务卡片 | 底部 | 新建模式/编辑模式 | `PreviewPanel.tsx` |
| 发布渠道标签选择器 | 保存卡片内 | 选中(蓝底)/未选(灰底) | `PreviewPanel.tsx` |

#### 数据流

```
StyleConfig + StructuredContent → Playwright渲染 → PNG[] → 预览展示
                                                          → 保存为任务
                                                          → 发布到渠道
```

- **输入**: `StyleConfig` + `StructuredContent`
- **输出**: `OutputConfig`（格式 + 导出路径 + 发布模式 + 渠道配置）
- **格式**: 引用 `shared/types.ts → OutputConfig`

#### 功能映射

| UI 元素 | 功能描述 | 接口签名 | 阶段 | 验收标准 |
|---------|---------|----------|------|---------|
| 导出图片 | 保存PNG到本地 | `exportImages(path: string): Promise<string[]>` | MVP | 图片写入指定目录 |
| 小红书素材包 | 图片+文案打包 | `exportXhsPackage(path): Promise<PackageResult>` | MVP | 产出图片+标题+正文.txt |
| 保存为任务 | 打包5步配置为Task | `saveAsTask(name, config): Promise<Task>` | MVP | 任务出现在任务列表 |
| 保存更改 | 更新已有任务 | `updateTask(id, config): Promise<Task>` | MVP | 任务配置更新 |
| 发布渠道选择 | 勾选目标渠道 | 纯前端，更新 `OutputConfig.channels` | MVP | 选中状态切换 |
| 更多发布 | 打开渠道详细配置 | 打开侧边面板/弹窗 | v1.1 | 显示渠道配置表单 |

#### 发布配置

**三种发布模式**：

| 模式 | 场景 | 行为 |
|------|------|------|
| 立即发布 (`immediate`) | 定时任务无人值守 | 运行完自动推送 |
| 待审核 (`review`) | 想看看再发 | 运行完存队列，确认后发布 |
| 仅保存 (`save-only`) | 只做不发 | 只输出到本地 |

**发布渠道**：

| 渠道 | 类型标识 | 实现方式 | 阶段 |
|------|----------|----------|------|
| 本地保存 | `local` | 写文件系统 | MVP |
| 小红书素材包 | `xhs-package` | 打包文件夹 | MVP |
| 飞书群 | `feishu` | Incoming Webhook | MVP |
| 企微群 | `wecom` | Webhook | v1.1 |
| 钉钉群 | `dingtalk` | Webhook | v1.1 |
| API 更新 | `api` | REST PUT/POST | v1.1 |
| 自定义 Webhook | `webhook` | HTTP POST | v1.1 |

---

### 4.5 触发器面板 — 第5步配置区

**UI 布局**：执行模式选择 + Cron 配置 + 高级选项

#### UI 组件

| 组件 | 位置 | 交互状态 | 文件 |
|------|------|----------|------|
| 执行模式选择卡片(3个) | 顶部网格 | 未选/选中(蓝底蓝投影) | `TriggerPanel.tsx` |
| Cron 表达式输入框 | 中部卡片内 | 正常/焦点/语法错误 | `TriggerPanel.tsx` |
| 快捷预设标签 | Cron 输入下方 | 选中(蓝底)/未选(灰底) | `TriggerPanel.tsx` |
| "下次执行"提示 | Cron 输入下方 | 正常/无效表达式 | `TriggerPanel.tsx` |
| 高级选项复选框 | 底部卡片 | 选中/未选 | `TriggerPanel.tsx` |

#### 数据流

```
用户选择触发模式 + Cron 表达式 → TriggerConfig
```

- **输入**: 用户选择
- **输出**: `TriggerConfig`（type + cron + enabled + options）
- **格式**: 引用 `shared/types.ts → TriggerConfig`

#### 功能映射

| UI 元素 | 功能描述 | 接口签名 | 阶段 | 验收标准 |
|---------|---------|----------|------|---------|
| 模式选择卡片 | 设定触发方式 | `setTriggerType(type: 'manual'\|'cron'\|'interval')` | MVP | 选中态高亮 |
| Cron 输入框 | 设定定时表达式 | `setCronExpression(expr: string)` | MVP | 合法表达式显示下次执行时间 |
| 快捷预设 | 快速选择常用时间 | `setCronExpression(preset.value)` | MVP | 输入框+标签同步更新 |
| 重试开关 | 失败自动重试 | `setOption('autoRetry', boolean)` | MVP | 勾选后存入配置 |
| 通知开关 | 执行完发通知 | `setOption('notify', boolean)` | v1.1 | 勾选后执行完推送通知 |
| 人工审核开关 | 发布前人工确认 | `setOption('reviewBeforePublish', boolean)` | MVP | 关联发布模式为review |

---

### 4.6 任务面板

**UI 布局**：待发布审核区 + 任务卡片列表

#### UI 组件

| 组件 | 位置 | 交互状态 | 文件 |
|------|------|----------|------|
| "待发布(N)" 审核区 | 顶部 | 有待审核项/无(隐藏) | `TaskPanel.tsx` |
| 待审核卡片 | 审核区内 | 正常(橙色左边框) | `TaskPanel.tsx` |
| 审核操作按钮组 | 卡片右侧 | 预览/确认/编辑/丢弃 | `TaskPanel.tsx` |
| 任务卡片列表 | 主体 | 正常/空状态 | `TaskPanel.tsx` |
| 任务卡片 | 列表内 | 启用/禁用(半透明)/运行中(闪烁) | `TaskPanel.tsx` |
| 新建任务按钮 | 标题栏右侧 | 正常 | `TaskPanel.tsx` |

#### 数据流

```
Task[] → 渲染任务列表
PendingPublish[] → 渲染待审核区
用户操作 → 更新 Task / 触发执行
```

- **输入**: 持久化的 `Task[]` + `PendingPublish[]`
- **输出**: 用户操作指令（运行/编辑/删除/审核确认等）

#### 功能映射

| UI 元素 | 功能描述 | 接口签名 | 阶段 | 验收标准 |
|---------|---------|----------|------|---------|
| 运行按钮 | 立即执行一次任务 | `runTask(id: string): Promise<RunResult>` | MVP | 执行完毕，产出物存入输出目录 |
| 编辑按钮 | 进入创作流编辑 | `onEditTask(taskName)` → 切换视图 | MVP | 加载配置到5步面板 |
| 删除按钮 | 移除任务 | `deleteTask(id: string)` | MVP | 确认后任务消失 |
| 开关按钮 | 启用/暂停定时 | `toggleTask(id, enabled)` | MVP | 开关状态+卡片视觉切换 |
| 新建任务 | 进入空白创作流 | 切换到创作视图，清空配置 | MVP | 侧边栏展开创作步骤 |
| 确认发布 | 审核通过，推送渠道 | `confirmPublish(pendingId): Promise<void>` | MVP | 推送完成，从队列移除 |
| 预览(审核) | 查看待发布图片 | 打开预览弹窗/面板 | MVP | 显示图片轮播 |
| 丢弃 | 放弃待发布项 | `discardPending(pendingId)` | MVP | 从队列移除 |

---

### 4.7 任务广场面板 — 社区任务分享

**UI 布局**：搜索+筛选 + 任务卡片网格

**核心理念**：用户可将本地开发的任务卡片上传到广场，其他用户可下载到本地运行。形成创作工作流的共享生态。

#### UI 组件

| 组件 | 位置 | 交互状态 | 文件 |
|------|------|----------|------|
| 搜索输入框 | 顶部 | 正常/输入中 | `MarketPanel.tsx` |
| 筛选标签组 | 搜索下方 | 全部/官方推荐/最新/最多下载 | `MarketPanel.tsx` |
| 筛选按钮 | 搜索右侧 | 正常/展开 | `MarketPanel.tsx` |
| 任务卡片网格 | 主体 | 3列网格布局 | `MarketPanel.tsx` |
| 任务卡片 | 网格内 | 正常/hover(预览覆盖层) | `MarketPanel.tsx` |
| 模板预览头图 | 卡片顶部 | 渐变色背景+网格装饰 | `MarketPanel.tsx` |
| 官方徽章 | 头图右上 | 蓝底白字"官方" | `MarketPanel.tsx` |
| 下载按钮 | 卡片底部 | 正常/下载中/已下载 | `MarketPanel.tsx` |
| 上传按钮 | 标题栏右侧 | 正常 | `MarketPanel.tsx` |
| 加载更多按钮 | 列表底部 | 正常/加载中 | `MarketPanel.tsx` |

#### 数据流

```
远程 API → MarketTask[] → 渲染卡片网格
用户下载 → 解包为 Task → 加入本地任务列表
用户上传 → 打包本地 Task → 推送到远程 API
```

- **输入**: 远程任务列表 API
- **输出**: 下载到本地的 `Task` 或上传到远程的 `TaskPackage`

#### 功能映射

| UI 元素 | 功能描述 | 接口签名 | 阶段 | 验收标准 |
|---------|---------|----------|------|----------|
| 搜索框 | 按名称/标签搜索 | `searchMarket(query: string): Promise<MarketTask[]>` | v1.1 | 实时搜索，结果过滤 |
| 筛选标签 | 按分类筛选 | 纯前端过滤 | v1.1 | 切换标签列表更新 |
| 下载按钮 | 下载任务到本地 | `downloadTask(marketId: string): Promise<Task>` | v1.1 | 任务出现在本地任务列表 |
| 上传按钮 | 上传本地任务 | `uploadTask(taskId: string): Promise<MarketTask>` | v1.1 | 任务出现在广场 |
| 预览hover | 查看任务详情 | 展开预览弹窗 | v1.1 | 显示完整任务信息 |
| 加载更多 | 分页加载 | `loadMore(page: number): Promise<MarketTask[]>` | v1.1 | 追加新卡片 |

#### 任务包数据结构

```typescript
interface MarketTask {
  id: string
  name: string
  description: string
  author: string
  downloads: number
  stars: number
  tags: string[]
  templatePreview: string  // 模板缩略标识
  updatedAt: string
  isOfficial: boolean
  // 实际包内容
  package: {
    pipeline: PipelineConfig
    trigger: TriggerConfig
    templateFiles?: string[]  // 自定义模板文件
  }
}
```

---

## 5. 状态管理

### 5.1 全局 Store 结构 (Zustand)

```typescript
interface WorkbenchStore {
  // 当前编辑状态
  editingTaskId: string | null
  editingTaskName: string | null
  activePanel: PanelType

  // 创作流配置（当前正在编辑的任务数据）
  currentConfig: {
    source: SourceConfig[]
    generate: GenerateConfig
    style: StyleConfig
    output: OutputConfig
    trigger: TriggerConfig
  }

  // 任务列表
  tasks: Task[]
  pendingPublish: PendingPublish[]

  // 对话状态
  sourceMessages: ChatMessage[]
  generateMessages: ChatMessage[]

  // Actions
  setActivePanel: (panel: PanelType) => void
  startEditTask: (task: Task) => void
  exitEditMode: () => void
  saveAsTask: (name: string) => void
  updateTask: () => void
}
```

### 5.2 跨面板数据依赖

```
素材面板 → (SourceConfig[]) → AI创作面板
AI创作面板 → (StructuredContent) → 样式面板
样式面板 → (StyleConfig) → 预览面板
预览面板 → (OutputConfig) → 保存/发布
触发器面板 → (TriggerConfig) → 保存为任务
```

每切换到下一步时，上一步的输出自动作为下一步的输入。

---

## 6. 技术架构

### 6.1 技术选型

| 层 | 选型 | 版本 |
|----|------|------|
| 桌面框架 | Electron | 31+ |
| 前端 | React + TypeScript + Tailwind CSS | 18 / 5.x / 3.4 |
| 构建 | Vite + electron-vite | 5 / 2.3 |
| 截图引擎 | Playwright | latest |
| 模板引擎 | Handlebars | latest |
| 定时 | node-cron | latest |
| LLM | Vercel AI SDK (`ai@^4.3`) | 4.3+ |
| 状态 | Zustand | 5 |
| 图标 | Lucide React | latest |
| 存储 | 本地 JSON 文件 | — |

### 6.2 项目结构

```
FlowStudio/
├── src/
│   ├── shared/types.ts              # 核心类型定义
│   ├── main/                        # Electron 主进程
│   │   ├── index.ts
│   │   ├── ipc/                     # IPC 处理器
│   │   ├── services/                # 核心业务逻辑
│   │   │   ├── source/             # 素材获取
│   │   │   ├── generator/          # AI 内容生成
│   │   │   ├── renderer/           # 模板渲染+截图
│   │   │   ├── publisher/          # 发布推送
│   │   │   └── scheduler/          # 定时调度
│   │   └── store/                   # 数据持久化
│   ├── preload/index.ts
│   └── renderer/                    # React UI
│       ├── App.tsx                  # 主布局+导航+编辑模式
│       ├── panels/
│       │   ├── SourcePanel.tsx      # 素材(对话式配置)
│       │   ├── GeneratePanel.tsx    # AI加工(素材→文案)
│       │   ├── StylePanel.tsx       # 样式(单模板+AI创建)
│       │   ├── PreviewPanel.tsx     # 预览&导出&发布配置
│       │   ├── TriggerPanel.tsx     # 触发器配置
│       │   ├── TaskPanel.tsx        # 任务管理+待审核
│       │   └── MarketPanel.tsx      # 任务广场(社区分享)
│       ├── stores/workbench.ts      # Zustand 状态
│       └── styles/globals.css       # 设计系统CSS
├── templates/                       # 图文模板
└── data/                            # 运行时数据
    ├── materials/
    ├── projects/
    └── tasks/
```

### 6.3 数据流

```
用户操作 (renderer) → IPC → 主进程 service → 结果返回 → UI 更新 (Zustand)
```

**创作流水线**：
```
SourceConfig[] → (获取) → RawMaterial[]
  → (AI创作) → StructuredContent
  → (模板渲染) → HTML[]
  → (截图) → PNG[]
  → (发布) → 推送到渠道
```

---

## 7. 类型定义 (shared/types.ts)

```typescript
// 数据源配置
interface SourceConfig {
  id: string
  type: 'rss' | 'webpage' | 'search' | 'api' | 'video' | 'file'
  name: string
  enabled: boolean
  config: Record<string, unknown>
}

// AI 创作配置
interface GenerateConfig {
  model: string
  mode: string
  prompt: string
  temperature?: number
}

// 样式配置
interface StyleConfig {
  templateId: string
  overrides?: Record<string, unknown>
}

// 输出配置
interface OutputConfig {
  format: 'png' | 'pdf' | 'html'
  exportPath?: string
  publishMode: 'immediate' | 'review' | 'save-only'
  channels: PublishChannel[]
}

// 发布渠道
interface PublishChannel {
  id: string
  type: 'local' | 'xhs-package' | 'feishu' | 'wecom' | 'dingtalk' | 'api' | 'webhook'
  name: string
  enabled: boolean
  config: Record<string, unknown>
}

// 触发器配置
interface TriggerConfig {
  type: 'manual' | 'cron' | 'interval'
  cron?: string
  interval?: number
  enabled: boolean
  options: {
    autoRetry: boolean
    notify: boolean
    reviewBeforePublish: boolean
  }
}

// 流水线配置（任务的核心数据）
interface PipelineConfig {
  source: SourceConfig[]
  generate: GenerateConfig
  style: StyleConfig
  output: OutputConfig
}

// 任务
interface Task {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  pipeline: PipelineConfig
  trigger: TriggerConfig
  lastRun?: RunRecord
  runCount: number
}

// 待发布项
interface PendingPublish {
  id: string
  taskId: string
  taskName: string
  createdAt: number
  outputPath: string
  imageCount: number
  channels: PublishChannel[]
}
```

---

## 8. 阶段规划

### MVP (v0.5)

| 模块 | 范围 |
|------|------|
| 素材面板 | AI对话配置 + 搜索引擎/RSS获取 |
| AI加工面板 | 对话式加工 + 日报整合模式 |
| 样式面板 | Tech Neon 模板 + AI创建/改良模板 |
| 预览面板 | Playwright截图 + 本地导出 + 小红书素材包 |
| 触发器 | 手动/Cron定时 |
| 任务面板 | CRUD + 运行 + 待审核 |
| 发布 | 本地保存 + 小红书包 + 飞书推送 |

### v1.1

| 模块 | 范围 |
|------|------|
| 任务广场 | 社区任务上传/下载/搜索/筛选 |
| 更多渠道 | 企微/钉钉/自定义Webhook |
| AI 模板增强 | 参考图片生成模板、模板版本管理 |
| 任务日志 | 执行历史记录查看 |
| 全局设置 | API Key 管理 UI |

### v1.2

| 模块 | 范围 |
|------|------|
| 广场生态 | 评分/评论/收藏/推荐算法 |
| 素材库 | 持久化素材收藏 |
| 数据分析 | 创作频次/发布统计 |
| 多任务并行 | 队列化执行 |
| 模板市场 | 单独的模板分享(与任务广场分离) |

---

## 9. 与 AINewsSkill 的关系

| 可复用 | 说明 |
|--------|------|
| 流水线模式 | fetch → generate → render → shot → publish |
| AI HOT 素材源 | 迁移为搜索引擎数据源 |
| DeepSeek 调用 | 迁移为 Vercel AI SDK 统一层 |
| HTML 模板 + Playwright | 核心渲染链路完全复用 |
| 飞书 Webhook | 迁移为发布渠道 |
| 小红书素材包 | 迁移为导出功能 |
| Tech Neon 模板 | 首个内置模板 |

**不复用**：CLI 架构、单包结构、硬编码配置
