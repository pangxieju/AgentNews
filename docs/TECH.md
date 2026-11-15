# AgentNews 技术方案（TECH / ADR）

| 项目 | 内容 |
|---|---|
| 对应 PRD | `docs/PRD.md` v0.3 |
| 文档版本 | v0.1 |
| 状态 | 待评审 |
| 定位 | 单人可维护、零运维、零成本的技术选型 |

> **现状（2026-11-15）**：本文是设计稿，部分细节已被实现取代；以 README + 代码为准。
>
> - 形态 9 种：`cli` / `ide-plugin` / `ide-app` / `desktop` / `browser` / `framework` / `platform` / `autonomous` / `assistant`
> - 页面：`/` `/top/` `/agent/` `/forms/` `/compare/` `/vs/` `/about/` `/data/`；早期 `/rising` `/activity` `/security` `/archive` 已下线（301）
> - 事件 5 类：`release` / `version` / `listed` / `rank_jump` / `newcomer`
> - 综合分 v2：开源/闭源分开做组内分位；权重不含 `ecosystem`（Discord 尚未采集）
> - 归档：周/月冻结文件在 `data/archive/`，通过 `/data/archive/{label}.json` 暴露（不再有归档页）

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions（每日 UTC 02:00，cron）                       │
│                                                             │
│   agents.yaml ──┐                                           │
│                 ├─► collector ─► data/snapshots/YYYY-MM-DD.jsonl
│   GitHub/npm ───┘        │                                   │
│   OSV/RSS                ▼                                   │
│                    scorer（纯函数）──► data/scores/YYYY-MM-DD.json
│                          │                                  │
│                          ▼                                  │
│                    data/ 变更 → git commit → 触发部署         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages（静态托管）                                 │
│                                                             │
│   Astro 构建时读取 data/*.json → 纯静态 HTML + 内联 SVG 图表   │
│   仅榜单表格一个 Preact island（排序/筛选，~4KB）              │
└─────────────────────────────────────────────────────────────┘
```

**一句话：这个产品的核心资产是「每日快照数据」，不是 Web 应用。所以架构的重心在流水线，前端应该尽可能"笨"。**

---

## 2. 核心决策（ADR）

### ADR-1：不用数据库，用 JSONL 文件当数据库 ⭐ 最关键

**决策**：`data/snapshots/YYYY-MM-DD.jsonl` 每行一个 agent 的原始指标；`data/scores/YYYY-MM-DD.json` 存当日计算结果。全部提交进 git。**MVP 阶段不引入 SQLite / Postgres。**

**理由**

1. **数据量根本不构成问题**：500 agents × 365 天 = 18.2 万行，约 36MB/年。全量读进内存是毫秒级。
2. **git 就是免费的归档与审计**：每个快照都是一个 commit，天然满足 PRD §14.3「数据可复现、可审计」。想做时间旅行不需要任何额外机制 —— `git show` 即可。
3. **归档就是文件**：`/data/archive/2026-W46.json` 就是 `data/archive/2026-W46.json`，静态端点直接映射，不需要查询层。
4. **失败可回滚**：采集脚本写错数据，`git revert` 一个 commit 就恢复了。用数据库要写迁移脚本。
5. **零依赖**：没有 DB 连接、没有连接池、没有备份策略、没有云厂商锁定。CI 里就是读写文件。

**放弃的方案**

| 方案 | 放弃原因 |
|---|---|
| SQLite（PRD 原方案） | CI 里 SQLite 文件是临时的，必须额外解决持久化（commit 二进制 or artifact 下载），等于多一层复杂度却没换来能力 |
| Supabase / Turso / D1 | 引入外部依赖与免费额度风险；本项目没有实时写入需求 |
| 提交二进制 .db 到 git | git 无法 diff，冲突无法解决，每次全量重写导致仓库膨胀 |

**何时升级**：agents > 2,000，或需要在**请求时**做跨周期复杂查询（如"任意两个时间点对比"）时，引入 SQLite 作为**派生的本地缓存**（由 JSONL 重建，可随时丢弃）。源真相永远是 JSONL。

**仓库膨胀的对策**：日档保留最近 90 天，之后合并为周档 + 月档；超过 1 年的日档打包成 `.jsonl.gz` 上传到 GitHub Releases（免费存放），仓库内只留索引。

---

### ADR-2：TypeScript 单一语言，不用 Python

**决策**：流水线与前端全用 TypeScript（Node 24）。

**理由**

1. **不需要 pandas**。本项目的计算是「读 API → 存数字 → 算分位数 → 加权求和」，纯算术，没有数据科学。
2. **一套类型贯穿全栈**：`Agent` 类型从 `agents.yaml` 校验 → 采集 → 打分 → 前端渲染，编译期就能发现字段不一致。跨语言会丢这个能力。
3. **生态匹配**：要对接的都是 HTTP JSON API（GitHub GraphQL、npm、OSV、RSS），Node 侧工具最全。
4. **单人维护**：一个语言 = 一套工具链 = 一份 CI。

**放弃**：Python（生态优势在 ML/数据处理，本项目用不上）；Go（写起来更啰嗦，前端还要换语言）。

---

### ADR-3：Astro 做前端，只有表格是 island

**决策**：Astro + Preact island（仅榜单表格），图表用**构建时生成的 inline SVG**。

**理由**

1. **这个产品的流量命脉是 SEO**（"best ai coding agent"、"cline vs roo code" 这类搜索）。Astro 默认输出纯 HTML，对比 SPA 是碾压性优势。
2. **默认 0 JS**。500 行榜单表格 + 6 个详情页 + 归档页，如果每个页面都加载 React 运行时，移动端体验会很差。
3. **图表不需要 JS**：sparkline、90 天趋势线都是**构建时算好坐标、直接输出 `<path d="...">`**。零 JS、零 layout shift、可被截图、可被爬虫读取。用 ECharts/Recharts 属于杀鸡用牛刀。
4. **island 只做一件事**：表格的排序/筛选/粒度切换。Preact ~4KB 够用。
5. **Markdown/MDX 原生支持**：`/about`（算法说明）、`/changelog` 直接用 MDX 写。

**放弃**

| 方案 | 放弃原因 |
|---|---|
| Next.js | 需要 server runtime 的能力一个都用不上（无登录、无写入、无实时）；App Router 复杂度对单人项目是负担 |
| Vite + React SPA | SEO 差、首屏要等 JS、LCP 达不到 PRD 要求的 1.5s |
| 纯 HTML + 手写模板 | 500 个详情页手写不现实 |

---

### ADR-4：GitHub Actions 当调度器 + Cloudflare Pages 当托管

**决策**：采集跑在 GitHub Actions（public repo，免费无限分钟），站点部署在 Cloudflare Pages（免费，无限带宽）。

**理由**

1. **零成本**：public repo 的 Actions 免费；CF Pages 免费额度 500 builds/月，我们一年 365 次，够用。
2. **无需服务器**：没有 VPS 要打补丁、没有容器要维护。
3. **数据与代码同仓**：采集脚本 commit 数据 → CF Pages 自动重建，一条链路，无外部消息队列。
4. **带宽**：CF Pages 不限带宽，而 Vercel 免费版有 100GB/月限制（榜单类站点容易被社交平台流量打爆）。

**已知限制与对策**

| 限制 | 对策 |
|---|---|
| Actions cron 可能延迟 15–60 分钟 | 可接受。日榜是日粒度，不要求准点 |
| Actions 在仓库 60 天无活动后停用定时任务 | 采集脚本每天 commit 数据，天然保持活跃 |
| CF Pages 单次构建上限 20 分钟 | 静态构建 500 页 Astro 约 30–60 秒，余量充足 |
| 无法跑长时间任务 | 采集是 I/O 密集，500 repo 的 GraphQL 批量请求约 1–3 分钟 |

**放弃**：Vercel（带宽限制 + 商业使用条款）；自建 VPS（运维成本违背「零运维」目标）。

---

### ADR-5：`agents.yaml` 是唯一人工入口，Zod 在 CI 里强制校验

**决策**：所有人工维护信息（form / oss_bucket / license / 渠道映射 / 备注）只存在于 `agents.yaml`。CI 第一步就是 Zod 校验，**校验失败直接 fail，不产出任何数据**。

**理由**

1. PRD §14.5「人工审核优先于自动抓取」—— 榜单质量取决于这份名单。
2. YAML 在 git 里可 diff、可 PR、可 review，社区纠错成本极低（改一行提 PR）。
3. Zod schema 同时生成 TypeScript 类型，避免 `agents.yaml` 与代码漂移。
4. **失败要大声**：宁可当天不出榜（前端显示上一次数据 + 「数据延迟」），也不能产出错误的榜。这直接对应 PRD §9 可用性要求。

---

## 3. 技术栈清单

| 层 | 选型 | 版本/说明 |
|---|---|---|
| 运行时 | Node.js | 24 LTS（已在本机验证 v24.14.0） |
| 包管理 | pnpm workspace | 10.x（已装 v10.4.0） |
| 语言 | TypeScript | strict 模式，`noUncheckedIndexedAccess: true` |
| Schema 校验 | **Zod** | `agents.yaml` + 所有外部 API 响应都要过 Zod |
| YAML 解析 | `yaml` | 保留注释与格式，便于社区 PR |
| HTTP | 原生 `fetch` | Node 24 内置，不引 axios |
| 并发控制 | `p-limit` | GitHub GraphQL 限流保护 |
| RSS | `rss-parser` | 新闻模块 |
| 测试 | **Vitest** | 打分算法必须有测试，这是公信力的基础 |
| 前端框架 | **Astro** | 静态优先 |
| 交互 island | **Preact** | 仅榜单表格，~4KB |
| 样式 | **Tailwind CSS** | Astro 官方集成，无运行时 |
| 图表 | **构建时 inline SVG** | 自写 30 行工具函数，不引图表库 |
| 托管 | **Cloudflare Pages** | 免费、无限带宽 |
| CI/CD | **GitHub Actions** | public repo 免费 |
| 代码质量 | Biome | 替代 ESLint + Prettier，单工具、快 |
| 提交规范 | Conventional Commits | 便于生成 changelog |

**明确不引入**：数据库、ORM、状态管理库、UI 组件库（shadcn/antd）、图表库（ECharts/Recharts）、监控 SaaS、容器。

---

## 4. 仓库结构

```
agentnews/
├── agents.yaml                  # ⭐ 唯一人工维护入口（社区 PR 目标）
├── watchlist.yaml               # 未收录候选（discover --write 会剪掉已收录）
├── data/
│   ├── snapshots/YYYY-MM-DD.jsonl   # 每日原始指标（每行一个 agent）
│   ├── scores/YYYY-MM-DD.json       # 每日计算结果（含排名、增量、flags）
│   ├── history/YYYY-MM-DD.json      # npm/PyPI 安装历史回填（审计）
│   ├── events/YYYY-MM-DD.jsonl      # 事件流
│   ├── security/YYYY-MM-DD.json     # OSV 公告汇总
│   ├── archive/2026-W46.json        # 周/月冻结归档（审计）
│   └── plans.yml                    # 定价与约束（人工核验）
├── packages/
│   ├── core/                    # 纯函数，无 I/O，100% 可测
│   │   ├── schema.ts            # Zod schema（Agent / Source / ScoreRow）
│   │   ├── score.ts             # 综合分：log → percentile → 加权
│   │   ├── growth.ts            # 增量与增速（含 FLOOR / dormant / dataLevel）
│   │   ├── health.ts            # 维护健康派生指标（median / elapsed / backlog）
│   │   └── __tests__/
│   ├── pipeline/                # 采集器，只做 I/O + 调 core
│   │   ├── collectors/{index,openrouter}.ts   # GitHub / npm / PyPI / VS Code / JetBrains / OpenRouter
│   │   ├── security.ts          # OSV querybatch
│   │   ├── events.ts            # 事件流生成（5 类）
│   │   ├── history.ts           # npm/PyPI 安装历史回填
│   │   ├── icons*.ts            # 图标抓取 / 体检
│   │   ├── discover.ts          # 候选发现（不写 agents.yaml）
│   │   ├── state.ts             # 首次收录状态
│   │   └── run.ts               # 入口：读 yaml → 采集 → 打分 → 写文件
│   └── web/                     # Astro 站点
│       ├── src/pages/[...path].astro          # 单一路由分发器（zh/en）
│       ├── src/pages/{404,feed.xml,robots.txt}.ts
│       ├── src/pages/data/**.ts               # JSON/CSV/归档导出
│       ├── src/views/                         # Home / Agent / Forms / Compare / Vs / About / Data
│       └── src/components/                    # RankBoard / CompareBoard / HomePicker / PinTray（Preact islands）
├── .github/workflows/
│   ├── daily.yml                # 采集 + 提交数据 + 部署
│   ├── weekly.yml               # 决策会话周报 Issue
│   └── ci.yml                   # PR 校验（validate / typecheck / astro check / lint / test / build）
└── docs/
```

**分层纪律**：`core` 不许有 `fetch`/`fs`，纯函数；`pipeline` 不许有业务算法；`web` 不许直接调外部 API。这条纪律保证打分逻辑可被 100% 单测覆盖。

---

## 5. 数据流水线

### 5.1 每日执行步骤

```
1. 读 agents.yaml → Zod 校验（失败即 fail，不写任何文件）
2. 分组并发采集：
   ├─ GitHub GraphQL（100 repo/请求，约 5 请求覆盖 500 个）
   ├─ npm downloads API（point/last-week + point/last-month）
   ├─ PyPI / crates（如适用）
   ├─ VS Code Marketplace（仅周日执行）
   └─ OSV + RSS（安全/新闻，仅入库不参与打分）
3. 写入 data/snapshots/YYYY-MM-DD.jsonl
4. 读历史：找 t-1、t-7、t-30 的快照文件（缺失则该指标标记 null）
5. core/score.ts 计算：log → form 组内 percentile → 加权 → rank
6. 写 data/scores/YYYY-MM-DD.json
7. 周日/月末：额外冻结 data/archive/2025-W42.json / 2025-09.json
8. git commit "data: snapshot 2025-10-19" → push
9. Cloudflare Pages 自动构建部署
```

### 5.2 失败处理（对应 PRD §9「绝不展示空白榜」）

| 场景 | 行为 |
|---|---|
| `agents.yaml` 校验失败 | 整个 job fail，不写文件，不发通知以外的动作 |
| 单个数据源失败（如 npm 挂了） | 该指标写 `null`，打分时权重重分配，`flags: ["partial_data"]`，前端标注 |
| 全部数据源失败 | job fail，保留上一次数据，前端显示「数据延迟至 YYYY-MM-DD」 |
| t-30 快照不存在（上线 < 30 天） | 30d 增量写 `null`，前端显示「数据积累中」 |
| 写文件后 push 失败 | 重试 3 次；仍失败则 job fail（数据在 CI 里丢失，可接受，明日重跑） |

### 5.3 关键代码骨架

**Schema 即契约**

```ts
// packages/core/schema.ts
import { z } from 'zod';

export const Form = z.enum(['cli','ide-plugin','ide-app','desktop','browser','framework','autonomous']);
export const OssBucket = z.enum(['open','semi','closed']);

export const SourceSchema = z.object({
  kind: z.enum(['github','npm','pypi','crates','brew','vscode','chrome','appstore','releases','manual']),
  identifier: z.string().min(1),
  is_primary: z.boolean().default(false),
});

export const AgentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  vendor: z.string().optional(),
  form: Form,
  oss_bucket: OssBucket,
  license_id: z.string().default('unknown'),
  homepage: z.string().url().optional(),
  sources: z.array(SourceSchema).min(1),
  note: z.string().optional(),
});

export const AgentsFile = z.array(AgentSchema).superRefine((arr, ctx) => {
  const seen = new Set<string>();
  for (const a of arr) {
    if (seen.has(a.slug)) ctx.addIssue({ code: 'custom', message: `duplicate slug: ${a.slug}` });
    seen.add(a.slug);
    // 闭源项目不应以 github 作为主渠道
    if (a.oss_bucket === 'closed' && a.sources.some(s => s.kind === 'github' && s.is_primary))
      ctx.addIssue({ code: 'custom', message: `${a.slug}: closed source cannot use github as primary` });
  }
});
```

**打分核心（纯函数，可单测）**

```ts
// packages/core/score.ts
export type Weights = Record<string, number>;

export const DEFAULT_WEIGHTS: Weights = {
  stars: 0.20, star_growth_30d: 0.25, activity: 0.15,
  installs: 0.20, contributors: 0.10, forks: 0.05,
}; // ecosystem（Discord）尚未采集，不设权重；缺失指标按可得权重归一

const compress = (x: number) => Math.log10(1 + Math.max(0, x));

/** 组内分位数排名：对极端值不敏感，新增超级项目不会压低所有人 */
function percentileRank(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map(v => {
    const lo = sorted.findIndex(s => s >= v);
    const hi = sorted.findLastIndex(s => s <= v);
    return (lo + hi) / 2 / Math.max(1, sorted.length - 1);
  });
}

