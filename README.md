# AgentNews

AI Agent 排行榜 —— 开源 / 闭源双榜，日 / 周 / 月粒度，跨生态归一化。

---

## 这个项目解决什么问题

开发者选 agent 时，信息散落在 GitHub、X、HN、各家文档。现有榜单各有盲区：

- GitHub Trending 只看当日增量
- star-history / ossinsight 只有 GitHub 存量
- npm trends 只看 npm 生态
- LMArena 只看模型能力，不看工具产品

AgentNews 的做法：

1. **按形态分组排名**（CLI / IDE 插件 / IDE 应用 / 框架 / 浏览器 / 自主），跨形态不比较
2. **跨生态归一化**（GitHub star + npm/PyPI 下载 + 商店安装，log 压缩 + 组内分位数）
3. **开源闭源双榜**，闭源无数据时降级为「收录区」，绝不编造名次
4. **日 / 周 / 月三条归档时间线**，git 即审计日志

---

## 产品结构（v0.4）

选型是主线，榜单是证据层 —— 先回答「在哪儿用、代价是什么」，再给数据：

| 页面 | 回答的问题 |
|---|---|
| `/forms/{form}/` 形态指南 | 这个形态适合谁、要付出什么代价、看榜该看哪几个指标 |
| `/` 选型入口 | 先按形态缩小到 3–5 个，或直接搜索 60 个 agent |
| `/compare/?a=&b=&c=` 并排对比 | 同形态内逐行比 Star / 安装量 / 活跃度 / License，自动标出每行最优 |
| `/top/{bucket}/{form}/{g}/` 榜单 | 证据层：归一化综合分与日 / 周 / 月增量，列可排序 |
| `/agent/{slug}/` 详情 | 安装命令、分发渠道、License、最近发版、安全公告、同形态替代 |
| `/rising/` `/activity/` `/security/` `/archive/` | 新秀、事件流、OSV 公告、历史归档 |

设计原则：**可比的才排名**。形态之间不比总量，跨形态对比会明确标注「仅供参数参考」。

---

## 多语言（中文 / English）

- **路由**：英文在根路径（默认，`/top/open/all/month/`），中文在 `/zh/` 前缀（`/zh/top/open/all/month/`）
- **自动判断**：首次访问 `/` 时，浏览器首选中文则跳到 `/zh/`（深链不跳，避免打断分享链接）；手动切换后记住选择（`localStorage.an-lang`）
- **旧链接**：`/en/...` 通过 `public/_redirects` 301 到根路径
- **手动切换**：顶栏 `中 / EN`，切换时保留当前路径
- **SEO**：`<html lang>` 正确、`hreflang` 三组（zh-CN / en / x-default）、canonical 指向当前语言

代码结构：

```
packages/web/src/
  i18n/dict.ts        # 全站 UI 文案（服务端 + 客户端 island 共用）
  i18n/guides.ts      # 7 种形态的指南文案（中/英）
  i18n/content.ts     # 变更记录表格数据（中/英）
  views/*.astro       # 页面视图，接受 lang prop（唯一实现）
  pages/[...path].astro # 路由分发器：枚举 zh + en 全部路径
```

加一条文案：在 `i18n/dict.ts` 的 zh / en 两个对象里加同名 key，页面用 `t(lang, 'key')`。

---

## 快速开始

```bash
pnpm install          # 安装依赖
export GITHUB_TOKEN=ghp_xxx  # 配置环境变量（见下文）
pnpm validate         # 校验 agents.yaml（不联网）
pnpm test             # 打分算法单测
pnpm collect          # 采集 + 打分 → data/
pnpm build            # 构建静态站点 → packages/web/dist
```

本地预览：

```bash
pnpm --filter @agentnews/web dev
```

### 关于 GITHUB_TOKEN（必须配置）

未认证 GitHub API 只有 **60 次/小时**，而每个 repo 需 3 次请求（repo + contributors + release）。60 个 agent 需要 180 次 —— 不配 token 会必然降级到 ungh 通道，**contributors 和 last_release 永远拿不到**，综合分里 25% 的权重（活跃度 15% + 贡献者 10%）会退化。

