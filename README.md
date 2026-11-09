# AgentNews

AI Agent 排行榜 —— 开源 / 闭源双榜，日 / 周 / 月粒度，跨生态归一化。

> 产品需求见 [`docs/PRD.md`](docs/PRD.md)，技术方案见 [`docs/TECH.md`](docs/TECH.md)。

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
docs/                        PRD + 技术方案
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

---

## 部署

**Cloudflare Pages**（推荐，免费、无限带宽）

| 配置项 | 值 |
|---|---|
| Build command | `pnpm build` |
| Build output directory | `packages/web/dist` |
| Root directory | `/` |
| Node version | 24 |

每日快照由 `.github/workflows/daily.yml` 自动采集并提交，push 后触发 CF Pages 重建。

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
