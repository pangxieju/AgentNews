# agentnews-dispatch

Cloudflare Cron Trigger Worker：每天 UTC 17:00（= 北京时间次日 01:00）调 GitHub 的 `workflow_dispatch`，
触发 `daily.yml`（采集 → 提交 → 构建 → 部署），02:00 前全部更新完成。

## 为什么需要它

GitHub Actions 的 `schedule` 不可靠，实测：

- 11-10 排在 `02:00Z`，实际 `09:19Z` 才跑 —— 迟到 **7 小时 19 分**
- 11-11 排在 `01:30Z`，**完全没触发**
- 11-11 的两个 cron（02:17Z / 04:43Z）分别在 `09:25Z` / `12:10Z` 才跑，晚 7 小时以上

根因是 GitHub 的调度器在整点拥堵时会延迟甚至丢弃事件。改成由 Cloudflare 侧触发后，
链路不再依赖 GitHub 自己的调度。

正常情况下**每天只跑一次**（北京 01:00）：采集 → 构建 → 部署都在同一次运行里连着做完，约 2~3 分钟，
不存在「先采集、过一阵才更新」的间隔，02:00 前全部完成。

GitHub 自己的 `01:30` cron 只是兜底：01:00 那次没成时才补跑，同样采集+发布一起做。
判重靠 `data/deploy/<北京日期>.json` 标记 —— 当天已发布过就直接退出，不会有第二次部署；
当天采集成功但部署失败时标记不存在，兜底轮会把整条流程重跑一遍。

所有日期口径都是**北京时间**（UTC+8）：快照/标记的文件名、`run.ts` 的 `isoDate()` 均已切到 UTC+8，
所以排在 UTC 17:00（北京 01:00）不会和前一天错位。

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