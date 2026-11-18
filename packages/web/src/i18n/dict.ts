/**
 * 全站文案字典 —— 纯 TS，无 Node 依赖，服务端与客户端 island 共用。
 *
 * 约定：
 * - 平面 key，用前缀分组（nav.* / rank.* / agent.* …）
 * - `{name}` 占位符由 t(lang, key, { name }) 替换
 * - 路由：英文在根路径（默认语言），中文在 /zh/ 前缀
 */

export type Lang = 'zh' | 'en';
export const HTML_LANG: Record<Lang, string> = { zh: 'zh-CN', en: 'en' };

type Dict = Record<string, string>;

const zh: Dict = {
  // ── 通用 ──
  'app.name': 'AgentNews',
  'app.tagline': 'AI Agent Index',
  'app.snapshot': '快照',
  'app.theme': '切换深浅色主题',
  'app.lang': '切换语言',
  'app.skip': '跳到正文',
  'app.all': '全部',
  'app.more': '全部 →',
  'app.none': '—',
  'app.copy': '复制',
  'app.copied': '已复制',
  'app.notRanked': '未上榜',
  'app.notFound': '页面不存在',
  'app.home': '回到首页',

  // ── 404 ──
  'notfound.lede': '这个地址不存在或已被合并。试试从首页或榜单进入。',

  // ── 数据下载 ──
  'data.crumb': '数据',
  'data.eyebrow': '下载与引用',
  'data.title': '数据下载',
  'data.lede': '快照、指标与引用格式。榜单数据可下载、可复现、可追溯。',
  'home.closedPending': '另有 {n} 个闭源条目待接入数据',
  // ── 导航 ──
  'nav.index': '总览',
  'nav.board': '榜单',
  'nav.compare': '对比',
  'nav.method': '口径',
  'nav.indexEn': 'Index',
  'nav.boardEn': 'Board',
  'nav.compareEn': 'Diff',
  'nav.methodEn': 'Method',

  // ── 页脚 ──
  'footer.line': '{name} · {tagline} · 快照 {date} · 开源 {open} / 闭源 {closed}',
  'footer.principles': '可比的才排名 · 综合分是观点，非客观事实',
  'footer.method': '方法与口径',
  'footer.data': '数据下载',
  'footer.rss': 'RSS',
  'footer.suggest': '提交收录申请',

  // ── 形态 ──
  'form.cli': 'CLI',
  'form.ide-plugin': 'IDE 插件',
  'form.ide-app': 'IDE 应用',
  'form.desktop': '桌面',
  'form.browser': '浏览器',
  'form.framework': '框架',
  'form.platform': '平台',
  'form.autonomous': '自主',
  'form.assistant': '助手',

  // ── 归属 / 粒度 ──
  'bucket.open': '开源',
  'bucket.semi': '半开源',
  'bucket.closed': '闭源',
  'gran.week': '按周增量',
  'gran.month': '按综合分',

  // ── 指标 ──
  'metric.score': '综合分',
  'metric.rank': '组内排名',
  'metric.stars': 'Star',
  'metric.forks': 'Fork',
  'metric.contributors': '贡献者',
  'metric.installs': '安装量',
  'metric.activity': '活跃度',
  'metric.activityShort': '活跃',
  'metric.openrouterTokens': 'OpenRouter 月 token',
  'metric.delta7dInstalls': '7d 安装增',
  'metric.delta30dInstalls': '30d 安装增',
  'metric.growth30d': '30d 增速',
  'metric.level': '数据完整度',
  'metric.license': 'License',
  'metric.release': '最近发版',
  'metric.version': '当前版本',
  'metric.bucket': '归属',
  'metric.current': '当前',

  // ── 标记 ──
  'flag.partial_data': '数据不全',
  'flag.no_data': '数据未公开',
  'flag.installs_may_include_ci': '含 CI 安装',
  'flag.small_group': '样本少',
  'flag.newcomer': '新秀',
  'flag.dormant': '已停更',
  'flag.store_installs': '商店累计安装',
  'flag.backfilled_installs': '历史回填',

  // ── 事件 ──

  // ── 首页 ──
  'home.eyebrow': 'AI Agent Index · 快照 {date}',
  'home.title': '把不同的生态\n放到同一把尺子上',
  'home.lede':
    'GitHub star、npm / PyPI 下载、商店安装量先压缩到组内分位数，再按形态分组排名。{n} 个 AI agent、9 种形态（终端 / 插件 / AI IDE / 桌面 / 浏览器 / 框架 / 平台 / 自主 / 助手），跨形态不比总量 —— 先看你在哪儿用它，再比数据。',
  'home.readout.listed': '收录',
  'home.readout.ranked': '在榜',
  'home.step1': 'Step 01 · 选形态',
  'home.step1Hint': '你在哪儿用它 → 跨形态不可比',
  'home.step2': 'Step 02 · 找候选',
  'home.step2Hint': '搜索 / 形态 / 归属 · 榜单里按 + 加入对比',
  'home.formMeta': 'Form {idx} · {n}',
  'home.guide': '形态指南 →',
  'home.noData': '暂无可比数据',
  'home.compareCta': '开始对比 →',
  'home.board': '证据 · 双榜',
  'home.boardHint': '同形态内排名 · {date}',
  'home.boardOpen': '开源榜',
  'home.boardClosed': '闭源榜',
  'home.boardOpenFoot': 'OSI 协议 · MIT / Apache / AGPL 等',
  'home.boardClosedFoot': '专有 License · 数据缺失按收录区展示',
  'home.moversUp': '本周上升最快',
  'home.moversDown': '本周下降最快',
  'home.moversHint': '较 {date}（7 天前）的组内排名变动',
  'home.moversNone': '暂无周变动数据',
  'home.suggestTitle': '没找到你用的 agent？',
  'home.suggestBody': '收录靠 GitHub 搜索与人工 watchlist，难免有遗漏。告诉我们你用的工具，人工核对后收录进榜。',
  'home.suggestCta': '提交收录申请',

  // ── 选型 / 搜索 ──
  'picker.placeholder': '搜索 agent：名称、厂商或 slug',
  'picker.searchAria': '搜索 agent',
  'picker.clear': '清空搜索',
  'picker.owner': '归属',
  'picker.form': '形态',
  'picker.matches': '{n} 个匹配',
  'picker.count': '共 {n} 个{bucket} agent',
  'picker.showing': ' · 显示前 {n} 个',
  'picker.fullBoard': '查看完整榜单 →',
  'picker.empty': '没有匹配的 agent。换个关键词，或',
  'picker.reset': '清除筛选',
  'picker.openOnly': '开源',
  'picker.closedOnly': '闭源',
  'picker.star': '{n} star',

  // ── 榜单 ──
  'rank.crumb': 'Board',
  'rank.eyebrowOpen': 'Open Source · 快照 {date}',
  'rank.eyebrowClosed': 'Closed Source · 快照 {date}',
  'rank.titleOpen': '开源榜',
  'rank.titleClosed': '闭源榜',
  'rank.lede': '同形态内比较，跨形态不排名。列头可排序，行尾 + 加入对比 ——',
  'rank.method': '口径说明',
  'rank.owner': '归属',
  'rank.gran': '排序口径',
  'rank.count': '{n} agent · {forms} 形态 · {ranked} 在榜',
  'rank.hint': '周增量需要历史快照；缺失时按综合分排序。',
  'rank.officialRank': '同形态 × 开/闭源命名空间内的官方名次',
  'rank.emptyTitle': '当前筛选下没有 agent',
  'rank.emptyForm': '{form} 在{bucket}榜暂无收录。',
  'rank.emptyBucket': '该归属下暂无收录条目。',
  'rank.emptyCta': '查看全部开源',
  'rank.sortBy': '按 {label} 排序',
  'rank.sameForm': '同形态内',
  'rank.move': '变动',
  'rank.moveNew': '新',
  'rank.moveVs': '较 {date}（{days} 天前）',
  'rank.moveUpWord': '上升 {n} 位：第 {from} → 第 {to} 名',
  'rank.moveDownWord': '下降 {n} 位：第 {from} → 第 {to} 名',
  'rank.moveSameWord': '名次不变（第 {to} 名）',
  'rank.moveNewTitle': '相对 {date} 新入榜',
  'rank.pin': '钉选 {name} 以便对比',
  'rank.unpin': '取消钉选 {name}',
  'rank.pinTitle': '钉选，稍后对比',
  'rank.noscript': '当前浏览器禁用了 JavaScript，筛选与排序不可用。可直接访问',

  // ── 详情 ──
  'agent.crumb': '榜单',
  'agent.lede': '数据截至 {date} · 综合分在同形态组内归一化',
  'agent.homepage': '访问官网 ↗',
  'agent.statScore': '综合分',
  'agent.statRank': '组内排名',
  'agent.statGrowth': '30d 增速',
  'agent.statLevel': '完整度',
  'agent.getStarted': '上手 / Get started',
  'agent.getStartedHint': '安装渠道与入口',
  'agent.install': '安装 / 获取',
  'agent.noCommand': '通过 {channel} 分发，没有可复制的命令行安装方式。',
  'agent.facts': '关键事实',
  'agent.channel': '分发渠道',

  // ── 安装渠道 ──
  'channel.npm': 'npm',
  'channel.pypi': 'PyPI',
  'channel.brew': 'Homebrew',
  'channel.crates': 'crates.io',
  'channel.vscode': 'VS Code 市场',
  'channel.chrome': 'Chrome 商店',
  'channel.github': 'GitHub 源码',
  'channel.site': '官网分发',
  'agent.license': 'License',
  'agent.lastRelease': '最近发版',
  'agent.level': '数据完整度',
  'agent.version': '当前版本',
  'agent.note': '编辑备注',
  'agent.versions': '版本 / Releases',
  'agent.versionLatest': '最新版本与更新说明',
  'agent.versionAt': '发布于 {date}',
  'agent.versionNoNotes': '该渠道只发布版本号，未提供更新说明（npm / PyPI / 商店）。',
  'agent.versionHistory': '版本记录',
  'agent.versionHistoryEmpty': '从下一次采集开始记录版本变化。',
  'agent.versionMissing':
    '未采集到版本信息：该 agent 可能只有 manual 渠道，或包名不在 npm / PyPI / VS Code 市场。',
  'agent.githubRelease': 'GitHub release ↗',
  'agent.versionLink': '查看该版本记录 ↗',
  'agent.trend': '趋势',
  'agent.trendHint': '每日快照 · {n} 个数据点',
  'agent.trendEmpty': '趋势图需要至少 2 天快照。当前首份快照为 {date}，下一次采集后即可看到折线。',
  'agent.starTrend': 'Star 走势',
  'agent.scoreTrend': '综合分走势',
  'agent.metric': '指标',
  'agent.delta1d': '1d 增量',
  'agent.delta7d': '7d 增量',
  'agent.delta30d': '30d 增量',
  'agent.relGrowth': '相对增速',
  'agent.usage': '用量 · OpenRouter',
  'agent.usageTokens': '月 token',
  'agent.usageRequests': '月请求',
  'agent.usageRank': '全球名次',
  'agent.usageNote': '口径：仅统计经 OpenRouter 转发的请求，不含自带 key 直连厂商的用量；名次为 OpenRouter 应用总榜。',
  'agent.partial': '该 agent 部分数据源采集失败，综合分基于可用指标重算（缺失权重已重分配）。',
  'agent.l3': '数据未公开：仅收录，不参与排名（PRD §5.7）。',
  'agent.peers': '同形态其他选择',
  'agent.peersHint': '{form} 内排名靠前',
  'agent.peersAll': '全部 {form} →',
  'agent.peersCompare': '与第一名对比 →',
  'agent.security': '安全公告',
  'agent.securityMalicious': '含 {n} 条恶意包',
  'agent.securityNote': '仅收录历史公告，不代表当前版本受影响，也不构成安全建议。',
  'agent.securityNone': '无包管理渠道，未做 OSV 查询（不会因为“查不到”就说明安全）。',
  'agent.notFound': '未找到',

  // ── 详情页：维护健康（PRD §7.2）──
  'agent.health': '维护健康',
  'agent.healthHint': '同形态 {n} 项内比较 · 中位数为组内基准',
  'agent.healthCommit': '最近提交',
  'agent.healthCommitHint': '距最后一次提交的时间',
  'agent.healthRelease': '最近发版',
  'agent.healthCadence': '发版节奏：中位 {n} 天一次',
  'agent.healthCadenceEmpty': '发版节奏需要至少 2 次版本记录（自 {date} 起累积）',
  'agent.healthMedian': '组内中位 {v}',
  'agent.healthNote': '本区块不参与综合分：只做事实呈现，用于判断维护投入与长期可用性。',
  'agent.groupPos': '组内位置',
  'agent.groupPosLegend': '越长越好 · 竖线为组内中位',
  'agent.groupPosHint':
    '条形长度 = 在同形态组内的相对位置（越长越好），中点为组内中位；缺数据不画条。',
  'agent.posTitle': '组内位置 {p}% · 参与比较 {n} 项',
  'agent.relJustNow': '1 小时内',
  'agent.relHours': '{n} 小时前',
  'agent.relDays': '{n} 天前',
  'agent.relToday': '当天',
  'agent.age': '出道',
  'agent.ageValue': '{n} 天',
  'agent.ageSince': '{date} 起收录',

  // ── 形态指南 ──
  'forms.crumb': 'Form Guide',
  'forms.eyebrow': 'Form Guide · {en}',
  'forms.fit': '适合',
  'forms.tradeoff': '取舍',
  'forms.watch': '看榜时关注',
  'forms.board': '本形态榜单',
  'forms.boardHint': '{n} 个 · 开源 {open} / 闭源 {closed} · {date}',
  'forms.compareTitle': '拿不准？并排比一下',
  'forms.compareDesc': '{a} 和 {b} 是这个形态的前两名，逐行看差异比看总分有用。',
  'forms.compareCta': '对比前两名 →',
  'forms.release': '最近发版',
  'forms.version': '当前版本',

  // ── 安全 ──
  'security.warnTitle': '这不是安全评级。',

  // ── 对比 ──
  'compare.crumb': 'Compare',
  'compare.eyebrow': 'Compare · Side by side',
  'compare.title': '并排比较',
  'compare.lede':
    '同一形态内的指标才有可比性。选 2–3 个 agent，逐行看 Star、安装量、活跃度、License 的差异 —— 不用再开五个标签页拼信息。',
  'compare.required': '必选',
  'compare.optional': '可选',
  'compare.pickPlaceholder': '选择 agent…',
  'compare.quick': '快速开始：',
  'compare.preset': '比 {form} 前二',
  'compare.mixedTitle': '跨形态对比：',
  'compare.mixed':
    '不同形态的 Star / 安装量不可直接比较，综合分也来自不同分组。这里只做参数参考。',
  'compare.mixedNsTitle': '跨命名空间对比：',
  'compare.mixedNs':
    '开源与闭源是两套分位命名空间，综合分与名次互不可比 —— 这一组不标「最优」。',
  'compare.emptyTitle': '选两个 agent，并排看差异',
  'compare.empty':
    '同一形态内的指标才有可比性。上面选 A / B，或用「快速开始」直接对比某形态的前两名。',
  'compare.bestNote': '的是该行最优值（仅在有 ≥2 个不同数值时标注）。跨形态不排名，详情见',
  'compare.noscript': '对比需要 JavaScript。可以直接打开两个 agent 详情页手工比对，或访问',

  // ── 口径 ──
  'about.crumb': '方法与口径',
  'about.title': '方法与口径',
  'about.lede': '我们公开算法与数据来源 —— 综合分是观点，不是客观事实；所有原始指标都可切换排序。',
  'about.score': '综合分',
  'about.step1': '每个指标 log 压缩（抑制数量级差距）',
  'about.step2': '同形态组内分位数归一 ∈ [0,1]',
  'about.step3': '缺失指标权重重分配给其余指标',
  'about.step4': '加权求和 → [0,100]',
  'about.weights': '权重（v1）',
  'about.w1': 'Star 总量',
  'about.w2': '30 日增速',
  'about.w3': '活跃度',
  'about.w4': '安装量',
  'about.w5': '贡献者',
  'about.w6': '生态',
  'about.w7': 'Fork',
  'about.oss': '开源/闭源判定',
  'about.ossText': '按 License 与源码可见性，不按分发渠道。Claude Code 走 npm 但闭源；Aider 走 PyPI 但开源。',
  'about.sources': '数据来源',
  'about.sourcesText':
    'GitHub API · npm registry · PyPI (pypistats) · VS Code Marketplace（低频）。每日 UTC 02:00 采集，快照归档。',
  'about.anti': '反作弊',
  'about.anti1': '单日 star 增幅异常且没有 release / 报道佐证 → 只进入人工复核队列（不做自动降权，也不给红黄绿评级）',
  'about.anti2': '增速基准低于 FLOOR（7d=50，30d=200）→ 不计算增速（防小基数暴涨）',
  'about.disclaimer': '免责',
  'about.disclaimerText': '榜单为独立整理，与任何厂商无利益关联。数据可能有延迟或错误，欢迎提交 Issue 纠错。',

  // ── 变更 ──
  'changelog.title': '变更记录',
  'changelog.lede': '榜单条目增删、算法版本、口径调整。每次算法变更都会升 score_version。',
  'changelog.algo': '算法版本',
  'changelog.current': '当前',
  'changelog.normalize':
    '归一化：log 压缩 → 同形态组内秩中点平滑分位 (midRank+0.5)/n → 缺失权重重分配 → 加权求和',
  'changelog.spec': '口径变更',
  'changelog.date': '日期',
  'changelog.change': '变更',
  'changelog.reason': '原因',
  'changelog.product': '产品结构',
  'changelog.entries': '条目变更',
  'changelog.fixNoteBody': '发现数据错误？欢迎提 Issue 或直接修改 agents.yaml 提 PR —— CI 会自动校验格式。',

  // ── 托盘 ──
  'tray.label': '候选',
  'tray.compare': '对比 {n} 个 →',
  'tray.hint': '再钉 1 个即可对比',
  'tray.clear': '清空',
  'tray.remove': '移除 {name}',
  'tray.aria': '对比候选',

  // ── 图表 ──
  'chart.series.star': 'Star',
  'chart.series.score': '综合分',
};

