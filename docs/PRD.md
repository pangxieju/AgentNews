# AI Agent 排行榜 —— 产品需求文档（PRD）

> **现状（2026-11-15）**：本文为早期产品设计稿（v0.3），实现已超出/偏离部分条目，以 README + 代码为准。
> 主要差异：形态 9 种（非 7 种）；`/rising` `/activity` `/security` `/archive` `/news` 频道页未上线（前四个已 301）；事件 5 类；`ecosystem`（Discord）未采集；周/月榜 = 同一快照的默认排序而非独立窗口；归档改为 `/data/archive/{label}.json`。

| 项目 | 内容 |
|---|---|
| 产品名（暂定） | AgentNews —— AI Agent 排行榜 |
| 文档版本 | v0.3（待评审） |
| 状态 | 需求确认中，未进入开发 |
| 作者 | 产品经理 |
| 最后更新 | 第 3 版：周期口径定稿（滚动计算 + 自然周期归档） |

---

## 1. 背景与问题

AI Agent 生态在过去 18 个月快速膨胀：终端编码 agent（Claude Code、Codex CLI、Gemini CLI、OpenCode、Pi、Aider）、IDE 插件（Cline、Roo Code、Continue）、桌面/IDE 一体化产品（Cursor、Windsurf、Trae）、浏览器 agent、多智能体框架（CrewAI、LangGraph、AutoGen）各自演化。

开发者面临的真实问题是：

1. **不知道该选哪个** —— 信息散落在 GitHub、X、HN、官方文档，没有统一的横截面。
2. **现有榜单不可比** —— GitHub Trending 只看当日增量；star-history / ossinsight 只看 GitHub 存量；npm trends 只看 npm 生态；LMArena 只看模型能力不看工具产品。
3. **没有"agent 专用"的榜** —— 通用榜单无法处理"框架 vs 终端产品 vs IDE 插件"的形态差异。
4. **闭源产品完全缺席** —— Cursor、Claude Code、Windsurf 这类主流选择在任何榜单里都没有位置。

**结论：做一个以 agent 为唯一对象的、跨生态归一化的、开源/闭源双榜的排行榜产品。**

---

## 2. 目标与非目标

### 2.1 产品目标

| 编号 | 目标 | 衡量方式 |
|---|---|---|
| G1 | 让开发者在 30 秒内判断"我这个场景该用哪个 agent" | 首页到详情页转化率、榜内搜索使用率 |
| G2 | 建立跨生态可比的统一热度口径 | 榜单被外部引用/转载次数 |
| G3 | 覆盖开源与闭源两类主流选择 | 首版收录 ≥ 40 个 agent，两类各 ≥ 15 |
| G4 | 数据可复现、可审计，形成公信力 | 数据快照公开、算法文档公开、社区 PR 纠错 |
| G5 | 从「选型工具」扩展为「agent 情报入口」，提升回访 | 周回访率、活动/新闻订阅数 |

### 2.2 非目标（本期明确不做）

- ❌ **不做能力评测 / 打分对比**（如 SWE-bench 跑分排行榜）—— 成本极高，且与本产品的"热度与采用度"定位冲突。仅做**外链展示**已有评测结果。
- ❌ **不做 agent 的在线试用 / Playground** —— 沙箱与成本问题。
- ❌ **不做 UGC 评分与评论区** —— 首版无社区运营能力，评分容易被操纵。
- ❌ **不做闭源产品的"客观下载量排名"** —— 数据不可得，改为"收录 + 弱排名 + 编辑观点"（见 §5.4）。
- ❌ **不做付费上榜 / 竞价排名** —— 明确写入产品原则，永久不做。
- ❌ **不做安全评测 / 渗透测试 / 安全认证** —— 安全模块只聚合公开公告并附原文链接，**不背书、不评级**。
- ❌ **不做原创新闻报道** —— 新闻只做聚合与编辑精选，不生产内容，避免版权与人力黑洞。

---

## 3. 用户与场景

| 用户角色 | 核心场景 | 关键诉求 |
|---|---|---|
| **A. 选型中的开发者**（主） | "我要做 X，该用哪个 agent？" | 按形态/语言/场景过滤，看活跃度与生态，能一键跳到官网 |
| **B. 趋势观察者**（次） | "这个月谁在涨？" | 增速榜、30 日趋势图、新上榜提醒 |
| **C. 项目作者** | "我的项目在榜上吗？数据对吗？" | 认领/纠错入口，指标透明 |
| **D. 内容创作者 / 媒体** | "引用一份数据做报道" | 榜单可截图、可引用、有固定 URL、有引用格式 |

**关键用户旅程（A 角色，主路径）**

1. 落地页 → 看到"开源榜 / 闭源榜"双入口与形态筛选 tab
2. 选定形态（如 `CLI 编码 agent`）→ 表格按综合分排序，行内显示 star、增速、安装量、活跃度
3. 点击行 → 详情页：指标趋势图 + 分发渠道 + License + 最近发版 + 外链
4. 决策完成 → 点"官网 / 文档 / GitHub"跳出

---

## 4. 范围定义（Scope）

### 4.1 收录对象定义

一个条目被收录，必须同时满足：

1. **是"用户可直接使用的 agent 产品/工具"** —— 能够接收用户指令、自主调用工具、完成任务闭环。
2. **有公开可验证的落地页**（官网 / GitHub repo / 应用商店页面）。
3. **满足形态归类**（见 §4.2），且归入恰好一个主形态。

**排除项**

- 纯 Prompt 模板、纯 MCP Server、纯 SDK 库（无终端产品形态）
- 已被作者归档（archived）超过 12 个月的项目 → 标记 `deprecated`，移出主榜，保留详情页
- 已合并进其他项目 → 标记 `merged_into`，跳转
- 套壳 / 明显刷量的假项目（见 §6.6）

### 4.2 形态分类（Form）—— 分组是排名的前提

> **原则：只在同一形态内比较排名。跨形态不提供总榜。**

