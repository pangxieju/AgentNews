# agentnews-dispatch

Cloudflare Cron Trigger Worker：每天定时调 GitHub 的 `workflow_dispatch`，
触发 `daily.yml`（采集 → 提交 → 构建 → 部署）。

## 为什么需要它

GitHub Actions 的 `schedule` 不可靠，实测：

- 11-10 排在 `02:00Z`，实际 `09:19Z` 才跑 —— 迟到 **7 小时 19 分**
- 11-11 排在 `01:30Z`，**完全没触发**

根因是 GitHub 的调度器在整点拥堵时会延迟甚至丢弃事件。改成由 Cloudflare 侧触发后，
链路不再依赖 GitHub 自己的调度。Cloudflare 触发成功后，GitHub 自己的
`10:17` / `12:43` 两个 cron 仍保留作为兜底 —— `daily.yml` 里有「当天已有快照就跳过采集，
只构建+部署」的守卫，所以重复触发不会重复采集，反而能把「采集成功但部署失败」的那天自愈回来。

## 部署

```bash
cd ops/dispatch-worker
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  ../../packages/web/node_modules/.bin/wrangler deploy
```

需要的密钥（不进仓库，用 `wrangler secret put` 写）：

| 名称 | 说明 |
|---|---|
| `GITHUB_TOKEN` | classic PAT，需要 `repo` + `workflow` 权限（`workflow` 是 dispatch 必需的） |
| `TRIGGER_KEY` | 手动触发口令，`GET /?run=1&key=<口令>` 立即触发一次 |

```bash
printf '%s' "$TOKEN" | ../../packages/web/node_modules/.bin/wrangler secret put GITHUB_TOKEN
```

## 验证

```bash
# 自检
curl https://agentnews-dispatch.pangxieju.workers.dev/

# 立即触发一次（本地口令存在 .trigger-key.local，已在 .gitignore 里）
KEY=$(cat .trigger-key.local)
curl "https://agentnews-dispatch.pangxieju.workers.dev/?run=1&key=$KEY"
```

注意：`*.workers.dev` 在国内网络常被 DNS 污染，本机可能打不通；
Worker 跑在 Cloudflare 侧，不受影响。用 Cloudflare GraphQL 的
`workersInvocationsAdaptive` 可以确认它到底有没有被 cron 唤起。

## 轮换 token

1. `wrangler secret put GITHUB_TOKEN` 写入新 token（覆盖）
2. 老的 PAT 在 GitHub 上吊销