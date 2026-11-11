/**
 * agentnews-dispatch —— Cloudflare Cron Trigger Worker
 *
 * 为什么需要它：GitHub Actions 的 schedule 不可靠（实测 11-10 那次排 02:00Z，
 * 09:19Z 才跑，迟到 7h19m；11-11 的 09:30 那轮干脆没触发）。这里用 Cloudflare
 * 的 cron 去打 GitHub 的 workflow_dispatch 接口，触发链路不依赖 GitHub 自己的调度器。
 *
 * 触发是「幂等」的：daily.yml 里有 Check today's snapshot 守卫，
 * 当天已有快照就跳过采集、只构建+部署，所以重复触发不会重复采集，
 * 反而能把「采集成功但部署失败」的那一天自愈回来。
 *
 * 环境变量/密钥（在 Worker 上配置，不进仓库）：
 *   GITHUB_TOKEN  classic PAT，需要 repo + workflow 权限
 *   TRIGGER_KEY   手动触发口令（GET /?run=1&key=...），不配则只有 cron 能触发
 * 变量：
 *   REPO / WORKFLOW / REF  见 wrangler.jsonc 的 vars
 */

const UA = 'agentnews-dispatch/1.0 (+https://agentnews-c5h.pages.dev)';

/** 触发一次 workflow_dispatch；204 = 已接受 */
async function dispatch(env, reason) {
  const url = `https://api.github.com/repos/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': UA,
        },
        body: JSON.stringify({ ref: env.REF || 'main' }),
      });
      if (res.status === 204) {
        console.log(`[dispatch] ok (${reason}) attempt=${attempt}`);
        return { ok: true, status: 204, attempt };
      }
      last = `${res.status} ${(await res.text()).slice(0, 200)}`;
      console.warn(`[dispatch] fail attempt=${attempt} ${last}`);
    } catch (e) {
      last = String(e);
      console.warn(`[dispatch] error attempt=${attempt} ${last}`);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
  }
  console.error(`[dispatch] 放弃 (${reason}) ${last}`);
  return { ok: false, detail: last };
}

export default {
  /** Cloudflare 定时触发 */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env, `cron ${event.cron}`));
  },

  /** 手动触发 / 健康检查：
   *   GET /                   → 自检
   *   GET /?run=1&key=口令    → 立刻触发一次
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get('run') === '1') {
      if (!env.TRIGGER_KEY || url.searchParams.get('key') !== env.TRIGGER_KEY) {
        return new Response('unauthorized\n', { status: 401 });
      }
      const r = await dispatch(env, 'manual');
      return new Response(JSON.stringify(r) + '\n', {
        status: r.ok ? 200 : 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      `agentnews-dispatch ok\nrepo=${env.REPO}\nworkflow=${env.WORKFLOW}\nref=${env.REF}\n` +
        `cron=每天 02:05 UTC（北京 10:05）\n手动触发：GET /?run=1&key=<TRIGGER_KEY>\n`,
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  },
};