| form key | 名称 | 说明 | 典型 |
|---|---|---|---|
| `cli` | 终端 / CLI 编码 agent | 在终端里跑的编码助手 | Claude Code、Codex CLI、Gemini CLI、OpenCode、Pi、Aider |
| `ide-plugin` | IDE 插件 | 寄生在 VS Code / JetBrains 等 | Cline、Roo Code、Continue |
| `ide-app` | IDE / 编辑器一体化产品 | 自带编辑器的完整产品 | Cursor、Windsurf、Trae、Zed(agent 部分) |
| `desktop` | 桌面 agent 应用 | 独立 GUI 客户端 | 各类 Computer-use 客户端 |
| `browser` | 浏览器 agent | 浏览器内/扩展形态 | Comet、Dia、各类扩展 |
| `framework` | 多智能体 / agent 框架 | 面向开发者的 SDK，非终端用户产品 | CrewAI、LangGraph、AutoGen、Agno |
| `autonomous` | 通用自主 agent | 任务托管型产品 | Manus 类 |

**注意**：`framework` 与终端产品不可同榜比较（框架的 star 高是因为它是依赖库，不代表用户使用量）。framework 榜单独成页，指标口径改为「贡献者 + 下游依赖数 + 发版频率」。

### 4.3 开源 / 闭源判定（`oss_bucket`）

> **关键规则：按 License / 源码可见性判定，绝不按分发渠道判定。**
> 反例：Claude Code 走 npm 分发，但闭源；Aider 走 PyPI，但开源。

判定流程图（人工复核，可脚本辅助）：

```
源码是否公开可获取？
├─ 否 → 闭源（closed）
└─ 是 → License 是否为 OSI 认可的开源协议？
        ├─ 是 → 开源（open）
        ├─ 否（如 BUSL / SSPL / "source-available"）→ 半开源（semi，单列标记，归入闭源榜并打标）
        └─ 无 License 文件 → 半开源（semi，同上）
```

| `oss_bucket` | 含义 | 展示位置 |
|---|---|---|
| `open` | OSI 认可协议（MIT/Apache-2.0/GPL/AGPL/MPL/BSL 等） | 开源榜 |
| `semi` | 源码可见但非 OSI（BUSL/SSPL/自定义、或无 License） | 开源榜内打「半开源」标签，默认降权 / 可过滤 |
| `closed` | 源码不可获取 / 专有 EULA | 闭源榜 |

### 4.4 收录门槛（防止榜单被长尾噪声淹没）

**开源**，满足任一 + 活跃即可：

- GitHub star ≥ 500，或
- 主分发渠道周下载量 ≥ 3,000（npm weekly / PyPI 30d），或
- 人工白名单（生态里程碑项目，如首个 X 类产品）

**活跃**（必要条件）：近 180 天内有过 release 或 commit。

**闭源**：

- 有公开产品页 且 有公开可查的安装指标（VS Code install / 扩展商店用户数 / 商店评分数），或
- 商业产品且被主流媒体/社区广泛采用 → 进「收录区」，不排名（见 §5.7）

### 4.5 一个 Agent ↔ 多个分发渠道

一个 agent 是**实体**，可以有多个 `source`（GitHub repo、npm 包、PyPI 包、Homebrew formula、VS Code 扩展、商店页面）。**所有指标按 agent 聚合，不按包聚合。**

例外：一个 npm 包同时被多个 agent 共用 → 下载量不做拆分，按"共享渠道"标注，不计入两者主指标（避免重复计数），仅在详情页展示。

---

## 5. 榜单设计

### 5.1 榜单矩阵

| # | 榜单 | 范围 | 排序依据 | 优先级 |
|---|---|---|---|---|
| B1 | 开源榜 · 综合分 | `oss_bucket ∈ {open, semi}` | 综合分（§5.3） | P0 |
| B2 | 闭源榜 · 采用度 | `oss_bucket = closed` | 可得安装指标（弱排名） | P0 |
| B3 | 日榜 | 全部 | 当日绝对增量（§5.5） | P0 |
| B4 | 周榜 | 全部 | 滚动 7 日增量（§5.5） | P0 |
| B5 | 月榜 | 全部 | 综合分 + 滚动 30 日增量（§5.5） | P0 |
| B6 | 新秀榜 | 出道 ≤ 180 天 | 新秀分（§5.6） | P0 |
| B7 | 趋势榜（7d / 30d） | 全部 | 纯增速分（§5.4） | P0 |
| B8 | 单项榜：Star 榜 | 开源 | star 绝对值 | P1 |
| B9 | 单项榜：安装量榜 | 全部有数据的 | 下载量 | P1 |
| B10 | Framework 榜 | `form = framework` | 专属口径 | P1 |
| B11 | 历史归档 | 全部 | 任意日/周/月回溯 | P0 |

**默认视图**：开源榜 · **月榜** · 综合分，形态 tab 默认 `cli`（首版窄口）；周/日粒度可切换。

### 5.2 指标定义表

| 指标 key | 名称 | 来源 | 单位 | 权重（综合分） | 说明 |
|---|---|---|---|---|---|
| `stars` | Star 总量 | GitHub | 个 | 20% | 存量热度 |
| `star_growth_30d` | 30 日 Star 增速 | GitHub（快照差分） | % | 25% | **核心信号**，抗"老项目霸榜" |
| `contributors` | 贡献者数 | GitHub | 人 | 10% | 生态健康度 |
| `activity` | 活跃度分 | GitHub 计算 | 0–1 | 15% | 近 90 天 commit 周数 × 发版次数复合（见下） |
| `installs` | 安装量 | npm / PyPI / 商店 | 次/周或月 | 20% | 生态归一化后比较；无数据则该项缺失并重新分配权重 |
| `ecosystem` | 生态规模 | Discord/Reddit/X 关注数 | 人 | 5% | P1 才采，暂无则 0 并重分配 |
| `forks` | Fork 数 | GitHub | 个 | 5% | **低权重**，噪声大（备份/提 PR/改配置） |
| — | Issues 中位响应时长 | GitHub | 小时 | 0%（仅展示） | 展示为"响应速度"标签，不入分 |
| — | License | 人工 + repo | — | 0%（仅展示） | 用于 §4.3 判定 |

`activity` 计算公式：

