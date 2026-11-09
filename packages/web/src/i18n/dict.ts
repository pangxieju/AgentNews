/**
 * 全站文案字典 —— 纯 TS，无 Node 依赖，服务端与客户端 island 共用。
 *
 * 约定：
 * - 平面 key，用前缀分组（nav.* / rank.* / agent.* …）
 * - `{name}` 占位符由 t(lang, key, { name }) 替换
 * - 路由：中文在根路径，英文在 /en/ 前缀（保留已有 URL，不破坏外链）
 */

export type Lang = 'zh' | 'en';
export const LANGS: Lang[] = ['zh', 'en'];
export const LANG_SHORT: Record<Lang, string> = { zh: '中', en: 'EN' };
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
  'app.agent': 'Agent',
  'app.all': '全部',
  'app.more': '全部 →',
  'app.none': '—',
  'app.copy': '复制',
  'app.copied': '已复制',
  'app.updatedAt': '数据截至 {date}',
  'app.notRanked': '未上榜',

  // ── 导航 ──
  'nav.index': '总览',
  'nav.board': '榜单',
  'nav.compare': '对比',
  'nav.new': '新秀',
  'nav.log': '动态',
  'nav.osv': '安全',
  'nav.archive': '归档',
  'nav.method': '口径',
  'nav.indexEn': 'Index',
  'nav.boardEn': 'Board',
  'nav.compareEn': 'Diff',
  'nav.newEn': 'New',
  'nav.logEn': 'Log',
  'nav.osvEn': 'OSV',
  'nav.archiveEn': 'Archive',
  'nav.methodEn': 'Method',

  // ── 页脚 ──
  'footer.line': '{name} · {tagline} · 快照 {date} · 开源 {open} / 闭源 {closed}',
  'footer.principles': '可比的才排名 · 综合分是观点，非客观事实',
  'footer.method': '方法与口径',
  'footer.changelog': '变更记录',
  'footer.archive': '数据归档',
  'footer.security': '安全公告',

  // ── 形态 ──
  'form.cli': 'CLI',
  'form.ide-plugin': 'IDE 插件',
  'form.ide-app': 'IDE 应用',
  'form.desktop': '桌面',
  'form.browser': '浏览器',
  'form.framework': '框架',
  'form.autonomous': '自主',

  // ── 归属 / 粒度 ──
  'bucket.open': '开源',
  'bucket.semi': '半开源',
  'bucket.closed': '闭源',
  'gran.day': '日榜',
  'gran.week': '周榜',
  'gran.month': '月榜',

  // ── 指标 ──
  'metric.score': '综合分',
  'metric.rank': '组内排名',
  'metric.stars': 'Star',
  'metric.forks': 'Fork',
  'metric.contributors': '贡献者',
  'metric.installs': '安装量',
  'metric.activity': '活跃度',
  'metric.activityShort': '活跃',
  'metric.delta1d': '日增',
  'metric.delta7d': '7d 增',
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
  'flag.suspicious': '可疑增长',

  // ── 事件 ──
  'event.release': '发版',
  'event.version': '版本',
  'event.listed': '新收录',
  'event.rank_jump': '排名变化',
  'event.newcomer': '新秀',
  'event.license_change': 'License',
  'event.archived': '归档',

  // ── 首页 ──
  'home.eyebrow': 'AI Agent Index · 快照 {date}',
  'home.title': '把不同的生态\n放到同一把尺子上',
  'home.lede':
    'GitHub star、npm / PyPI 下载、商店安装量先压缩到组内分位数，再按形态分组排名。{n} 个 agent，7 种形态，跨形态不比总量 —— 先看形态，再比数据。',
  'home.readout.listed': '收录',
  'home.readout.open': '开源',
  'home.readout.closed': '闭源',
  'home.readout.forms': '形态',
  'home.readout.ranked': '在榜',
  'home.step1': 'Step 01 · 选形态',
  'home.step1Hint': '你在哪儿用它 → 跨形态不可比',
  'home.step2': 'Step 02 · 找候选',
  'home.step2Hint': '搜索 / 形态 / 归属 · 榜单里按 + 加入对比',
  'home.step3': 'Step 03 · 并排比',
  'home.step3Hint': '同形态内逐行比 12 项',
  'home.formMeta': 'Form {idx} · {n}',
  'home.guide': '形态指南 →',
  'home.noData': '暂无可比数据',
  'home.compareEyebrow': 'Compare',
  'home.compareTitle': '两个候选，逐行比',
  'home.compareDesc':
    '综合分只说明谁在前，对比才说明差在哪：Star、安装量、活跃度、License、最近发版。',
  'home.compareCta': '开始对比 →',
  'home.board': '证据 · 双榜',
  'home.boardHint': '同形态内排名 · {date}',
  'home.boardOpen': '开源榜',
  'home.boardClosed': '闭源榜',
  'home.boardOpenFoot': 'OSI 协议 · MIT / Apache / AGPL 等',
  'home.boardClosedFoot': '专有 License · 数据缺失按收录区展示',
  'home.scale': '归一化尺度',
  'home.scaleRange': '组内分位数 0 → 100',
  'home.scaleNote': '缺失指标权重重分配 · 不编造名次',

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
  'rank.gran': '粒度',
  'rank.count': '{n} agent · {forms} 形态 · {ranked} 在榜',
  'rank.hint': '增量数据积累中：日 / 周榜需 ≥1 天历史快照，当前按综合分排序。',
  'rank.emptyTitle': '当前筛选下没有 agent',
  'rank.emptyForm': '{form} 在{bucket}榜暂无收录。',
  'rank.emptyBucket': '该归属下暂无收录条目。',
  'rank.emptyCta': '查看全部开源',
  'rank.sortBy': '按 {label} 排序',
  'rank.sameForm': '同形态内',
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
  'agent.versionLink': 'View version history ↗',
  'agent.versionLink': '查看该版本记录 ↗',
  'agent.trend': '趋势',
  'agent.trendHint': '每日快照 · {n} 个数据点',
  'agent.trendEmpty': '趋势图需要至少 2 天快照。当前首份快照为 {date}，下一次采集后即可看到折线。',
  'agent.starTrend': 'Star 走势',
  'agent.scoreTrend': '综合分走势',
  'agent.metrics': '指标明细',
  'agent.metric': '指标',
  'agent.delta1d': '1d 增量',
  'agent.delta7d': '7d 增量',
  'agent.delta30d': '30d 增量',
  'agent.relGrowth': '相对增速',
  'agent.partial': '该 agent 部分数据源采集失败，综合分基于可用指标重算（缺失权重已重分配）。',
  'agent.l3': '数据未公开：仅收录，不参与排名（PRD §5.7）。',
  'agent.peers': '同形态其他选择',
  'agent.peersHint': '{form} 内排名靠前',
  'agent.peersAll': '全部 {form} →',
  'agent.peersCompare': '与第一名对比 →',
  'agent.security': '安全公告',
  'agent.securityText':
    '包 {pkg}（{eco}）在 OSV 上有 <b>{n}</b> 条历史公告。最近一条更新于 {date}。',
  'agent.securityMalicious': '含 {n} 条恶意包',
  'agent.securityNote': '仅收录历史公告，不代表当前版本受影响，也不构成安全建议。',
  'agent.securityNone': '无包管理渠道，未做 OSV 查询（不会因为“查不到”就说明安全）。',
  'agent.notFound': '未找到',

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
  'forms.others': '其他形态',
  'forms.othersHint': '跨形态不排名',
  'forms.release': '最近发版',
  'forms.version': '当前版本',

  // ── 新秀 ──
  'rising.crumb': '新秀榜',
  'rising.title': '新秀榜',
  'rising.lede': '出道 ≤ {days} 天且已上榜的 agent · 数据截至 {date}',
  'rising.explain':
    '口径：出道天数 = min（repo 创建至今, 首次收录至今）。「首次收录」只在该项目晚于系统上线日（{started}）被收录时计入 —— 上线当天收录的条目无法区分「本来就存在」与「刚出现」。',
  'rising.list': '新秀',
  'rising.empty':
    '当前无符合条件的 agent（收录名单里最年轻的也已超过 {days} 天）。这说明当前样本偏向成熟项目 —— 新秀榜需要持续收录新项目才有内容。',
  'rising.youngest': '最年轻的 10 个',
  'rising.youngestHint': '按 repo 创建时间排序，帮助发现接近新秀资格的项目',
  'rising.age': '出道',
  'rising.firstListed': '首次收录',
  'rising.days': '{n} 天',

  // ── 动态 ──
  'activity.crumb': '动态',
  'activity.title': '动态',
  'activity.lede': '发版 / 版本 / 新收录 / 排名跃迁 / 新秀 · 数据截至 {date}',
  'activity.all': '全部',
  'activity.empty':
    '尚无事件。事件由「与上一个快照的差异」生成 —— 上线首日没有基线，从第二天起才会产生动态。',
  'activity.releaseDetail': '发布于 {date}',
  'activity.rankJump': '#{from} → #{to}',

  // ── 安全 ──
  'security.crumb': '安全情报',
  'security.title': '安全情报',
  'security.lede': '公开安全公告聚合（来源 OSV.dev）· 数据截至 {date}',
  'security.warnTitle': '这不是安全评级。',
  'security.warn':
    '下表只是「该包在 OSV 上的历史公告数」，不区分是否已修复、也不判断你的使用方式是否受影响。我们不做安全背书，也不给红黄绿总分 —— 请点原文链接自行核实。',
  'security.coverage': '查询覆盖',
  'security.coverageHint': '个有包管理渠道的 agent',
  'security.withAny': '有历史公告',
  'security.withAnyHint': '个 agent 的包存在公开公告',
  'security.total': '公告总数',
  'security.totalHint': '含历史版本，不代表当前版本受影响',
  'security.malicious': '恶意包告警',
  'security.maliciousHint': 'OSV 的 MAL-* 条目',
  'security.top': '公告数 Top 10',
  'security.topHint': '红色 = 存在恶意包（MAL-*）条目',
  'security.table': '按公告数排序',
  'security.colPackage': '包',
  'security.colEcosystem': '生态',
  'security.colAdvisories': '历史公告',
  'security.colMalicious': '恶意包',
  'security.colUpdated': '最近更新',
  'security.empty': '尚无安全数据：运行 pnpm collect 生成。',

  // ── 归档 ──
  'archive.crumb': '归档',
  'archive.title': '历史归档',
  'archive.lede': '每周日冻结周档，每月末冻结月档 · 归档口径为结算日当天的滚动值',
  'archive.periods': '周档 / 月档',
  'archive.period': '周期',
  'archive.type': '类型',
  'archive.end': '结算日',
  'archive.ranked': '在榜数',
  'archive.week': '周档',
  'archive.month': '月档',
  'archive.emptyPeriods': '尚无归档。周档在每周日采集后生成，月档在每月最后一天生成。',
  'archive.daily': '每日快照',
  'archive.dailyHint': '每日采集结果，用于趋势计算与历史回溯',
  'archive.listed': '收录数',
  'archive.emptyDaily': '尚无每日快照。',
  'archive.chartNotice': '折线图需要至少 2 天快照（当前 {n} 天：{date}）。每日采集后自动补全。',
  'archive.download':
    '数据可下载：所有快照均为纯 JSON 文件，位于仓库 data/ 目录，可通过 git 历史完整回溯。',
  'archive.labelTitle': '{label} 归档',
  'archive.back': '← 归档列表',
  'archive.endAt': '结算日 {date} · 归档为冻结快照，不随新数据变化',

  // ── 对比 ──
  'compare.crumb': 'Compare',
  'compare.eyebrow': 'Compare · Side by side',
  'compare.title': '并排比较',
  'compare.lede':
    '同一形态内的指标才有可比性。选 2–3 个 agent，逐行看 Star、安装量、活跃度、License 的差异 —— 不用再开五个标签页拼信息。',
  'compare.a': 'A',
  'compare.b': 'B',
  'compare.c': 'C',
  'compare.required': '必选',
  'compare.optional': '可选',
  'compare.pickPlaceholder': '选择 agent…',
  'compare.quick': '快速开始：',
  'compare.preset': '比 {form} 前二',
  'compare.mixedTitle': '跨形态对比：',
  'compare.mixed':
    '不同形态的 Star / 安装量不可直接比较，综合分也来自不同分组。这里只做参数参考。',
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
  'about.anti1': '单日 star 增幅 > 5% 且无 release/报道佐证 → 打 suspicious，趋势榜剔除',
  'about.anti2': '增速基准低于 FLOOR（7d=50，30d=200）→ 不参与增速榜（防小基数暴涨）',
  'about.disclaimer': '免责',
  'about.disclaimerText': '榜单为独立整理，与任何厂商无利益关联。数据可能有延迟或错误，欢迎提交 Issue 纠错。',

  // ── 变更 ──
  'changelog.crumb': '变更记录',
  'changelog.title': '变更记录',
  'changelog.lede': '榜单条目增删、算法版本、口径调整。每次算法变更都会升 score_version。',
  'changelog.algo': '算法版本',
  'changelog.current': '当前',
  'changelog.weights': '权重：Star 20% / 30日增速 25% / 活跃度 15% / 安装量 20% / 贡献者 10% / 生态 5% / Fork 5%',
  'changelog.normalize':
    '归一化：log 压缩 → 同形态组内秩中点平滑分位 (midRank+0.5)/n → 缺失权重重分配 → 加权求和',
  'changelog.spec': '口径变更',
  'changelog.date': '日期',
  'changelog.change': '变更',
  'changelog.reason': '原因',
  'changelog.product': '产品结构',
  'changelog.entries': '条目变更',
  'changelog.action': '动作',
  'changelog.note': '说明',
  'changelog.fixNote': '纠错入口：',
  'changelog.fixNoteBody': '发现数据错误？欢迎提 Issue 或直接修改 agents.yaml 提 PR —— CI 会自动校验格式。',

  // ── 托盘 ──
  'tray.label': '候选',
  'tray.compare': '对比 {n} 个 →',
  'tray.hint': '再钉 1 个即可对比',
  'tray.clear': '清空',
  'tray.remove': '移除 {name}',
  'tray.aria': '对比候选',

  // ── 图表 ──
  'chart.empty': '暂无数据',
  'chart.series.star': 'Star',
  'chart.series.score': '综合分',
  'chart.series.listed': '收录数',
  'chart.series.ranked': '在榜数',
};