export function scoreGroup(
  items: { slug: string; metrics: Record<string, number | null> }[],
  weights: Weights = DEFAULT_WEIGHTS,
): Map<string, number> {
  const keys = Object.keys(weights);
  // 每个指标：取有值的人做组内归一
  const norm = new Map<string, Map<string, number>>();
  for (const k of keys) {
    const present = items.filter(i => i.metrics[k] != null);
    if (present.length < 2) { norm.set(k, new Map()); continue; }
    const ranks = percentileRank(present.map(i => compress(i.metrics[k]!)));
    norm.set(k, new Map(present.map((i, idx) => [i.slug, ranks[idx]!])));
  }
  // 缺失值权重重分配
  return new Map(items.map(i => {
    let sum = 0, wsum = 0;
    for (const k of keys) {
      const n = norm.get(k)!.get(i.slug);
      if (n == null) continue;
      sum += weights[k]! * n;
      wsum += weights[k]!;
    }
    return [i.slug, wsum > 0 ? Math.round((sum / wsum) * 1000) / 10 : 0];
  }));
}
```

**增量与增速分离（对应 PRD §5.5）**

```ts
// packages/core/growth.ts
/** 增量榜用绝对增量：谁在真正变大 */
export const absoluteDelta = (now: number | null, then: number | null) =>
  now == null || then == null ? null : now - then;

