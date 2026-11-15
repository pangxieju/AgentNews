# 部署指南

> **当前线上地址：https://agentnews-c5h.pages.dev**
> Cloudflare Pages 项目名 `agentnews`，生产分支 `main`。
> 自定义域名可在 CF Dashboard → Pages → agentnews → Custom domains 绑定，绑定后记得更新 `SITE_URL` 并重新部署。
>
> CI 还会跑 `pnpm check`（`astro check`，检查 .astro 模板）与 `pnpm lint`（Biome）；本地改完 `.astro` 或文案后建议先跑这两个。

## 一、本地开发

```bash
pnpm install
pnpm validate      # 校验 agents.yaml
pnpm test          # 打分算法单测
pnpm collect       # 采集 + 打分
pnpm build         # 构建静态站
pnpm --filter @agentnews/web dev   # 本地预览（http://localhost:4321）
```

### GitHub 额度说明（重要）

| 模式 | 每 repo 请求数 | 每小时上限 | 能采多少 repo |
|---|---|---|---|
| 官方 API（无 token） | 3 | 60 | 约 20 个 |
| 官方 API（有 token） | 3 | 5,000 | 1,600+ 个 |
| ungh.cc 降级通道 | 0（不占额度） | 无限 | 不限 |

**结论：本地/生产都必须配 `GITHUB_TOKEN`**，否则 contributors 和 last_release 永远采不到（综合分里 15% 的活跃度权重会退化）。

### 存放位置（推荐 `.env`）

```bash
# 在仓库根目录新建 .env，填入：
# GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

- 用 Node 24 内置的 `process.loadEnvFile()` 读取，**零依赖**
- `.env` / `.env.local` 均在 `.gitignore` 中排除，不会进 git
- **优先级：系统环境变量 > `.env.local` > `.env`**（实现方式：先加载高优先级文件，因为 `loadEnvFile` 不覆盖已存在的变量）
- 启动时会打印脱敏后的 token 状态：`[env] GITHUB_TOKEN 已加载（ghp_…cdef，len=40）`

其他方式（任选其一）：

```powershell
# 临时，仅当前窗口
$env:GITHUB_TOKEN="ghp_xxx"

# 持久，所有新窗口（写入用户注册表，明文）
setx GITHUB_TOKEN "ghp_xxx"
```

token 生成：GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → 勾选 `public_repo`（只读公开仓库即可）

采集器会自动判断：额度够（repo 数 × 3）走官方 API，不够则降级 ungh（只拿 stars/forks，拿不到 contributors）。

---

## 二、Cloudflare Pages 部署

### 2.1 最快上线：一条命令（推荐）

不需要先推 GitHub，直接从本地部署：

```bash
# 1. 登录 Cloudflare（浏览器授权，一次性）
pnpm --filter @agentnews/web exec wrangler login

# 2. 设置站点地址（换成你上一步拿到的 pages.dev 地址）
#    Windows PowerShell:
$env:SITE_URL="https://agentnews-c5h.pages.dev"
#    bash:
export SITE_URL="https://agentnews-c5h.pages.dev"

# 3. 构建 + 部署
pnpm build
pnpm --filter @agentnews/web cf:deploy
```

部署成功后会打印形如：

```
✨ Deployment complete! Take a peek over at
   https://agentnews-c5h.pages.dev
```

**第一次部署时 `SITE_URL` 还不确定** → 先不设直接部署，拿到地址后带上 `SITE_URL` 再部署一次（否则 canonical / sitemap 会指向占位域名）。

### 2.2 备选：Git 集成（自动更新）

适合长期运行 —— push 后自动重建。

1. 把仓库推到 GitHub
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 选择仓库，配置：

| 配置项 | 值 |
|---|---|
| Framework preset | `Astro` |
| Build command | `pnpm build` |
| Build output directory | `packages/web/dist` |
| Root directory | `/` |

4. 环境变量：

| Key | Value |
|---|---|
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `10.4.0` |
| `SITE_URL` | 你的生产域名（如 `https://agentnews.dev`） |

5. 部署完成后绑定自定义域名，并把 `SITE_URL` 改成正式域名

### 2.3 自动更新链路

```
GitHub Actions（每日 UTC 02:00）
  → pnpm collect（采集 + 打分 + 归档）
  → git commit data/ 并 push
  → Cloudflare Pages 检测到 push，自动重建
  → 新榜单上线
```

**关键点：数据即代码。** 没有数据库、没有 API 服务，CF Pages 只做静态文件托管。

### 2.4 必须在 GitHub 仓库配置的 Secret

| Secret | 用途 | 是否必需 |
|---|---|---|
| `GITHUB_TOKEN` | 自动注入，无需配置 | 自动 |
| `GH_PAT`（可选） | 若需要更高额度或跨仓库访问 | 可选 |

> `daily.yml` 里用的是 `secrets.GITHUB_TOKEN`（Actions 自动提供，5000 次/h），**不需要手动配置**。

### 2.5 仓库权限

`daily.yml` 需要写权限回写 `data/`：

Settings → Actions → General → Workflow permissions → 选 **Read and write permissions**

### 2.6 手动触发与本地部署

`daily.yml` 支持 `workflow_dispatch`，但**手动触发需要 PAT 带 `Actions: write`**。
用没有该权限的 token 调 API 会返回：

```
403 {"message":"Resource not accessible by personal access token"}
```

（细粒度 PAT：Settings → Developer settings → Fine-grained tokens → 仓库 AgentNews →
Permissions → Actions: **Read and write**。classic PAT 需勾 `workflow` scope。）