const en: Dict = {
  'app.name': 'AgentNews',
  'app.tagline': 'AI Agent Index',
  'app.snapshot': 'Snapshot',
  'app.theme': 'Toggle color theme',
  'app.lang': 'Switch language',
  'app.skip': 'Skip to content',
  'app.agent': 'Agent',
  'app.all': 'All',
  'app.more': 'All →',
  'app.none': '—',
  'app.copy': 'Copy',
  'app.copied': 'Copied',
  'app.updatedAt': 'Data as of {date}',
  'app.notRanked': 'Not ranked',

  'nav.index': 'Index',
  'nav.board': 'Board',
  'nav.compare': 'Compare',
  'nav.new': 'Rising',
  'nav.log': 'Activity',
  'nav.osv': 'Security',
  'nav.archive': 'Archive',
  'nav.method': 'Method',
  'nav.indexEn': 'Index',
  'nav.boardEn': 'Board',
  'nav.compareEn': 'Diff',
  'nav.newEn': 'New',
  'nav.logEn': 'Log',
  'nav.osvEn': 'OSV',
  'nav.archiveEn': 'Archive',
  'nav.methodEn': 'Method',

  'footer.line': '{name} · {tagline} · Snapshot {date} · {open} open / {closed} closed',
  'footer.principles': 'Only comparable things get ranked · Score is an opinion, not a fact',
  'footer.method': 'Method',
  'footer.changelog': 'Changelog',
  'footer.archive': 'Archive',
  'footer.security': 'Security',

  'form.cli': 'CLI',
  'form.ide-plugin': 'IDE Extension',
  'form.ide-app': 'AI IDE',
  'form.desktop': 'Desktop',
  'form.browser': 'Browser',
  'form.framework': 'Framework',
  'form.autonomous': 'Autonomous',

  'bucket.open': 'Open',
  'bucket.semi': 'Source-available',
  'bucket.closed': 'Closed',
  'gran.day': 'Daily',
  'gran.week': 'Weekly',
  'gran.month': 'Monthly',

  'metric.score': 'Score',
  'metric.rank': 'Rank in form',
  'metric.stars': 'Stars',
  'metric.forks': 'Forks',
  'metric.contributors': 'Contributors',
  'metric.installs': 'Installs',
  'metric.activity': 'Activity',
  'metric.activityShort': 'Active',
  'metric.delta1d': '1d Δ',
  'metric.delta7d': '7d Δ',
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
  'flag.suspicious': 'Suspicious',

  'event.release': 'Release',
  'event.version': 'Version',
  'event.listed': 'Listed',
  'event.rank_jump': 'Rank move',
  'event.newcomer': 'Newcomer',
  'event.license_change': 'License',
  'event.archived': 'Archived',

  'home.eyebrow': 'AI Agent Index · Snapshot {date}',
  'home.title': 'Put every ecosystem\non one ruler',
  'home.lede':
    'GitHub stars, npm / PyPI downloads and store installs are compressed to in-form percentiles before ranking. {n} agents, 7 forms, never compared across forms — pick a form first, then compare numbers.',
  'home.readout.listed': 'Listed',
  'home.readout.open': 'Open',
  'home.readout.closed': 'Closed',
  'home.readout.forms': 'Forms',
  'home.readout.ranked': 'Ranked',
  'home.step1': 'Step 01 · Pick a form',
  'home.step1Hint': 'Where you use it → never compared across forms',
  'home.step2': 'Step 02 · Shortlist',
  'home.step2Hint': 'Search / form / license · hit + in the board to compare',
  'home.step3': 'Step 03 · Compare',
  'home.step3Hint': '12 rows, side by side, same form only',
  'home.formMeta': 'Form {idx} · {n}',
  'home.guide': 'Form guide →',
  'home.noData': 'No comparable data yet',
  'home.compareEyebrow': 'Compare',
  'home.compareTitle': 'Two candidates, row by row',
  'home.compareDesc':
    'The score tells you who leads; the diff tells you why. Stars, installs, activity, license, last release.',
  'home.compareCta': 'Compare now →',
  'home.board': 'Evidence · both boards',
  'home.boardHint': 'Ranked within form · {date}',
  'home.boardOpen': 'Open source',
  'home.boardClosed': 'Closed source',
  'home.boardOpenFoot': 'OSI licenses · MIT / Apache / AGPL',
  'home.boardClosedFoot': 'Proprietary · unranked when data is missing',
  'home.scale': 'Normalization scale',
  'home.scaleRange': 'In-form percentile 0 → 100',
  'home.scaleNote': 'Missing weights redistributed · no invented ranks',

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
  'rank.gran': 'Period',
  'rank.count': '{n} agents · {forms} forms · {ranked} ranked',
  'rank.hint': 'Delta data still accumulating: daily / weekly need ≥1 day of history. Currently sorted by score.',
  'rank.emptyTitle': 'No agents under this filter',
  'rank.emptyForm': 'No {form} entries on the {bucket} board yet.',
  'rank.emptyBucket': 'No entries under this filter yet.',
  'rank.emptyCta': 'View all open source',
  'rank.sortBy': 'Sorted by {label}',
  'rank.sameForm': 'within form',
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
  'agent.versionLink': '查看该版本记录 ↗',
  'agent.trend': 'Trend',
  'agent.trendHint': 'Daily snapshots · {n} data points',
  'agent.trendEmpty':
    'A trend needs at least 2 days of snapshots. First snapshot is {date}; the line appears after the next collection.',
  'agent.starTrend': 'Stars trend',
  'agent.scoreTrend': 'Score trend',
  'agent.metrics': 'Metrics',
  'agent.metric': 'Metric',
  'agent.delta1d': '1d Δ',
  'agent.delta7d': '7d Δ',
  'agent.delta30d': '30d Δ',
  'agent.relGrowth': 'Relative growth',
  'agent.partial': 'Some sources failed for this agent; the score was recomputed on available metrics (missing weights redistributed).',
  'agent.l3': 'Data not public: listed only, not ranked (PRD §5.7).',
  'agent.peers': 'Other options in this form',
  'agent.peersHint': 'Top ranked {form}',
  'agent.peersAll': 'All {form} →',
  'agent.peersCompare': 'Compare with #1 →',
  'agent.security': 'Security advisories',
  'agent.securityText':
    'Package {pkg} ({eco}) has <b>{n}</b> advisories on OSV. Latest update {date}.',
  'agent.securityMalicious': 'incl. {n} malicious',
  'agent.securityNote':
    'Historical advisories only. They do not mean the current version is affected, and this is not security advice.',
  'agent.securityNone':
    'No package channel, so no OSV query was made (not finding anything does not mean it is safe).',
  'agent.notFound': 'Not found',

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
  'forms.others': 'Other forms',
  'forms.othersHint': 'Never ranked across forms',
  'forms.release': 'Last release',
  'forms.version': 'Version',

  'rising.crumb': 'Rising',
  'rising.title': 'Rising',
  'rising.lede': 'Listed agents ≤ {days} days old · data as of {date}',
  'rising.explain':
    'Age = min(days since repo creation, days since first listed). “First listed” only counts when a project is listed after launch day ({started}); items listed on day one cannot be distinguished from projects that already existed.',
  'rising.list': 'Rising',
  'rising.empty':
    'No agents qualify right now (the youngest listed project is older than {days} days). The current sample skews mature — this board needs fresh entries to stay useful.',
  'rising.youngest': 'Youngest 10',
  'rising.youngestHint': 'Sorted by repo creation date, to spot near-qualifiers',
  'rising.age': 'Age',
  'rising.firstListed': 'First listed',
  'rising.days': '{n} days',

  'activity.crumb': 'Activity',
  'activity.title': 'Activity',
  'activity.lede': 'Releases / versions / listings / rank moves / newcomers · as of {date}',
  'activity.all': 'All',
  'activity.empty':
    'No events yet. Events are generated by diffing against the previous snapshot — there is no baseline on day one, so they start on day two.',
  'activity.releaseDetail': 'published {date}',
  'activity.rankJump': '#{from} → #{to}',

  'security.crumb': 'Security',
  'security.title': 'Security advisories',
  'security.lede': 'Aggregated public advisories (OSV.dev) · as of {date}',
  'security.warnTitle': 'This is not a security rating.',
  'security.warn':
    'The table only counts historical advisories per package. It does not say whether they are fixed, nor whether your usage is affected. No endorsement, no red/amber/green score — follow the links and verify yourself.',
  'security.coverage': 'Packages checked',
  'security.coverageHint': 'agents with a package channel',
  'security.withAny': 'With advisories',
  'security.withAnyHint': 'agents whose package has public advisories',
  'security.total': 'Total advisories',
  'security.totalHint': 'includes old versions; current version may be unaffected',
  'security.malicious': 'Malicious packages',
  'security.maliciousHint': 'OSV MAL-* entries',
  'security.top': 'Advisories · top 10',
  'security.topHint': 'red = has malicious (MAL-*) entries',
  'security.table': 'Sorted by advisory count',
  'security.colPackage': 'Package',
  'security.colEcosystem': 'Ecosystem',
  'security.colAdvisories': 'Advisories',
  'security.colMalicious': 'Malicious',
  'security.colUpdated': 'Updated',
  'security.empty': 'No security data yet: run pnpm collect.',

  'archive.crumb': 'Archive',
  'archive.title': 'Archive',
  'archive.lede': 'Weekly snapshots freeze on Sunday, monthly on the last day · archive values are the rolling values on the settlement date',
  'archive.periods': 'Weekly / monthly',
  'archive.period': 'Period',
  'archive.type': 'Type',
  'archive.end': 'Settled',
  'archive.ranked': 'Ranked',
  'archive.week': 'Weekly',
  'archive.month': 'Monthly',
  'archive.emptyPeriods': 'No archives yet. Weekly archives are created after Sunday collection; monthly on the last day of the month.',
  'archive.daily': 'Daily snapshots',
  'archive.dailyHint': 'Daily collection results, used for trends and history',
  'archive.listed': 'Listed',
  'archive.emptyDaily': 'No daily snapshots yet.',
  'archive.chartNotice': 'The line chart needs at least 2 days (currently {n}: {date}). It fills in after each daily collection.',
  'archive.download':
    'Data is downloadable: every snapshot is a plain JSON file in the repo data/ directory and fully recoverable from git history.',
  'archive.labelTitle': 'Archive {label}',
  'archive.back': '← All archives',
  'archive.endAt': 'Settled {date} · archived as a frozen snapshot',

  'compare.crumb': 'Compare',
  'compare.eyebrow': 'Compare · Side by side',
  'compare.title': 'Compare side by side',
  'compare.lede':
    'Metrics are only comparable within a form. Pick 2–3 agents and see stars, installs, activity and license row by row — no more five-tab research.',
  'compare.a': 'A',
  'compare.b': 'B',
  'compare.c': 'C',
  'compare.required': 'required',
  'compare.optional': 'optional',
  'compare.pickPlaceholder': 'Pick an agent…',
  'compare.quick': 'Quick start:',
  'compare.preset': 'Top two {form}',
  'compare.mixedTitle': 'Cross-form comparison:',
  'compare.mixed':
    'Stars and installs are not directly comparable across forms, and scores come from different groups. Use this as parameter reference only.',
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
  'about.anti1': 'Single-day star growth > 5% without a release or press coverage → flagged suspicious and dropped from trend boards',
  'about.anti2': 'Growth baselines below FLOOR (7d=50, 30d=200) → excluded from growth boards (prevents small-base spikes)',
  'about.disclaimer': 'Disclaimer',
  'about.disclaimerText':
    'Compiled independently, with no commercial ties to any vendor. Data may be delayed or wrong — issues and corrections are welcome.',

  'changelog.crumb': 'Changelog',
  'changelog.title': 'Changelog',
  'changelog.lede': 'Entry changes, algorithm versions and methodology updates. Every algorithm change bumps score_version.',
  'changelog.algo': 'Algorithm version',
  'changelog.current': 'current',
  'changelog.weights': 'Weights: stars 20% / 30-day growth 25% / activity 15% / installs 20% / contributors 10% / ecosystem 5% / forks 5%',
  'changelog.normalize':
    'Normalization: log-compress → in-form mid-rank percentile (midRank+0.5)/n → redistribute missing weights → weighted sum',
  'changelog.spec': 'Methodology changes',
  'changelog.date': 'Date',
  'changelog.change': 'Change',
  'changelog.reason': 'Reason',
  'changelog.product': 'Product structure',
  'changelog.entries': 'Entry changes',
  'changelog.action': 'Action',
  'changelog.note': 'Note',
  'changelog.fixNote': 'Corrections:',
  'changelog.fixNoteBody': 'Found an error? Open an issue or edit agents.yaml and send a PR — CI validates the format.',

  'tray.label': 'Candidates',
  'tray.compare': 'Compare {n} →',
  'tray.hint': 'Pin one more to compare',
  'tray.clear': 'Clear',
  'tray.remove': 'Remove {name}',
  'tray.aria': 'Comparison candidates',

  'chart.empty': 'No data',
  'chart.series.star': 'Stars',
  'chart.series.score': 'Score',
  'chart.series.listed': 'Listed',
  'chart.series.ranked': 'Ranked',
};

export const DICT: Record<Lang, Dict> = { zh, en };

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? DICT.zh[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/* ───────────── 路由 ───────────── */

export function langOf(pathname: string): Lang {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh';
}

export function stripLang(pathname: string): string {
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/en/')) return pathname.slice(3) || '/';
  return pathname;
}

/** 把站内路径转成目标语言的路径 */
export function pathFor(lang: Lang, path: string): string {
  const p = path.startsWith('/') ? path : '/' + path;
  if (lang === 'zh') return p;
  return p === '/' ? '/en/' : '/en' + p;
}

export function swapLangPath(pathname: string, target: Lang): string {
  return pathFor(target, stripLang(pathname));
}

/* ───────────── 标签 ───────────── */

export const FORM_KEYS = [
  'cli',
  'ide-plugin',
  'ide-app',
  'desktop',
  'browser',
  'framework',
  'autonomous',
] as const;

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

export function eventLabel(lang: Lang, kind: string): string {
  return t(lang, `event.${kind}`);
}