```
activity = 0.6 * min(1, commit_weeks_90d / 9) + 0.4 * min(1, releases_90d / 6)
```

### 5.3 综合分算法（Score）

**问题**：star 从 800 到 200,000，线性加权会让头部垄断；不同生态的下载量量级差 100 倍。

**方案：分组内 log 归一化 + 分位数排名 + 加权求和，权重缺失时按比例重分配。**

```
step 1  取原始值 x_i
step 2  log 压缩：v_i = log10(1 + x_i)
step 3  组内归一化：n_i = percentile_rank(v_i) ∈ [0,1]   // 组 = 同一 form
step 4  缺失处理：若某指标缺失，该权重按比例分给其余指标
step 5  score = 100 * Σ (w_i * n_i)
```

设计取舍说明：

- **为什么用分位数而非 min-max**：分位数对极端值不敏感，新增一个超级项目不会压低所有人分数。
- **为什么按 form 分组归一**：`framework` 的 star 分布与 `cli` 完全不同，跨组归一不可比。
- **必须记录 `score_version`**：算法调整会让历史分数不可比，快照表要存版本号，前端只展示同版本内的趋势。

**展示原则**：默认展示综合分，但**每个原始指标都必须可点击切换排序**，并明确标注"综合分是 AgentNews 观点，非客观事实"。

### 5.4 趋势榜算法

```
growth_pct = (S_t - S_{t-30}) / max(S_{t-30}, FLOOR)
FLOOR = 200   // 防止从 5 star 涨到 50 就 900% 的抖动
```

- 7d 榜：用日快照对齐，`FLOOR = 50`
- 排除：30 天内 star < FLOOR 的项目不参与趋势榜（避免噪声）
- 排除：单日增幅 > 5% 且无 release/媒体报道佐证的 → 标记 `suspicious`，不参与趋势榜（见 §6.6）

### 5.5 结算周期与归档（日榜 / 周榜 / 月榜）

**结论先行：计算用「滚动窗口」，展示与归档用「自然周期」。两者是分工，不是二选一。**

**行业实际做法（参考）**

| 产品 | 采用口径 | 说明 |
|---|---|---|
| GitHub Trending | 滚动（today / this week / this month） | 页面定期刷新，本质是滚动窗口 |
| npm downloads API | 滚动 `last-day` / `last-week` / `last-month` | 官方定义即滚动 |
| PyPI / pypistats | 滚动 30 天 | 同上 |
| App Store / Google Play 榜单 | 滚动加权（近 24h / 7d） | 商店榜是热度的滚动快照 |
| 分析机构（Sensor Tower 等） | 自然月 | 面向月度报告与 MoM / YoY |
| 官方/媒体榜单（YouTube、Spotify、各类 Top 10） | 自然周 | 需要「第 42 周」这类人类可读标签 |

**为什么实时榜几乎都用滚动窗口 —— 自然周期累计有三个硬伤：**

1. **分母不一致**：1 号的「本月累计」与 31 号的差 30 倍。月中直接排名 = 让先发生的项目占便宜。
2. **重置断崖**：每月 1 号、每周一所有人增量归零 → 榜单剧烈跳变，用户今天和昨天看到的完全不同且无法解释。
3. **周期不等长**：2 月 28 天 vs 1 月 31 天；自然周跨年还有 W52/W53 编号问题。

**最终规则（双轨制）**

| 榜单 | 计算窗口（排名用） | 展示标签 | 归档口径 |
|---|---|---|---|
| 日榜 | 自然日增量 `Δ1d = S_t − S_{t−1}` | 「今日」 | 日档（每日快照） |
| 周榜 | **滚动 7 日** `Δ7d = S_t − S_{t−7}` | 「近 7 天」；归档补「10.13–10.19」 | 周档（每周日冻结，`2025-W42`） |
| 月榜 | **滚动 30 日** `Δ30d = S_t − S_{t−30}` | 「近 30 天」；归档补「2025-09」 | 月档（每月末冻结，`2025-09`） |

**自然周期只用于「归档 / 已结算」**——支撑月报、媒体引用、MoM / YoY。实时榜**永不**使用自然周期累计。

**产品纪律**：页面上不得出现「本月榜（截至今天）」这类把 15 天累计与 30 天累计混排的东西。要么显示滚动 30 日，要么显示「本月至今」并标注 MTD、且不做跨月比较。

**MVP 简化**：首版只实现「滚动 7d / 30d」一种增量算法，自然周/自然月**仅做归档标签**（取该周期最后一个结算日的滚动值冻结），不另写一套自然周期算法。

**结算 = 归档**：每个结算日生成的快照永久保留，形成三条时间线（日档 / 周档 / 月档），任意历史日期可回溯（F-11 历史归档）。归档时区统一用 **UTC**，周起点按 ISO 8601（周一），月起点为自然月 1 日。

**数据源对周期粒度的支撑**

| 数据源 | 日粒度 | 周粒度 | 月粒度 |
|---|---|---|---|
| GitHub | ✅ 日更 | ✅ | ✅ |
| npm / PyPI / crates | ✅ 日更 | ✅ | ✅ |
| VS Code / Chrome 商店 | ⚠️ 周更，日榜该指标取上周缓存值 | ✅ | ✅ |
| Discord / Reddit 生态 | ❌ 仅周更 | ✅ | ✅ |

**结论：开源榜三档齐全；闭源榜只保证周/月粒度，日榜的闭源部分标注「商店数据周更，日榜为缓存值」。**

**增量榜用绝对增量，综合分用相对增速**：日/周榜的增量项取**绝对增量**（谁真正在获得用户），综合分里的增速项取**相对增速 %**（谁势头更好，沿用 §5.4 的 FLOOR 机制）。两套指标回答两个不同问题——「谁在变大」与「谁在变快」，不得混用。

**与其他榜的关系**：趋势榜（B7 / §5.4）是纯相对增速维度，回答「谁在变快」；日/周/月榜是主榜的周期结算，回答「谁在变大 + 当前排名」；新秀榜（B6）是加了「出道资格」的趋势榜，见 §5.6。

### 5.6 新秀榜（Newcomer）

定位：**不是「涨得最快的榜」（那是趋势榜），而是「出道不久但势头最猛的新 agent」。**