不想动权限，就直接走**本地等价链路**——和 `daily.yml` 的步骤一一对应：

```bash
# 1. 采集 + 打分（读 .env.local 的 GITHUB_TOKEN）
pnpm collect

# 2. 提交快照（daily.yml 里是 bot 身份，本地用你自己）
git add data/ agents.yaml packages/web/public/icons
git commit -m "data: snapshot $(date -u +%F)"
git push

# 3. 构建 + 直传 CF Pages（读 .env.local 的 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID）
pnpm build
pnpm --filter @agentnews/web exec wrangler pages deploy dist --project-name agentnews --force
```

**注意两点**：

- `--force` 不能省。wrangler 4 默认委托给新版 Workers-Pages，CI / 非交互环境会卡住
- 工作区有未提交改动时 wrangler 会告警；加 `--commit-dirty=true` 消警（CI 里没加，因为它先 commit 再 deploy）

部署成功会打印一个 `https://<hash>.agentnews-c5h.pages.dev` 预览地址，
生产域名 `https://agentnews-c5h.pages.dev` 立即生效（同一个 deployment）。

**验证部署**（三处都 200 才算成功）：

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://agentnews-c5h.pages.dev/
curl -s -o /dev/null -w "%{http_code}\n" https://agentnews-c5h.pages.dev/top/closed/all/month/
curl -s -o /dev/null -w "%{http_code}\n" https://agentnews-c5h.pages.dev/agent/<新收录的 slug>/
```

---

## 三、域名与 SEO

### 3.1 改站点地址

`packages/web/astro.config.mjs`：

```js
site: 'https://你的域名.com',
```

同时改 `packages/web/public/robots.txt` 里的 Sitemap 地址。

### 3.2 SEO 已内置

- 每页独立 `<title>` / `<meta description>` / canonical / OG 标签
- `sitemap-index.xml` 自动生成（113 个页面全部收录）
- 纯静态 HTML，无 JS 渲染依赖 → 爬虫可完整读取
- 榜单数据内联在 HTML 中 → 搜索「cline vs roo code」这类词有内容可索引

---

## 四、运维手册

### 4.1 日常检查

| 检查项 | 方法 | 异常处理 |
|---|---|---|
| 每日采集是否成功 | GitHub Actions 页面看 `daily` workflow | 失败看日志，多半是 API 额度或某个源挂了 |
| 数据是否陈旧 | 页面底部「数据更新于」 | 超过 2 天未更新 → 查 Actions |
| agents.yaml 是否合法 | `pnpm validate` | CI 会拦截非法 PR |

### 4.2 加一个新 agent

编辑 `agents.yaml`，跑 `pnpm validate`，提 PR。

**不知道漏了谁？先跑发现脚本**（不自动收录，只出候选清单）：

```bash
pnpm discover                    # GitHub 搜索 + 4 份权威清单 + watchlist
pnpm discover --only-watchlist   # 只核 watchlist（闭源种子，约 30 次请求）
```

产出 `data/candidates/YYYY-MM-DD.md`：建议人工过目的候选（按 star 排序，粗筛掉
skill 包 / prompt 集 / 教程 / RAG·网关）+ watchlist 状态（listed / pending /
unreachable / archived）。闭源产品没有公开 repo，只能记在 `watchlist.yaml` 里跟踪。

CI 会自动校验：

- slug 唯一
- 闭源不得以 github 为主渠道
- 至少一个分发渠道

**先核验再写入**（避免 M0 踩过的坑）：

```bash
# 用 ungh 核验 repo 是否存在（不耗 GitHub 额度）
curl -s "https://ungh.cc/repos/OWNER/REPO" | head -c 200

# 核验 npm 包
curl -s "https://api.npmjs.org/downloads/point/last-week/PKG_NAME"

# 核验 PyPI
curl -s "https://pypistats.org/api/packages/PKG/recent"
```

### 4.3 算法调整

改 `packages/core/src/score.ts` 的 `DEFAULT_WEIGHTS` 或归一化逻辑后：

1. 必须跑 `pnpm test`（有 24 个单测锁定行为）
2. 必须改 `SCORE_VERSION`（`packages/core/src/schema.ts`）
3. 在 `/changelog` 页面记录变更

**为什么必须改版本号**：历史快照里的分数是旧算法算的，混在一起展示会误导用户。

### 4.4 数据膨胀处理

| 规模 | 动作 |
|---|---|
| 日档 < 90 天 | 无需处理（约 9MB/年） |
| 日档 > 90 天 | 删 90 天前的日档，保留周档/月档 |
| 仓库 > 200MB | 日档打包 gz 上传 GitHub Releases |

---

## 五、成本

| 项 | 费用 |
|---|---|
| GitHub Actions（public repo） | $0 |
| Cloudflare Pages | $0（无限带宽） |
| 域名 | 约 $10–15/年 |
| **合计** | **约 $1/月** |

无服务器、无数据库、无监控服务。

---

## 附录：项目命名变更记录

| 项 | 旧 | 新 | 说明 |
|---|---|---|---|
| 产品名 | AgentRank | **AgentNews** | 站点标题、页面、文档全部替换 |
| npm scope | `@agentrank/*` | `@agentnews/*` | core / pipeline / web |
| Cloudflare Pages 项目 | `agentrank` | `agentnews` | 线上地址 `https://agentnews-c5h.pages.dev` |
| GitHub 仓库 | — | `AgentNews` | 待创建 |

> 旧的 `agentrank-65p.pages.dev` 项目仍在 Cloudflare 上（未删除）。确认新站稳定后可在
> CF Dashboard → Pages → agentrank → Settings → Delete project 清理。