const en: Dict = {
  'app.name': 'AgentNews',
  'app.tagline': 'AI Agent Index',
  'app.snapshot': 'Snapshot',
  'app.theme': 'Toggle color theme',
  'app.lang': 'Switch language',
  'app.skip': 'Skip to content',
  'app.all': 'All',
  'app.more': 'All →',
  'app.none': '—',
  'app.copy': 'Copy',
  'app.copied': 'Copied',
  'app.notRanked': 'Not ranked',
  'app.notFound': 'Not found',
  'app.home': 'Back to home',

  // ── 404 ──
  'notfound.lede': 'This page does not exist or was merged. Start from the home page or a board.',

  // ── Data ──
  'data.crumb': 'Data',
  'data.eyebrow': 'Download & Cite',
  'data.title': 'Data',
  'data.lede': 'Snapshots, metrics and citation formats. Ranked data is downloadable, reproducible and auditable.',
  'home.closedPending': 'Another {n} closed entries are awaiting data',
  'nav.index': 'Index',
  'nav.board': 'Board',
  'nav.compare': 'Compare',
  'nav.method': 'Method',
  'nav.indexEn': 'Index',
  'nav.boardEn': 'Board',
  'nav.compareEn': 'Diff',
  'nav.methodEn': 'Method',

  'footer.line': '{name} · {tagline} · Snapshot {date} · {open} open / {closed} closed',
  'footer.principles': 'Only comparable things get ranked · Score is an opinion, not a fact',
  'footer.method': 'Method',
  'footer.data': 'Data',
  'footer.rss': 'RSS',
  'footer.suggest': 'Suggest an agent',

  'form.cli': 'CLI',
  'form.ide-plugin': 'IDE Extension',
  'form.ide-app': 'AI IDE',
  'form.desktop': 'Desktop',
  'form.browser': 'Browser',
  'form.framework': 'Framework',
  'form.platform': 'Platform',
  'form.autonomous': 'Autonomous',
  'form.assistant': 'Assistant',

  'bucket.open': 'Open',
  'bucket.semi': 'Source-available',
  'bucket.closed': 'Closed',
  'gran.week': '7-day installs',
  'gran.month': 'Score',

  'metric.score': 'Score',
  'metric.rank': 'Rank in form',
  'metric.stars': 'Stars',
  'metric.forks': 'Forks',
  'metric.contributors': 'Contributors',
  'metric.installs': 'Installs',
  'metric.activity': 'Activity',
  'metric.activityShort': 'Active',
  'metric.openrouterTokens': 'OpenRouter tokens/mo',
  'metric.delta7dInstalls': '7d install Δ',
  'metric.delta30dInstalls': '30d install Δ',
  'metric.growth30d': '30d growth',
  'metric.level': 'Data level',
  'metric.license': 'License',
  'metric.release': 'Last release',
  'metric.version': 'Version',
  'metric.bucket': 'License type',
  'metric.current': 'Now',

  'flag.partial_data': 'Partial data',
  'flag.no_data': 'No data',
  'flag.installs_may_include_ci': 'Incl. CI',
  'flag.small_group': 'Small sample',
  'flag.newcomer': 'Newcomer',
  'flag.dormant': 'Dormant',
  'flag.store_installs': 'Store installs',
  'flag.backfilled_installs': 'Backfilled',


  'home.eyebrow': 'AI Agent Index · Snapshot {date}',
  'home.title': 'Put every ecosystem\non one ruler',
  'home.lede':
    'GitHub stars, npm / PyPI downloads and store installs are compressed to in-form percentiles before ranking. {n} AI agents, 9 forms (terminal / plugin / AI IDE / desktop / browser / framework / platform / autonomous / assistant), never compared across forms — pick where you use it, then compare numbers.',
  'home.readout.listed': 'Listed',
  'home.readout.ranked': 'Ranked',
  'home.step1': 'Step 01 · Pick a form',
  'home.step1Hint': 'Where you use it → never compared across forms',
  'home.step2': 'Step 02 · Shortlist',
  'home.step2Hint': 'Search / form / license · hit + in the board to compare',
  'home.formMeta': 'Form {idx} · {n}',
  'home.guide': 'Form guide →',
  'home.noData': 'No comparable data yet',
  'home.compareCta': 'Compare now →',
  'home.board': 'Evidence · both boards',
  'home.boardHint': 'Ranked within form · {date}',
  'home.boardOpen': 'Open source',
  'home.boardClosed': 'Closed source',
  'home.boardOpenFoot': 'OSI licenses · MIT / Apache / AGPL',
  'home.boardClosedFoot': 'Proprietary · unranked when data is missing',
  'home.moversUp': 'Biggest risers',
  'home.moversDown': 'Biggest fallers',
  'home.moversHint': 'in-form rank moves vs {date} (7d ago)',
  'home.moversNone': 'No weekly moves yet',
  'home.suggestTitle': 'Missing an agent you use?',
  'home.suggestBody': 'We list agents via GitHub search plus a hand-maintained watchlist — gaps happen. Tell us what you use and we will review and add it.',
  'home.suggestCta': 'Suggest an agent',

  'picker.placeholder': 'Search agents: name, vendor or slug',
  'picker.searchAria': 'Search agents',
  'picker.clear': 'Clear search',
  'picker.owner': 'License',
  'picker.form': 'Form',
  'picker.matches': '{n} matches',
  'picker.count': '{n} {bucket} agents',
  'picker.showing': ' · showing first {n}',
  'picker.fullBoard': 'Open full board →',
  'picker.empty': 'No matching agents. Try another keyword, or',
  'picker.reset': 'clear filters',
  'picker.openOnly': 'Open',
  'picker.closedOnly': 'Closed',
  'picker.star': '{n} stars',

  'rank.crumb': 'Board',
  'rank.eyebrowOpen': 'Open Source · Snapshot {date}',
  'rank.eyebrowClosed': 'Closed Source · Snapshot {date}',
  'rank.titleOpen': 'Open source',
  'rank.titleClosed': 'Closed source',
  'rank.lede': 'Compared within a form, never across forms. Sort by any column, hit + to compare —',
  'rank.method': 'method',
  'rank.owner': 'License',
  'rank.gran': 'Ranked by',
  'rank.count': '{n} agents · {forms} forms · {ranked} ranked',
  'rank.hint': '7-day install deltas need snapshot history; falls back to score when missing.',
  'rank.officialRank': 'Official rank within form × open/closed namespace',
  'rank.emptyTitle': 'No agents under this filter',
  'rank.emptyForm': 'No {form} entries on the {bucket} board yet.',
  'rank.emptyBucket': 'No entries under this filter yet.',
  'rank.emptyCta': 'View all open source',
  'rank.sortBy': 'Sorted by {label}',
  'rank.sameForm': 'within form',
  'rank.move': 'Change',
  'rank.moveNew': 'NEW',
  'rank.moveVs': 'vs {date} ({days}d ago)',
  'rank.moveUpWord': 'up {n}: #{from} → #{to}',
  'rank.moveDownWord': 'down {n}: #{from} → #{to}',
  'rank.moveSameWord': 'no change (#{to})',
  'rank.moveNewTitle': 'newly ranked since {date}',
  'rank.pin': 'Pin {name} to compare',
  'rank.unpin': 'Unpin {name}',
  'rank.pinTitle': 'Pin for comparison',
  'rank.noscript': 'JavaScript is disabled, so filtering and sorting are unavailable. You can open',

  'agent.crumb': 'Board',
  'agent.lede': 'Data as of {date} · score normalized within form',
  'agent.homepage': 'Visit site ↗',
  'agent.statScore': 'Score',
  'agent.statRank': 'Rank in form',
  'agent.statGrowth': '30d growth',
  'agent.statLevel': 'Level',
  'agent.getStarted': 'Get started',
  'agent.getStartedHint': 'Install channel and links',
  'agent.install': 'Install / get it',
  'agent.noCommand': 'Distributed via {channel}; there is no copyable CLI install command.',
  'agent.facts': 'Key facts',
  'agent.channel': 'Channel',

  'channel.npm': 'npm',
  'channel.pypi': 'PyPI',
  'channel.brew': 'Homebrew',
  'channel.crates': 'crates.io',
  'channel.vscode': 'VS Code Marketplace',
  'channel.chrome': 'Chrome Web Store',
  'channel.github': 'GitHub source',
  'channel.site': 'Vendor site',
  'agent.license': 'License',
  'agent.lastRelease': 'Last release',
  'agent.level': 'Data level',
  'agent.version': 'Version',
  'agent.note': 'Editor note',
  'agent.versions': 'Releases',
  'agent.versionLatest': 'Latest version and notes',
  'agent.versionAt': 'published {date}',
  'agent.versionNoNotes': 'This channel only publishes a version number (npm / PyPI / store).',
  'agent.versionHistory': 'Version history',
  'agent.versionHistoryEmpty': 'Version changes will be recorded from the next collection.',
  'agent.versionMissing':
    'No version captured: this agent may only have a manual channel, or its package is not on npm / PyPI / VS Code Marketplace.',
  'agent.githubRelease': 'GitHub release ↗',
  'agent.versionLink': 'View version history ↗',
  'agent.trend': 'Trend',
  'agent.trendHint': 'Daily snapshots · {n} data points',
  'agent.trendEmpty':
    'A trend needs at least 2 days of snapshots. First snapshot is {date}; the line appears after the next collection.',
  'agent.starTrend': 'Stars trend',
  'agent.scoreTrend': 'Score trend',
  'agent.metric': 'Metric',
  'agent.delta1d': '1d Δ',
  'agent.delta7d': '7d Δ',
  'agent.delta30d': '30d Δ',
  'agent.relGrowth': 'Relative growth',
  'agent.usage': 'Usage · OpenRouter',
  'agent.usageTokens': 'Tokens / mo',
  'agent.usageRequests': 'Requests / mo',
  'agent.usageRank': 'Global rank',
  'agent.usageNote':
    'Scope: requests routed through OpenRouter only — direct-to-provider usage with your own key is not counted. Rank is the OpenRouter app leaderboard.',
  'agent.partial': 'Some sources failed for this agent; the score was recomputed on available metrics (missing weights redistributed).',
  'agent.l3': 'Data not public: listed only, not ranked (PRD §5.7).',
  'agent.peers': 'Other options in this form',
  'agent.peersHint': 'Top ranked {form}',
  'agent.peersAll': 'All {form} →',
  'agent.peersCompare': 'Compare with #1 →',
  'agent.security': 'Security advisories',
  'agent.securityMalicious': 'incl. {n} malicious',
  'agent.securityNote':
    'Historical advisories only. They do not mean the current version is affected, and this is not security advice.',
  'agent.securityNone':
    'No package channel, so no OSV query was made (not finding anything does not mean it is safe).',
  'agent.notFound': 'Not found',

  // ── Detail: maintenance health (PRD §7.2) ──
  'agent.health': 'Maintenance health',
  'agent.healthHint': 'Compared within {n} same-form entries · median is the group baseline',
  'agent.healthCommit': 'Last commit',
  'agent.healthCommitHint': 'Time since the latest commit',
  'agent.healthRelease': 'Last release',
  'agent.healthCadence': 'Cadence: a release every {n} days (median)',
  'agent.healthCadenceEmpty':
    'Cadence needs at least 2 version records (collecting since {date})',
  'agent.healthMedian': 'Group median {v}',
  'agent.healthNote':
    'Not part of the composite score — facts only, to judge maintenance and long-term availability.',
  'agent.groupPos': 'In group',
  'agent.groupPosLegend': 'longer is better · tick = group median',
  'agent.groupPosHint':
    'Bar length = position within the same form (longer is better), centred on the group median. No bar when data is missing.',
  'agent.posTitle': 'Position {p}% · {n} compared',
  'agent.relJustNow': 'under 1h ago',
  'agent.relHours': '{n}h ago',
  'agent.relDays': '{n}d ago',
  'agent.relToday': 'same day',
  'agent.age': 'Age',
  'agent.ageValue': '{n}d',
  'agent.ageSince': 'listed since {date}',

  'forms.crumb': 'Form Guide',
  'forms.eyebrow': 'Form Guide · {en}',
  'forms.fit': 'Good fit',
  'forms.tradeoff': 'Trade-offs',
  'forms.watch': 'What to watch',
  'forms.board': 'Board for this form',
  'forms.boardHint': '{n} agents · {open} open / {closed} closed · {date}',
  'forms.compareTitle': 'Not sure? Compare them',
  'forms.compareDesc': '{a} and {b} lead this form. Row-by-row differences beat a single score.',
  'forms.compareCta': 'Compare top two →',
  'forms.release': 'Last release',
  'forms.version': 'Version',

  'security.warnTitle': 'This is not a security rating.',

  'compare.crumb': 'Compare',
  'compare.eyebrow': 'Compare · Side by side',
  'compare.title': 'Compare side by side',
  'compare.lede':
    'Metrics are only comparable within a form. Pick 2–3 agents and see stars, installs, activity and license row by row — no more five-tab research.',
  'compare.required': 'required',
  'compare.optional': 'optional',
  'compare.pickPlaceholder': 'Pick an agent…',
  'compare.quick': 'Quick start:',
  'compare.preset': 'Top two {form}',
  'compare.mixedTitle': 'Cross-form comparison:',
  'compare.mixed':
    'Stars and installs are not directly comparable across forms, and scores come from different groups. Use this as parameter reference only.',
  'compare.mixedNsTitle': 'Cross-namespace comparison:',
  'compare.mixedNs':
    'Open and closed are separate percentile namespaces — scores and ranks are not comparable across them, so no “best” marker is shown here.',
  'compare.emptyTitle': 'Pick two agents to see the diff',
  'compare.empty':
    'Metrics are only comparable within a form. Choose A / B above, or use “Quick start” to compare the top two of any form.',
  'compare.bestNote': ' marks the best value in a row (only when ≥2 distinct values exist). No cross-form ranking — see',
  'compare.noscript': 'Comparison needs JavaScript. You can open two agent pages and compare manually, or visit',

  'about.crumb': 'Method',
  'about.title': 'Method',
  'about.lede': 'We publish the algorithm and the sources — the score is an opinion, not a fact. Every raw metric can be sorted.',
  'about.score': 'Score',
  'about.step1': 'log-compress every metric (dampens order-of-magnitude gaps)',
  'about.step2': 'normalize to in-form percentile ∈ [0,1]',
  'about.step3': 'redistribute missing weights to remaining metrics',
  'about.step4': 'weighted sum → [0,100]',
  'about.weights': 'Weights (v1)',
  'about.w1': 'Stars',
  'about.w2': '30-day growth',
  'about.w3': 'Activity',
  'about.w4': 'Installs',
  'about.w5': 'Contributors',
  'about.w6': 'Ecosystem',
  'about.w7': 'Forks',
  'about.oss': 'Open vs closed',
  'about.ossText':
    'Judged by license and source visibility, not distribution channel. Claude Code ships via npm but is closed; Aider ships via PyPI but is open.',
  'about.sources': 'Data sources',
  'about.sourcesText':
    'GitHub API · npm registry · PyPI (pypistats) · VS Code Marketplace (low frequency). Collected daily at 02:00 UTC and archived.',
  'about.anti': 'Anti-gaming',
  'about.anti1': 'A single-day star spike without a release or press coverage only goes to a human review queue — no automatic penalty and no red/amber/green rating',
  'about.anti2': 'Growth baselines below FLOOR (7d=50, 30d=200) → growth is not computed (prevents small-base spikes)',
  'about.disclaimer': 'Disclaimer',
  'about.disclaimerText':
    'Compiled independently, with no commercial ties to any vendor. Data may be delayed or wrong — issues and corrections are welcome.',

  'changelog.title': 'Changelog',
  'changelog.lede': 'Entry changes, algorithm versions and methodology updates. Every algorithm change bumps score_version.',
  'changelog.algo': 'Algorithm version',
  'changelog.current': 'current',
  'changelog.normalize':
    'Normalization: log-compress → in-form mid-rank percentile (midRank+0.5)/n → redistribute missing weights → weighted sum',
  'changelog.spec': 'Methodology changes',
  'changelog.date': 'Date',
  'changelog.change': 'Change',
  'changelog.reason': 'Reason',
  'changelog.product': 'Product structure',
  'changelog.entries': 'Entry changes',
  'changelog.fixNoteBody': 'Found an error? Open an issue or edit agents.yaml and send a PR — CI validates the format.',

  'tray.label': 'Candidates',
  'tray.compare': 'Compare {n} →',
  'tray.hint': 'Pin one more to compare',
  'tray.clear': 'Clear',
  'tray.remove': 'Remove {name}',
  'tray.aria': 'Comparison candidates',

  'chart.series.star': 'Stars',
  'chart.series.score': 'Score',
};