| 规则项 | 定义（待确认） |
|---|---|
| 新秀资格 | repo 首次创建 ≤ 180 天，**或** AgentNews 首次收录 ≤ 90 天（双条件取宽口径） |
| 排名指标 | 新秀分 = 增速（30d）60% + 综合分 40%（仍按 form 分组归一） |
| 展示 | 「出道 N 天」徽章 + 「本周新入榜」徽章 |
| 淘汰 | 出道满 180 天自动移出新秀榜，保留主榜 |
| **防刷** | 新秀榜是刷榜重灾区 —— §9.1 反作弊规则对趋势/新秀榜**强制生效**，`suspicious` 条目直接剔除 |

**与趋势榜的区别**：趋势榜 = 全体 agent 按增速排；新秀榜 = 只有新 agent 有资格。生态早期两者高度重合（说明增长靠新项目驱动），随时间自然分化。

### 5.7 闭源榜的降级方案（重要，需产品拍板）

闭源产品的下载量数据基本不可得，因此闭源榜按以下三级降级：

| 等级 | 条件 | 呈现 |
|---|---|---|
| L1 有数据 | 有公开安装量（VS Code install / 扩展商店 users / 商店评分+评分数） | 可排名，标注数据源与口径 |
| L2 半数据 | 只有商店**排名**或**评分数** | 排"采用度区间"（Top 10 / 10–50 / 未知），不排具体名次 |
| L3 无数据 | 仅官网存在 | 进「收录区」，按字母序 / 编辑推荐展示，**不给名次**，加「数据未公开」徽章 |

**产品纪律**：L3 条目**绝不能**被排成名次，否则会被用户视为虚假数据。前端必须显式显示数据缺失原因。

---

## 6. 数据源与采集

### 6.1 数据源清单

| 数据源 | 指标 | 可获取性 | 频率 | 鉴权 | 风险 |
|---|---|---|---|---|---|
| GitHub REST v3 | stars/forks/issues/releases | ✅ 好 | 日 | Token（5000/h） | 限流；建议 GraphQL 批量 |
| GitHub GraphQL | 同上（批量 100 repo/次） | ✅ 好 | 日 | Token（5000 pt/h） | 点数消耗需估算 |
| GitHub repo 内容 | LICENSE、commit 活动 | ✅ 好 | 周 | 同上 | — |
| npm registry | `api.npmjs.org/downloads/point/{period}/{pkg}` | ✅ 好 | 日 | 无 | 无官方 SLA |
| PyPI | pypistats.org / BigQuery | ⚠️ 中 | 周 | 无 / GCP | 第三方可靠性 |
| crates.io | 下载量 API | ✅ 好 | 周 | 无 | — |
| Homebrew | formula analytics | ✅ 中 | 周 | 无 | 只有 30/90/365d |
| VS Code Marketplace | install 数 | ⚠️ 中 | 周 | 非官方 API | ToS 风险，需限速+缓存 |
| Chrome Web Store | users 数 | ⚠️ 差 | 周 | 页面解析 | ToS 风险 |
| App Store / Google Play | 下载量 | ❌ 无 | — | — | 不公开下载量；仅评分数/排名 |
| Discord / Reddit | 成员数 | ⚠️ 中 | 周 | 部分需 OAuth | 严格限速，P1 再做 |
| GitHub Releases / 包版本 API | 发版事件（活动模块） | ✅ 好 | 日 | Token | — |
| OSV.dev / GitHub Security Advisory | 依赖漏洞、安全事件（安全模块） | ✅ 好 | 日 | 无 / GitHub 需 Token | 需映射依赖树，覆盖取决于生态 |
| npm advisories / 恶意包公告 | 供应链事件 | ⚠️ 中 | 日 | 无 | 覆盖不全 |
| HN / Reddit / Lobsters RSS | 行业新闻（新闻模块） | ✅ 好 | 小时 | 无 | 噪声大，需阈值过滤 + 去重 |
| 官方 blog / changelog RSS | 产品公告 | ⚠️ 中 | 日 | 无 | 源不统一，需逐个维护 |
| 人工维护 | License、form、oss_bucket、别名 | ✅ | 按需 | — | 这是榜单质量的**生命线** |

### 6.2 采集架构（建议）

```
agents.yaml (人工维护源)  ──┐
                            ├──> collector (定时任务, 每日)
sources 表 (渠道映射)     ──┘         │
                                      ▼
                              metric_raw (EAV 原始值)
                                      │
                                      ▼
                              scorer (按 form 归一 + 加权)
                                      │
                                      ▼
                           score_daily (排名结果快照)
                                      │
                                      ▼
                     Web 前端 / JSON API / 静态快照导出
```

技术选型建议：**Node/TS + SQLite（MVP）→ Postgres（扩展）**，定时任务用 `cron` / GitHub Actions。理由：单人可维护、无运维成本、数据就是几张表。

### 6.3 更新频率与归档策略

| 数据 | 频率 | 说明 |
|---|---|---|
| GitHub 指标 | 每日 1 次（UTC 02:00） | 日榜/趋势必须有日粒度 |
| 包管理器下载量 | 每日 1 次（周滚动窗口） | npm 天然按周/月聚合 |
| 商店指标 | 每周 1 次 | 降低 ToS 风险 |
| 内容源（Releases/OSV/HN） | 每日 1 次 | 活动与安全模块依赖 |
| License / form / bucket | 变更时人工确认 | 新增条目必过人工 |

**归档策略（结算 = 归档，永久保留）**

| 周期 | 结算时刻 | 归档内容 | 用途 |
|---|---|---|---|
| 日 | 每日采集完成后 | 当日评分快照 + 当日增量（日档） | 日榜、趋势计算、增量追踪 |
| 周 | 每周日采集完成后 | 当周结算快照 + 7d 增量（周档） | 周榜、周间对比 |
| 月 | 每月最后一日采集完成后 | 当月结算快照 + 30d 增量（月档） | 月榜、月度报告、媒体引用 |

**数据量估算**：500 agents × 365 天 ≈ 18 万行/年，SQLite 毫秒级读写，无需分库；月档单独导出 CSV 供下载。