```bash
# 1. 在仓库根目录新建 .env

# 2. 填入 token（GitHub → Settings → Developer settings → Tokens (classic) → 勾 public_repo）
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# 3. 跑起来会自动读取（Node 24 内置 process.loadEnvFile，无需 dotenv）
pnpm collect
```

`.env` / `.env.local` 已在 `.gitignore` 中排除，不会进 git。

**优先级：系统环境变量 > `.env.local` > `.env`**（两个文件都支持，`.env.local` 用于本地覆盖）。

---

## 仓库结构

```
agents.yaml                  ⭐ 唯一人工维护入口（欢迎 PR 纠错）
data/
  snapshots/YYYY-MM-DD.jsonl 原始指标（每日）
  scores/YYYY-MM-DD.json     评分结果（每日）
packages/
  core/                      打分引擎（纯函数，无 I/O，100% 可测）
  pipeline/                  采集器（GitHub / npm / PyPI / VS Code）
  web/                       Astro 静态站
```

---

## 怎么加一个 agent

编辑 `agents.yaml`，然后跑 `pnpm validate`：

```yaml
- slug: my-agent            # 小写字母/数字/连字符，唯一
  name: My Agent
  vendor: Acme
  form: cli                 # cli | ide-plugin | ide-app | desktop | browser | framework | autonomous
  oss_bucket: open          # open | semi | closed（按 License 判定，不按分发渠道）
  license_id: MIT
  homepage: https://example.com
  sources:
    - { kind: github, identifier: acme/my-agent, is_primary: true }
    - { kind: npm, identifier: "@acme/my-agent" }
```

**校验规则**（CI 强制）：

- `slug` 唯一
- 闭源项目不得以 GitHub 为主渠道
- 至少一个分发渠道

### 图标

图标每天自动重抓，落在 `packages/web/public/icons/`（文件名带内容哈希），清单在 `data/icons.json`。取图优先级：

1. `agents.yaml` 的 `icon:` 覆盖（人工校准，最高优先级）
2. 官网 web app manifest 里的大图标（192/512 PNG）
3. 官网 `<link rel=icon>` / `apple-touch-icon`（取最大的那个）
4. 官网 `og:image`（只接受近正方形）
5. GitHub README 里明确写着 logo 的图（开源项目的产品 logo，通常还是 SVG）
6. 第三方 logo API（icon.horse → favicone → unavatar → clearbit）
7. 官网 favicon 服务 / `/favicon.ico`
8. GitHub owner 头像（最后兜底：个人仓库会拿到维护者头像，不是产品 logo）

两条约束：**只升不降**（某天官网抽风抓到低优先级的图，不会覆盖昨天的高清图）；**来源更可信优先**（README 里的产品 logo 优于母公司 favicon）。

自动取图拿不准时用 `icon:` 覆盖，常见情形：

```yaml
- slug: pi
  homepage: https://pi.dev
  icon: https://pi.dev/logo-auto.svg   # 不写会退化到 GitHub owner 头像（维护者个人照片）
```

```bash
pnpm icons                            # 重抓全部
pnpm icons -- --only=pi,langgraph      # 只重抓指定几个（合并进清单，不动其他图标）
pnpm icons:audit                       # 体检：缺图 / 低清 / .ico / 组织头像兜底 / 多产品共用一张图
```

`pnpm icons:audit` 里被标 ⚠️ 的，就是在提示该加 `icon:` 覆盖了。

### 找漏掉的 agent

手写 YAML 追不上新项目，所以有一个候选发现脚本（只出清单，不自动收录 —— 人工审核优先）：

```bash
pnpm discover                    # 三路扫一遍：GitHub 搜索 + 权威清单 + watchlist
pnpm discover --only-watchlist   # 只核 watchlist（快，约 30 次请求）
pnpm discover --min-stars 500    # 放宽门槛
pnpm discover --top 80           # 报告表里只出前 80 条
```

两路来源：

1. **GitHub 搜索 API**，14 组 topic / 关键词（`topic:ai-agent`、`"coding agent" in:name,description` 等），按 star 排序
2. **权威清单**（e2b/awesome-ai-agents、kaushikb11/awesome-llm-agents、jamesmurdza/awesome-ai-devtools、sourcegraph/awesome-code-ai）—— 补搜索 API 的盲区：很多项目既不打 topic，描述也不含关键词
3. **`watchlist.yaml`**（人手维护的种子）—— 闭源产品没有公开 repo，前两路永远看不见；这里记「知道它存在但还没收录」的条目，每次核对状态：`listed` / `pending` / `unreachable` / `archived`