/** 综合分用相对增速：谁势头更好，FLOOR 抑制小基数暴涨 */
export function growthPct(now: number | null, then: number | null, floor: number) {
  if (now == null || then == null) return null;
  if (then < floor) return null;              // 基准太小，不参与
  return (now - then) / then;
}

export const FLOOR = { day: 50, week: 50, month: 200 } as const;
```

**GitHub GraphQL 批量采集（限流友好）**

```ts
// packages/pipeline/collectors/github.ts
const QUERY = `
query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Repository {
      nameWithOwner
      stargazerCount
      forkCount
      issues(states: OPEN) { totalCount }
      releases(last: 5) { nodes { publishedAt tagName } }
      defaultBranchRef { target { ... on Commit { history(first: 1) { nodes { committedDate } } } } }
      mentionableUsers(first: 1) { totalCount }
    }
  }
}`;
// 100 个 repo / 请求 → 500 agents ≈ 5 请求，远低于 5000 points/h
```

---

## 6. 前端实现要点

### 6.1 榜单表格（唯一 island）

```tsx
// packages/web/src/components/RankTable.tsx  (Preact)
// props 由 Astro 构建时注入完整数据（JSON），客户端只做排序/筛选，不发请求
export default function RankTable({ rows, granularity }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [form, setForm] = useState<Form | 'all'>('cli');
  // 排序 + 筛选在内存里做；500 行无性能问题
}
```

**为什么数据全量内联**：500 行 × 约 200 字节 = 100KB，gzip 后约 15KB。比一次 API 往返更快，且离线可用、可被搜索引擎索引。

### 6.2 图表用构建时 SVG

```astro
---
// Sparkline.astro —— 零 JS，纯 path
const pts = values.map((v, i) => [
  (i / (values.length - 1)) * width,
  height - ((v - min) / (max - min || 1)) * height,
]);
const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
---
<svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`近 ${values.length} 天趋势`}>
  <path d={d} fill="none" stroke="currentColor" stroke-width="1.5" />