### 6.4 合规与法务（硬约束）

1. 严格遵守各站 robots.txt 与 ToS；**对商店页面只做低频抓取 + 本地缓存**，不做高频轮询。
2. 所有数据标注来源与采集时间，页面底部提供数据快照下载与算法说明。
3. 不存储用户个人数据（首版无账号体系）。
4. 商标与 Logo：只使用文字名称与指向官网的链接；**不缓存/展示第三方 Logo**，避免版权问题（P2 如需展示，仅使用官方 media kit 授权素材）。
5. GitHub 数据遵守其 API Terms：需缓存、需注明来源。

---

## 7. 功能需求

### 7.1 P0（MVP，必须有）

| ID | 功能 | 用户故事 | 验收标准 |
|---|---|---|---|
| F-01 | 双榜入口 | 作为开发者，我能一眼看到"开源榜"和"闭源榜" | 首页首屏两个 tab，URL 直接可分享（`/open`、`/closed`） |
| F-02 | 形态筛选 | 我能按形态缩小范围 | 形态 tab 切换后表格与排序重算，URL 同步 query（`?form=cli`） |
| F-03 | 榜单表格 | 我能对比多个 agent | 列：排名、名称、形态、License 标记、综合分、star、30d 增速、安装量、活跃度、最近发版；支持列排序 |
| F-04 | 详情页 | 我能看单个 agent 的全貌 | 指标趋势图（90d）、分发渠道列表、License、贡献者、官网/GitHub/文档外链、"数据更新于" |
| F-05 | 趋势榜 | 我能看谁在涨 | 7d/30d 切换，显示增速 %、基准值、排除可疑条目 |
| F-06 | 搜索 | 我能直接找某个 agent | 支持名称与别名模糊搜索，含未上榜条目 |
| F-07 | 口径说明 | 我信任这个榜 | 每列有 tooltip 说明定义与来源；「关于算法」页完整披露权重与公式 |
| F-08 | 闭源三级降级展示 | 我不被虚假排名误导 | L3 条目显式显示「数据未公开」，无名次 |
| F-09 | 粒度切换（日/周/月） | 作为用户，我能在日/周/月粒度间切换主榜 | URL 同步 `granularity=day|week|month`，结算规则按 §5.5 |
| F-10 | 新秀榜 | 我能看到出道不久且势头最猛的新 agent | 出道徽章 + 防刷剔除（§5.6 / §9.1） |
| F-11 | 历史归档 | 我能回溯任意历史日/周/月的榜单 | `/archive/{period}` 可访问，与归档快照完全一致 |

### 7.2 P1（第二期）

| ID | 功能 |
|---|---|
| F-12 | 单项榜（Star / 安装量 / 活跃度）独立页面 |
| F-13 | Framework 专属榜（贡献者 + 下游依赖 + 发版频率） |
| F-14 | 榜单 JSON API + 数据快照 CSV 导出 |
| F-15 | 自动发现：GitHub topic/keyword 扫描 → 进入「待审核队列」 |
| F-16 | 增速异常检测（反刷星）与 `suspicious` 标记 |
| F-17 | 纠错/认领入口（GitHub Issue 模板或 PR，YAML 驱动） |
| F-18 | 榜单中文化 + 英文版（i18n） |
| F-24 | 详情页「维护健康」区块（最近提交 / 发版节奏 / issue 积压 / fork 比 / 组内位置，口径见 §7.6） |

### 7.3 P2（后续）

| ID | 功能 |
|---|---|
| F-19 | `agent-rank` TUI 客户端（自举式传播点） |
| F-20 | 新上榜提醒（RSS / 邮件 / Webhook） |
| F-21 | 场景化推荐（"我写 Python 后端，预算 $20/月" → 过滤条件） |
| F-22 | 榜单 embed widget / 外部站聚合 |
| F-23 | 外链评测结果（SWE-bench / 社区评测），仅展示不评分 |

### 7.4 内容模块（活动 / 安全 / 新闻）

> 这三块把产品从「排行榜」扩为「agent 情报站」。价值：榜单不需要每天看，但动态与安全需要，**回访率靠内容模块扛**。代价：内容源维护成本 + 责任风险。
> **定位纪律：只做聚合与标注，不做原创评测，不做安全背书，不做原创新闻。**
> **落地方式（关键）**：首版以「详情页增强」为主（每个 agent 页内嵌动态 + 安全标签），独立频道页（/activity、/security、/news）放 P2。避免一上来就做三个空频道。

#### 7.4.1 活动模块（Activity）

| ID | 功能 | 事件类型 | 优先级 |
|---|---|---|---|
| F-24 | Agent 动态时间线 | `release` 发版、`listed` 新收录、`rank_jump` 排名跃迁 ≥5 位、`license_change` 开源→闭源、`archived` 归档、`launch` 发布（人工） | P1 |
| F-25 | 事件订阅（RSS / Webhook） | 按 agent、form、事件类型订阅 | P2 |

- 列表按时间倒序，可按 agent / form / 类型过滤；每条事件必附**证据外链**
- **不收录**：普通 commit、issue/PR 活动（噪声过大）
- 事件流同时是「新秀榜 / 趋势榜」的佐证数据（判断 star 暴涨是否有对应的 release / 发布会）

#### 7.4.2 安全模块（Security）

| ID | 功能 | 标签 / 数据源 | 优先级 |
|---|---|---|---|
| F-26 | 安全标签聚合 | 依赖漏洞（OSV/GHSA）、安全事件历史、License 风险、维护风险 | P1 |
| F-27 | 安全事件时间线 | `/security`：全站安全事件，关联到 agent 详情页 | P2 |

| 标签 | 判定 | 展示 |
|---|---|---|
| 依赖漏洞 | 未修复漏洞 ≥1 → 黄；含 critical → 红 | 「N 个未修复漏洞」+ OSV 链接 |
| 安全事件 | 近 24 个月有 GHSA/CVE/告警 | 「历史安全事件 N 起」+ 公告链接 |
| License 风险 | `semi` / 无 License | 「商用需确认 License」 |
| 维护风险 | archived / 90 天无提交 | 「低活跃 / 已归档」 |