两路都要过 PRD §4.4 门槛（star ≥ 1000、近 180 天有推送、未归档、非 fork），再和 `agents.yaml` 做差集（按 repo / slug / name / 包名比对），最后粗筛掉 skill 包、prompt 集、教程、RAG / 网关等非 agent 产品。

产出 `data/candidates/YYYY-MM-DD.md`（人工审核表）+ `.json`（全量，含自动排除原因）。这个目录不入库 —— 它是工作队列，不是数据。

闭源产品没有公开 repo，脚本抓不到，这部分只能靠人补（竞品页、Product Hunt、HN、商店榜单）。

---

## 打分口径

```
log 压缩 → 同形态组内分位数归一 → 缺失权重重分配 → 加权求和 → 0~100
```

| 指标 | 权重 | 说明 |
|---|---|---|
| Star 总量 | 20% | 存量热度 |
| 30 日增速 | 25% | 核心信号（FLOOR=200，防小基数抖动） |
| 活跃度 | 15% | 近 90 天提交周数 + 发版频率 |
| 安装量 | 20% | npm 周下载 / PyPI 月下载 / 商店 install |
| 贡献者 | 10% | 生态健康度 |
| 生态 | 5% | Discord / Reddit |
| Fork | 5% | 噪声大，低权重 |

**增量与增速分离**（PRD §5.5）：

- 日 / 周 / 月榜用**绝对增量**（谁在变大）
- 综合分 / 趋势榜用**相对增速 %**（谁在变快）

### 外部用量信号：OpenRouter 应用榜

除自有指标外，每个 agent 还会挂上 [OpenRouter 应用榜](https://openrouter.ai/apps) 的月 / 周 token 用量、月请求数和全球名次（`agents.yaml` 里加 `kind: openrouter`，identifier 为 app slug，无 slug 时用数字 app_id）。

- **不参与综合分**：口径与 star / 下载量不同源，混进加权会污染「可比的才排名」
- **口径限制**：只统计经 OpenRouter 转发的请求，自带 key 直连厂商的用量不计入；名次是 OpenRouter 站内总榜，不是全网份额
- 采集器：`packages/pipeline/src/collectors/openrouter.ts`（一次请求取全量榜单，进程内缓存 30 分钟）
- 展示：榜单新增可排序的 `OpenRouter tokens/mo` 列；详情页有「用量 · OpenRouter」区块

---

## 部署

**Cloudflare Pages**（推荐，免费、无限带宽）

| 配置项 | 值 |
|---|---|
| Build command | `pnpm build` |
| Build output directory | `packages/web/dist` |
| Root directory | `/` |
| Node version | 24 |

每日快照由 `.github/workflows/daily.yml` 自动采集、提交并直接部署（wrangler direct upload，不依赖 CF↔GitHub 集成）。

触发链路有两层：

1. `ops/dispatch-worker`（Cloudflare Cron Trigger，**次日北京时间 01:00**）主动调 GitHub 的 `workflow_dispatch` —— 不依赖 GitHub 自己的调度器；采集→构建→部署一次跑完，02:00 前全部完成
2. `daily.yml` 自己的一个 cron（北京 01:30）作为兜底；当天已发布过就直接退出（`data/deploy/<北京日期>.json` 标记），不会重复部署

实测 GitHub 的 `schedule` 会迟到 7 小时以上甚至不触发，所以主力是第 1 层。
所有日期（快照文件名、deployed 标记、年龄/榜单口径）统一用**北京时间**，所以凌晨 01:00（UTC 前一天 17:00）触发不会和前一天错位。详见 [`ops/dispatch-worker/README.md`](ops/dispatch-worker/README.md)。

---

## 产品原则

1. 可比的才排名，不可比的就标注
2. 榜单不可购买（无付费上榜、无竞价排名）
3. 口径公开、数据可下载、算法可复现
4. 单一指标永远可切换 —— 综合分是观点，不是事实
5. 人工审核优先于自动抓取
6. 不背书 —— 安全模块只引用官方公告，不做评级

---

## License

代码 MIT。榜单数据整理自各公开数据源，版权归原项目所有。