</svg>
```

### 6.3 URL 即状态

```
/top/open/cli/month/          # 主榜（bucket × form × 默认排序）
/zh/top/open/cli/month/       # 中文镜像
/agent/cursor/
/vs/claude-code-vs-cursor/
```

全部静态可访问（`getStaticPaths` 预生成），可分享、可被引用、可被爬虫索引。对应 PRD §7.1 F-01/F-09/F-11。

---

## 7. CI/CD

**`ci.yml`（PR 触发）**：Zod 校验 `agents.yaml` → Vitest → Astro build → 预览部署

**`daily.yml`（cron）**：

```yaml
name: daily
on:
  schedule: [{ cron: '0 2 * * *' }]   # UTC 02:00
  workflow_dispatch:
concurrency: { group: daily, cancel-in-progress: false }
permissions: { contents: write }
jobs:
  collect:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter core test          # 算法回归先跑
      - run: pnpm --filter pipeline start
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          git config user.name  'agentnews-bot'
          git config user.email 'bot@agentnews.dev'
          git add data/
          git diff --staged --quiet || git commit -m "data: snapshot $(date -u +%F)"
          git push
```

**数据健康度自检**（写入 `data/health.json`，前端读取并在页脚显示）：

- 今日快照行数是否 ≈ `agents.yaml` 条目数（缺失 > 10% 则告警）
- 是否有指标全部为 null 的 agent
- 30d 增速可算比例（上线初期会很低，前端据此显示「数据积累中」）

---

## 8. 成本

| 项 | 费用 |
|---|---|
| GitHub Actions（public repo） | $0 |
| Cloudflare Pages | $0 |
| 域名（可选，如 agentnews.dev） | 约 $10–15/年 |
| 第三方 API（GitHub / npm / OSV / RSS） | $0 |
| **合计** | **≈ $1/月** |

PRD §9 目标「< $10/月」达成，且**没有任何服务器需要维护**。

---

## 9. 测试策略

| 层级 | 内容 | 工具 |
|---|---|---|
| 单元测试（核心） | `scoreGroup` 分位数正确性、缺失值重分配、`growthPct` 的 FLOOR 边界、并列排名 | Vitest |
| 契约测试 | `agents.yaml` 全量校验通过；每个 collector 的 Zod schema 能解析真实 API 样例（存 fixture） | Vitest + fixtures |
| 快照测试 | 给定固定输入，打分输出必须完全一致（防止算法悄悄漂移） | Vitest `toMatchSnapshot` |
| 构建测试 | Astro build 成功；关键页面存在；榜单非空 | CI |
| 线上自检 | `data/health.json` 异常时前端显示告警条 | 流水线 |

**必须测的边界**：单元素分组（percentile 除零）、全 null 指标、star 从 0 涨到 100（FLOOR 拦截）、并列同名次。

---

## 10. 实施顺序（与 PRD §10 里程碑对齐）

| 步骤 | 内容 | 产出 |
|---|---|---|
| T0 | pnpm workspace + core/schema + `agents.yaml` v1（40 个 agent） | 可校验的名单 |
| T1 | GitHub + npm collector 实跑，落 `data/snapshots/` | 真实数据，验证基数 |
| T2 | core/score + core/growth + 单测 | 第一版排名（CSV 看结果） |
| T3 | Astro 骨架 + `/top` 静态表 | 能看的榜 |
| T4 | Preact island 排序筛选 + SVG sparkline + 详情页 | MVP |
| T5 | daily.yml + CF Pages 部署 | 自动更新 |
| T6 | `/about` `/data` `/vs` `/forms` + 安全区块、对比器、周/月归档端点 | 完整版 |
| T7 | 新闻聚合 + 自动发现（P2） | 情报站 |

---

## 11. 何时该升级架构

| 信号 | 升级动作 |
|---|---|
| agents > 2,000 | 引入 SQLite 作为派生缓存（从 JSONL 重建） |
| 日档 > 90 天且仓库 > 200MB | 日档转 gz 上 Releases，仓库留周/月档 |
| 需要实时查询/对比工具 | 加一个只读 API（CF Workers + D1），但仍以 JSONL 为源 |
| 需要用户账号/收藏 | 才引入 Postgres + 认证 |
| 构建时间 > 5 分钟 | Astro 增量构建或拆分站点 |

**原则：每一条升级都必须由具体瓶颈触发，不做"以后可能需要"的预留。**

---

## 12. M0 实测发现（真实数据校准）

首轮实跑（28 个 agent）推翻了几个设计假设，已回写到代码：

### 12.1 GitHub 无 token 会直接卡死流水线 → 双通道

未认证 API 只有 60 次/小时，一轮 25 个 repo 就打穿，且会把已采到的数据覆盖成空。

**方案：自动降级通道**

```
有额度 → api.github.com/repos/{repo}（字段全：stars/forks/open_issues/license）
无额度 → ungh.cc/repos/{repo}（unjs 提供的只读代理，无鉴权、无限流，有 stars/forks/pushedAt）
```

- 实现：`collectGitHub(repo, token, mode)`，`githubHasQuota()` 探测后自动选通道
- 保护：本轮若**一个 star 都没采到**，拒绝写快照（保留上次成功数据）
- 生产环境仍应配置 `GITHUB_TOKEN`（5000/h），ungh 只是兜底

### 12.2 分位数归一在小样本下退化 → 秩中点平滑

原实现 `(lo+hi)/2/(n-1)`，n=3 时只能得到 `{0, 0.5, 1}`：star 最少的项目直接拿 0 分，看起来像 bug（Stagehand 26k star 得 0 分）。

**改为** `(midRank + 0.5) / n`：

| n | 旧 | 新 |
|---|---|---|
| 3 | 0 / 0.5 / 1 | 0.167 / 0.5 / 0.833 |
| 4 | 0 / 0.33 / 0.67 / 1 | 0.125 / 0.375 / 0.625 / 0.875 |

保留相对顺序，去掉极端 0/100，小组不再失真。

### 12.3 L3（无数据）绝不能进入排名

首轮发现 cursor / windsurf / trae 三个无任何数据的条目都拿到 50 分并占据 1/2/3 名 —— 直接违反 PRD §5.7。

**修复**：`data_level === 'L3'` → `score = null`、`rank_in_form = null`，前端显示「—」并打 `no_data` 徽章，归入收录区。

### 12.4 npm 下载量严重虚高 → 打标而非剔除

实测：

| 包 | 周下载 | 判断 |
|---|---|---|
| `@openai/codex` | 26.0M | 明显含 CI / 依赖安装 |
| `@anthropic-ai/claude-code` | 14.1M | 同上 |
| `@earendil-works/pi-coding-agent` | 6.1M | 同上 |
| `aider-chat` (PyPI) | 61k | 接近真实用户量 |

**处理**：安装量 ≥ 100 万/周 → 打 `installs_may_include_ci` 徽章（前端显示「含 CI 安装」）。不剔除，因为 log 压缩后量级差异已被大幅削弱，且绝对值仍有信息量。

### 12.5 静态站 + 查询参数 = 坏掉的导航

Astro 静态输出时 `/top?bucket=closed` 与 `/top` 返回同一份 HTML —— 参数在纯静态托管下不生效。

**修复**：改为预生成路由 `/top/{bucket}/{form}/{g}`，共 48 个组合页（2 桶 × 8 形态 × 3 粒度）。整站 79 页构建耗时 1.1 秒。

### 12.6 形态分组必须落到 UI，不只是数据层

首版 `form=all` 把所有形态混排成一张表 —— 等于跨形态总榜，违反 PRD §4.2。

**修复**：`form=all` 时按形态渲染**多个独立表格**，每表内单独排名；排名序号按当前视图重新编号（避免开源/闭源过滤后出现 `1,2,3,4,6,7,8` 的断层）。

### 12.7 错误数据比没有数据更糟

M0 用网页 HEAD / npm registry 元数据（不耗 API 额度）逐个核实渠道，修正了：

| 条目 | 错误 | 实际 |
|---|---|---|
| Pi | `TheLaoGao/pi`（404） | `badlogic/pi-mono` + npm `@earendil-works/pi-coding-agent` |
| Kilo Code | `KiloCodeInc/Kilo-Code`（404） | `Kilo-Org/kilocode` + npm `@kilocode/cli` |
| Qwen Code | `QwenLM/Qwen2.5-Coder`（模型库） | `QwenLM/qwen-code` |
| Cursor CLI | npm `cursor-cli`（抢注包，49 次/周） | 无官方渠道 → 降级 L3 |
| Amos | 整条为猜测，仓库与 npm 均不存在 | 删除 |

### 12.8 已完成（T1）

- `last_release` / `contributors` 已采集（API 通道：`per_page=1` + Link header 取贡献者总数，各 1 次请求）
- 实测：47/60 有 contributors，44/60 有 last_release；活跃度不再恒定（从全员 0.59 → 0.00~1.00 真实区分）
- 未认证额度（60/h）不足以支撑 60 repo × 3 请求 → 必须配 `GITHUB_TOKEN`（.env / .env.local 均支持）

### 12.9 待办（T2）

- 首轮无历史快照 → `delta_1d/7d/30d`、`growth_*` 全为 null。需累积 ≥30 天才有趋势榜
- 新秀口径已改为 `min(repo_created, 首次收录时间)`（见 `pipeline/src/state.ts`），且只在「上期已存在」时才发 `newcomer` 事件

### 12.10 内容模块落地（M2）

| 模块 | 实现 | 数据落盘 | 页面 |
|---|---|---|---|
| 活动（F-24） | 与上一快照 diff，产出 5 类事件 | `data/events/YYYY-MM-DD.jsonl` | 首页「最近动向」（独立频道页已下线） |
| 安全（F-26） | OSV.dev `querybatch` 一次批量查全部包 | `data/security/YYYY-MM-DD.json` | 详情页安全区块（独立频道页已下线） |

**活动模块的两个必踩的坑（已修）**

1. **首日无基线** → 首次运行不产生任何事件，否则会一次性刷出 60 条「新收录」。
2. **通道切换误报发版** → `last_release` 从「无」（ungh 模式）变「有」（API 模式）不是发版。规则：前后都必须有值且不同才算变化。

**安全模块的定位纪律**

- 只给「OSV 历史公告数」与「恶意包数（MAL-*）」，**不给红黄绿总分、不做安全背书**
- 不判断「是否已修复」（需要版本比对，误判成本高于收益）
- 页面上明确写「不代表当前版本受影响」

**新秀口径（修 bug）**

原实现 `min(repo_created, first_listed)` 在首日把所有人算成「出道 0 天」。引入 `state.started_at` 后：
- `first_listed <= started_at` → 该条目在上线前就存在，**first_listed 不可信**，只用 repo_created
- `first_listed > started_at` → 上线后才冒出来的项目，按收录时间算

状态存在 `data/agents-state.json`（幂等，随 git 审计）。

### 12.11 详情页维护健康（P0 落地）

回答「它还在被认真维护吗」，数据全部来自**已有快照**，不新增采集器：

| 展示 | 原料 | 派生 |
|---|---|---|
| 最近提交 / 最近发版 | `last_commit` / `last_release` | 距「快照日」的小时/天数（`core/health.ts`） |
| 发版节奏 | 版本记录的 `version_at` | 相邻版本发布时刻的中位间隔 |
| Open issues | `open_issues` + `stars` | 每千 star 积压数（star < 1000 不给，分母不可信） |
| Fork / Star | `forks` / `stars` | 百分比 |
| 组内位置 | 同 form 全量行 | 秩中点分位（复用 `score.ts` 口径），中点 = 组内中位 |

**三个刻意的决定：**

1. **`now` 用快照日期，不用构建时刻**。否则同一份数据每次部署「3 小时前」会漂移，看起来像数据在动。
2. **缺数据不画条**。分组条形图天然暗示「短 = 差」，所以 `null` 一律渲染成「—」（`GroupPos.astro`），
   并且 `activity === 0` 只有在存在 `last_commit` / `last_release` 证据时才当成真值——否则它是「未知」。
3. **不跨形态比较**。组内位置的分母恒为同 form 对象数，页头写明 n；跨形态的分位是假的可比性。

**历史回填**：新增字段只补不改。`pnpm backfill` 读当日 + t-1/t-7/t-30 快照，
把 `open_issues / last_commit / repo_created / installs_{1,7,30}d_ago` 补进既有 `data/scores/*.json`，
**不动任何既有数值与名次**（归档是审计日志，不允许事后改写）。

**已知遗留**：`activity` 对无 GitHub 证据的闭源条目恒为 0，且它与开源条目同 form 参赛，
会被计成一个真实的「0 分」。详情页已按「未知」展示，但**打分端仍按 0 参与**——这是单独的评分口径决策，
需在 PRD §5.3 层面拍板后统一修。