**三条铁律**：① 全部标注来源与采集时间；② **不给安全分、不给红黄绿总评级**；③ 提供「发现错误」入口，错误标签 24h 内人工复核。

#### 7.4.3 新闻模块（News）

| ID | 功能 | 实现 | 优先级 |
|---|---|---|---|
| F-28 | 新闻聚合 | HN / Reddit / Lobsters / 官方 blog RSS，按 agent 关键词 + 热度阈值过滤 + URL/标题去重 | P2 |
| F-29 | 编辑精选 Weekly Digest | 每周一篇：榜单变化 + 重要事件 + 新秀 | P2 |

- **只存标题 + 摘要（≤200 字）+ 外链**，不全文转载（版权红线）
- 遵守各源 robots.txt 与 RSS 使用条款；不绕过付费墙
- 去重：URL 规范化（去 utm / 短链还原）+ 标题相似度

### 7.5 页面信息架构

```
/                       落地页（双榜概览 + 新秀榜 Top5 + 今日 3 条动态）
/top                    主榜（tab：开源/闭源 × 日/周/月 × 形态，URL 全同步）
/rising                 新秀榜（出道 ≤ 180 天）
/archive/{period}       历史归档（任意日/周/月回溯）
/agent/{slug}           详情页（指标趋势 + 维护健康 + 渠道 + 安全标签 + 动态）
/activity               活动时间线（发版/收录/跃迁/归档）
/security               安全情报（漏洞 / 供应链 / License 风险）
/news                   行业新闻（RSS 聚合 + 编辑精选）
/about                  方法与口径（算法、权重、数据源、免责）
/changelog              榜单变更记录（条目增删、算法版本）
/embed                  可嵌入的榜单 widget（P2）
```

### 7.6 详情页「维护健康」区块（F-24，口径）

放在 `/agent/{slug}`，回答「这个项目还在被认真维护吗」。**只做事实呈现，不进综合分。**

| 指标 | 计算 | 展示 |
|---|---|---|
| 最近提交 | 快照日 − `last_commit` | 「N 小时前 / N 天前」 |
| 最近发版 | 快照日 − `last_release` | 同上；另附发版节奏（版本发布时间的中位间隔） |
| Open issues | `open_issues` | 绝对值 + 每千 star 积压数（star < 1000 不给，分母不可信） |
| Fork / Star | `forks / stars` | 百分比 |
| 组内位置 | 同 form 内秩中点分位（§5.3 口径） | 条形图，中点 = 组内中位 |

**三条纪律：**

1. **`now` 取快照日期，不取构建时刻** —— 同一份数据每次渲染的说法必须一致。
2. **缺数据 = 「—」，不画条、不补 0**。条形的长短天然被读成「强/弱」，把「未知」画成「短」就是伪造评价（§5.7）。
3. **不跨形态比较**：组内位置的分母恒为同 form 对象数，页头写明 n；跨形态的分位是假的可比性（§4.2）。

另外，指标明细表的下载量列补 `t-1 / t-7 / t-30` 增量 —— star 涨不代表在用，下载涨才是采用拐点。

---

## 8. 数据模型（MVP 草案）

```sql
-- 实体：一个 agent（人工维护 + 自动补全）
CREATE TABLE agent (
  id            TEXT PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  vendor        TEXT,
  form          TEXT NOT NULL,             -- cli | ide-plugin | ide-app | desktop | browser | framework | autonomous
  oss_bucket    TEXT NOT NULL,             -- open | semi | closed
  license_id    TEXT,
  homepage      TEXT,
  repo_url      TEXT,
  one_liner     TEXT,
  status        TEXT DEFAULT 'active',     -- active | deprecated | merged_into
  merged_into   TEXT,
  first_listed  DATE,
  curated_note  TEXT,                      -- 人工备注，公开展示
  created_at    TIMESTAMP,
  updated_at    TIMESTAMP
);

-- 渠道：一个 agent 可有多个分发源
CREATE TABLE source (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agent(id),
  kind        TEXT NOT NULL,               -- github | npm | pypi | crates | brew | vscode | chrome | appstore | releases | manual
  identifier  TEXT NOT NULL,               -- repo full_name / 包名 / 扩展 id
  url         TEXT,
  is_primary  INTEGER DEFAULT 0,
  verified    INTEGER DEFAULT 0
);

-- 原始指标（EAV，便于新增任意指标而不改表）
CREATE TABLE metric_raw (
  source_id   TEXT NOT NULL REFERENCES source(id),
  key         TEXT NOT NULL,               -- stars | forks | contributors | npm_weekly_dl | vscode_installs | ...
  captured_on DATE NOT NULL,
  value       REAL NOT NULL,
  PRIMARY KEY (source_id, key, captured_on)
);

-- 每日评分快照（趋势与历史榜的唯一来源）
CREATE TABLE score_daily (
  agent_id       TEXT NOT NULL REFERENCES agent(id),
  captured_on    DATE NOT NULL,
  form           TEXT NOT NULL,
  score          REAL,
  score_version  TEXT NOT NULL,            -- 算法版本，例 'v1'
  rank_in_form   INTEGER,
  trend_7d       REAL,
  trend_30d      REAL,
  data_level     TEXT,                     -- L1 | L2 | L3（闭源降级等级）
  flags          TEXT,                     -- suspicious / partial_data / shared_channel ...
  PRIMARY KEY (agent_id, captured_on, score_version)
);

-- 周期性榜单快照（日/周/月三条归档时间线）
-- 注：MVP 阶段建议直接只建本表（period_type='day' 即日档），不单独建 score_daily
CREATE TABLE score_periodic (
  agent_id      TEXT NOT NULL REFERENCES agent(id),
  period_type   TEXT NOT NULL,             -- day | week | month
  period_end    DATE NOT NULL,             -- 结算日：日=当日，周=周日，月=月末
  form          TEXT NOT NULL,
  score         REAL,
  score_version TEXT NOT NULL,
  growth_7d     REAL,
  growth_30d    REAL,
  rank_in_form  INTEGER,
  data_level    TEXT,                     -- L1 | L2 | L3（闭源降级等级）
  flags         TEXT,                     -- suspicious / partial_data / shared_channel ...
  PRIMARY KEY (agent_id, period_type, period_end, score_version)
);

-- 事件流（活动模块与安全模块的统一数据源）
CREATE TABLE event (
  id          INTEGER PRIMARY KEY,
  agent_id    TEXT REFERENCES agent(id),   -- 可为空（行业级事件）
  kind        TEXT NOT NULL,               -- release | listed | rank_jump | license_change | archived | security | news | launch
  occurred_on DATE NOT NULL,
  title       TEXT NOT NULL,
  detail      TEXT,
  source_url  TEXT,
  severity    TEXT,                        -- 安全事件：low | medium | high | critical
  verified    INTEGER DEFAULT 0,           -- 人工核实
  created_at  TIMESTAMP
);

-- 新闻条目（只存标题 + 摘要 + 外链，不存正文）
CREATE TABLE news_item (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  summary    TEXT,
  source     TEXT NOT NULL,
  url        TEXT NOT NULL UNIQUE,
  published  DATE,
  lang       TEXT,
  picked     INTEGER DEFAULT 0             -- 编辑精选
);
```