const DICT: Record<Lang, Dict> = { zh, en };

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? DICT.zh[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/* ───────────── 路由 ───────────── */

export function langOf(pathname: string): Lang {
  return pathname === '/zh' || pathname.startsWith('/zh/') ? 'zh' : 'en';
}

export function stripLang(pathname: string): string {
  if (pathname === '/zh') return '/';
  if (pathname.startsWith('/zh/')) return pathname.slice(3) || '/';
  return pathname;
}

/** 把站内路径转成目标语言的路径（英语无前缀，中文在 /zh/） */
export function pathFor(lang: Lang, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'en') return p;
  return p === '/' ? '/zh/' : `/zh${p}`;
}

export function swapLangPath(pathname: string, target: Lang): string {
  return pathFor(target, stripLang(pathname));
}

/* ───────────── 标签 ───────────── */

export function formLabel(lang: Lang, form: string): string {
  return t(lang, `form.${form}`);
}

export function bucketText(lang: Lang, bucket: string): string {
  return t(lang, `bucket.${bucket}`);
}

export function granLabel(lang: Lang, g: string): string {
  return t(lang, `gran.${g}`);
}

export function flagLabel(lang: Lang, flag: string): string {
  return t(lang, `flag.${flag}`);
}

/** 安装渠道名称（数据层只存 key，展示时才本地化） */
export function channelLabel(lang: Lang, channel: string): string {
  return t(lang, `channel.${channel}`);
}
