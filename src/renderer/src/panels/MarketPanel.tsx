import { useState } from 'react'
import { Search, Download, Upload, Star, Eye, Clock, Filter, TrendingUp, Sparkles, User, ExternalLink } from 'lucide-react'

// 模拟广场上的任务卡片
const mockMarketTasks = [
  {
    id: 'm1',
    name: 'AI 日报生产线',
    desc: '自动搜索 AI 领域热点，生成科技感小红书日报图文',
    author: 'FlowStudio 官方',
    downloads: 1280,
    stars: 342,
    tags: ['AI', '日报', '科技'],
    templatePreview: 'tech-neon',
    updatedAt: '2天前',
    isOfficial: true
  },
  {
    id: 'm2',
    name: '读书笔记卡片',
    desc: '输入书名或笔记内容，自动生成精美读书分享卡片',
    author: '小王同学',
    downloads: 856,
    stars: 201,
    tags: ['读书', '笔记', '知识'],
    templatePreview: 'warm',
    updatedAt: '5天前',
    isOfficial: false
  },
  {
    id: 'm3',
    name: '产品种草测评',
    desc: '输入产品信息，AI 自动生成种草/测评图文内容',
    author: '运营老张',
    downloads: 632,
    stars: 156,
    tags: ['种草', '测评', '电商'],
    templatePreview: 'color',
    updatedAt: '1周前',
    isOfficial: false
  },
  {
    id: 'm4',
    name: '每周热点速递',
    desc: '自动抓取本周行业热点，生成速览式图文',
    author: 'FlowStudio 官方',
    downloads: 445,
    stars: 98,
    tags: ['热点', '速览', '周报'],
    templatePreview: 'tech-neon',
    updatedAt: '3天前',
    isOfficial: true
  },
  {
    id: 'm5',
    name: '旅行攻略生成器',
    desc: '输入目的地，自动搜索并生成图文攻略',
    author: '旅行达人Lisa',
    downloads: 389,
    stars: 87,
    tags: ['旅行', '攻略', '生活'],
    templatePreview: 'fresh',
    updatedAt: '4天前',
    isOfficial: false
  },
  {
    id: 'm6',
    name: '金句海报工厂',
    desc: '输入金句或段落，自动排版生成精美文字海报',
    author: '设计师阿飞',
    downloads: 278,
    stars: 72,
    tags: ['金句', '海报', '文字'],
    templatePreview: 'minimal',
    updatedAt: '1周前',
    isOfficial: false
  }
]

const filterTabs = ['全部', '官方推荐', '最新发布', '最多下载']

export default function MarketPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('全部')

  const filteredTasks = mockMarketTasks.filter((task) => {
    if (activeFilter === '官方推荐') return task.isOfficial
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return task.name.toLowerCase().includes(q) || task.tags.some(t => t.includes(q))
    }
    return true
  })

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">任务广场</h1>
          <p className="text-sm text-gray-400 mt-0.5">发现并下载社区分享的任务卡片，或分享你的创作</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors" style={{ boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
          <Upload size={14} />
          上传我的任务
        </button>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="px-6 py-3 border-b border-gray-50 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务名称、标签..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-white text-sm focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-100 text-gray-500 text-xs hover:border-blue-200 transition-colors">
            <Filter size={13} />
            筛选
          </button>
        </div>
        <div className="flex gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                activeFilter === tab
                  ? 'bg-blue-50 text-blue-600 border border-blue-200 font-medium'
                  : 'bg-gray-50 text-gray-500 border border-gray-100 hover:border-blue-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 任务卡片网格 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="card overflow-hidden group cursor-pointer hover:scale-[1.01] transition-transform duration-200"
            >
              {/* 模板预览条 */}
              <div className="h-24 relative overflow-hidden" style={{
                background: task.templatePreview === 'tech-neon'
                  ? 'linear-gradient(135deg, #0a0a0a, #0f172a)'
                  : task.templatePreview === 'warm'
                    ? 'linear-gradient(135deg, #fef7ed, #fde68a)'
                    : task.templatePreview === 'color'
                      ? 'linear-gradient(135deg, #f97316, #8b5cf6)'
                      : task.templatePreview === 'fresh'
                        ? 'linear-gradient(135deg, #ecfdf5, #6ee7b7)'
                        : 'linear-gradient(135deg, #f8fafc, #e2e8f0)'
              }}>
                {task.templatePreview === 'tech-neon' && (
                  <>
                    <div className="absolute inset-0 opacity-10" style={{
                      backgroundImage: 'linear-gradient(rgba(0,255,136,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,1) 1px, transparent 1px)',
                      backgroundSize: '20px 20px'
                    }} />
                    <div className="absolute top-3 left-4 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[9px] text-green-400/60" style={{ fontFamily: 'monospace' }}>LIVE</span>
                    </div>
                  </>
                )}
                {task.isOfficial && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600 text-white text-[9px] rounded-md font-medium flex items-center gap-1">
                    <Sparkles size={9} /> 官方
                  </span>
                )}
                {/* hover 覆盖层 */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-800 text-xs rounded-lg font-medium">
                    <Eye size={12} />
                    预览
                  </button>
                </div>
              </div>

              {/* 卡片内容 */}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-800">{task.name}</h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{task.desc}</p>

                {/* 标签 */}
                <div className="flex gap-1.5 mt-3">
                  {task.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[10px]">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 底部信息 */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <User size={10} />
                      {task.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {task.updatedAt}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Download size={10} />
                      {task.downloads}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={10} />
                      {task.stars}
                    </span>
                  </div>
                </div>
              </div>

              {/* 下载按钮 */}
              <div className="px-4 pb-4">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors">
                  <Download size={13} />
                  下载到本地
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 加载更多 */}
        <div className="flex justify-center py-8">
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs hover:border-blue-200 hover:text-blue-500 transition-colors">
            <TrendingUp size={13} />
            加载更多
          </button>
        </div>
      </div>
    </div>
  )
}