**人工维护文件 `agents.yaml`**（作为数据源，纳入版本控制，可被社区 PR）：

```yaml
- slug: claude-code
  name: Claude Code
  vendor: Anthropic
  form: cli
  oss_bucket: closed
  license_id: proprietary
  homepage: https://...
  sources:
    - { kind: npm, identifier: "@anthropic-ai/claude-code" }
  note: "闭源，但通过 npm 分发"
```

---

## 9. 非功能需求

| 类别 | 要求 |
|---|---|
| 性能 | 首屏 LCP < 1.5s；榜单页静态生成 + 每日重建，不做实时查询 |
| 可用性 | 采集失败时保留上一次快照，前端显示「数据可能延迟」，绝不展示空白榜 |
| 数据可复现 | 每次评分对应一个快照版本，可下载 CSV/JSON；算法改动记入 changelog |
| 可维护性 | 新增一个 agent = 改 YAML + 跑脚本，无需改代码 |
| 成本 | 全静态托管（Vercel/CF Pages）+ GitHub Actions 采集，月成本目标 < $10 |
| 合规 | 见 §6.4；页面必须有数据来源与免责声明 |
| 内容合规 | 新闻只存标题+摘要+外链，不全文转载；安全标签必标来源与采集时间；**不提供安全评级与认证措辞** |
| 反作弊 | 见下 |

### 9.1 反作弊规则（P1）

1. **增速异常**：单日 star 涨幅 > 5% 且当日无 release / HN 首页 / 官方发布 → 打 `suspicious`，趋势榜剔除，主榜仍保留但在详情页提示。
2. **star/fork 比异常**：fork 数 > star 数 × 0.5 且无合理原因（如模板仓库）→ 人工复核。
3. **下载量污染**：npm 下载量 / star 比值显著高于同形态中位数（> 10×）→ 标注「含 CI/依赖安装，非用户数」。
4. **时间戳异常**：连续多日同一时刻突增 → 人工复核。

---

## 10. 里程碑

| 阶段 | 内容 | 产出 | 预估 |
|---|---|---|---|
| **M0 数据摸底**（先行） | 手工整理 40 个 agent 的 YAML；跑通 GitHub + npm 采集；验证 30d 增速是否可用 | 数据可行性报告 + `agents.yaml` v1 | 3–5 天 |
| **M1 打分引擎** | 归一化 + 加权 + 快照落库；跑出第一版榜单（先出表格，不出前端） | 首版榜单（Markdown/CSV）+ 人工 sanity check | 3–5 天 |
| **M2 前端 MVP** | 双榜 + 形态筛选 + 详情页 + 口径页；静态部署 | 可访问站点 | 1–1.5 周 |
| **M3 闭环** | 每日定时采集、日/周/月结算归档、趋势榜 + 新秀榜上线 | 自动更新的站点 | 3–5 天 |
| **M4 公信力** | 算法页、changelog、数据导出、纠错入口 | 可被引用的公开资产 | 1 周 |
| **M5 情报模块** | 活动事件流 + 详情页安全标签（先不做独立频道） | 详情页增强 | 1 周 |
| **M6 频道化**（可选） | /activity /security /news 独立页 + RSS 订阅 + Weekly Digest | 情报站形态 | 1–2 周 |

**关键决策点**：M0 结束时若发现「30 日增速」因快照历史不足无法计算（首次运行无历史数据），趋势榜必须回填 GitHub stargazer 时间戳（API 可分页拉 star 时间，大项目需数千次请求，成本高）→ **决策：首版趋势榜延后到 M3，M1/M2 只做存量榜。**

**追加决策（归档体系上线后）**：日/周/月归档使历史时间线**随时间自然积累** —— 上线满 30 天后，30d 增速、趋势榜、新秀榜全部可用。上线初期（< 30 天）增速列与日榜显示「数据积累中」，不做 stargazer 回填（除非有首发宣传需求，再评估回填成本）。

---

## 11. 风险登记册

| # | 风险 | 影响 | 对策 |
|---|---|---|---|
| R1 | "agent" 范围过大，榜单失去可比性 | 高 | §4.2 强制形态分组，跨形态不给总榜 |
| R2 | 闭源数据不可得，用户认为榜在编造 | 高 | §5.7 三级降级 + 显式数据缺失徽章，宁可不排名 |
| R3 | 权重主观，被作者/粉丝质疑 | 中 | 公开算法 + 可切换原始指标 + 明确"综合分是观点" |
| R4 | npm 下载量不等于用户数 | 中 | 标注口径，异常比值提示，不把下载量当唯一指标 |
| R5 | 应用商店抓取触发 ToS 问题 | 中 | 低频 + 缓存；必要时改为人工录入 L2 |
| R6 | 新项目明星效应导致榜单月度大幅波动 | 低 | 分位数归一 + 增速与存量双榜分离 |
| R7 | 单人维护，条目人工审核成为瓶颈 | 中 | YAML + PR 模板 + 自动发现进审核队列 |
| R8 | 榜单被刷（作者买 star 进榜） | 中 | §9.1 + 趋势榜剔除 + changelog 记录剔除动作 |
| R9 | 内容模块使产品从榜单膨胀为门户，单人运营跟不上 | 中 | 首版只做「详情页增强」，频道页放 P2；新闻纯 RSS 自动聚合 + 规则过滤 |
| R10 | 安全标签误报 → 被厂商/作者视为抹黑 | 高 | 只引用官方公告并附原文链接；**不做总评级**；24h 纠错通道；标注「数据可能滞后」 |
| R11 | 新闻版权风险 | 中 | 只存标题/摘要/外链；遵守 robots.txt 与 RSS 条款；不绕过付费墙 |
| R12 | 活动流噪声过大，用户不订阅 | 低 | 只收录 release / 收录 / 跃迁 / License 变更 / 归档等 6 类高价值事件 |

---

## 12. 待确认项（需产品方拍板）

| # | 问题 | 我的建议 |
|---|---|---|
| Q1 | 首版形态范围：只做 `cli`，还是 `cli + ide-plugin + ide-app`？ | 建议 `cli` 为主榜、`ide-*` 同步收录但标注「数据口径弱」，framework 单列 |
| Q2 | 是否引入 `semi`（半开源）这一档？ | 建议引入，否则 BUSL 项目无处安放 |
| Q3 | 综合分权重是否公开？公开到什么程度（列权重 还是 只公开公式）？ | 建议完整公开权重 + 提供"自定义权重"P2 功能 |
| Q4 | 闭源榜是否接受"编辑推荐位"（非付费，纯编辑判断）？ | 建议接受，但必须标注「编辑推荐，非排名」 |
| Q5 | 产品形态：纯 Web 站，还是要同时做 TUI 客户端？ | 建议 M2 先 Web，TUI 放 P2 作为传播彩蛋 |
| Q6 | 是否做中英双语？ | 建议英文优先（目标受众是国际开源社区，榜单传播靠 X/HN） |
| Q7 | 是否接受"首版不显示闭源榜排名，只做收录区"？ | 建议接受，比给假排名更安全 |
| Q8 | 榜单收录是否需要"厂商认领"机制？ | 建议 P1 做，避免厂商自报数据污染 |
| Q9 | 新秀资格口径：repo 创建 ≤ 180 天，还是首次收录 ≤ 90 天？ | 建议双条件取宽口径（§5.6） |
| Q10 | 日/周/月三榜的差异：同一算法不同结算周期（我建议），还是日榜更重增量权重？ | 建议同一算法，降低维护成本 |
| Q11 | 归档数据是否对外开放下载（CSV / JSON API）？ | 建议 P1 开放月档，日档仅网页可查 |
| Q12 | 闭源榜只到周/月粒度（商店数据周更）是否可接受？ | 建议接受，日榜闭源部分显示「周更缓存值」 |
| Q13 | 内容模块的形态：是「榜单/详情页增强」，还是「独立频道」一级入口？ | 建议首版只做详情页增强，频道页 P2 |
| Q14 | 安全模块是否要给「红/黄/绿」总评级？ | 建议不给（法律责任 + 误报成本），只给标签与原文公告 |
| Q15 | 新闻采用「纯 RSS 自动聚合 + 关键词阈值」（不人工审核）可接受吗？ | 建议自动聚合为主，人工只做 Weekly 精选 |
| Q16 | 活动流是否收录「行业事件」（融资/政策/大厂发布）？ | 建议首版只做 agent 自身动态，行业事件归入新闻模块 |

---

## 13. 附录：首版候选名单（M0 待补全指标）

> 仅列名称与归类，**不含任何未经验证的数字**。指标由 M0 采集脚本填充。

**开源 · cli**
Aider、OpenCode、Pi、Goose、OpenHands、Codex CLI、Gemini CLI、Qwen Code、Crush、Cline(CLI 模式)、Kimi CLI

**开源 · ide-plugin**
Cline、Roo Code、Continue、Kilo Code、Zed 的 agent 扩展

**开源 · framework**
CrewAI、LangGraph、AutoGen、Agno、Pydantic AI、OpenAI Agents SDK、Semantic Kernel、Mastra、Vercel AI SDK

**开源 · browser / autonomous**
Browser-use、Stagehand、Open Interpreter、AutoGPT

**闭源 · cli**
Claude Code、Cursor CLI（如有）、Warp Agent Mode

**闭源 · ide-app**
Cursor、Windsurf、Trae、Kiro

**闭源 · browser / desktop / autonomous**
Comet、Dia、Manus、Devin、Claude Desktop、ChatGPT Desktop（agent 模式）

> 待 M0 校准：名单需人工确认每个条目「是否仍在活跃维护」「是否满足 §4.1 收录定义」。预计首版收录 40–60 个。

---

## 14. 产品原则（写在最前面，用于约束后续所有决策）

1. **可比的才排名，不可比的就标注。** 宁可少一个名次，不可多一个假名次。
2. **榜单不可购买。** 无付费上榜、无竞价排名、无"赞助位影响排序"。
3. **口径公开、数据可下载、算法可复现。**
4. **单一指标永远可切换。** 综合分是观点，不是事实。
5. **人工审核优先于自动抓取。** 名单质量 > 覆盖数量。
6. **不背书。** 安全模块只引用官方公告，不给安全评级；不做原创新闻。

---

## 15. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1 | — | 初稿：双榜（开源/闭源）、形态分组、综合分算法、三级降级、数据模型 |
| v0.2 | — | ① 新增日榜/周榜/月榜（按结算周期定义）② 新增新秀榜（出道 ≤180 天）③ 新增「结算 = 归档」三条时间线（日档/周档/月档）+ `score_periodic` 表 ④ 新增内容模块：活动（事件流）/ 安全（标签聚合）/ 新闻（RSS 聚合）⑤ IA 新增 /top /rising /archive /activity /security /news |
| v0.3 | — | 周期口径定稿：**计算用滚动窗口（7d/30d），归档用自然周期**；日/周/月榜改为「绝对增量」语义；归档时区 UTC、周起点 ISO 8601 |