/**
 * 第一方事件采集（Pages Function → D1）。
 *
 * 隐私口径：
 * - 不存 IP、不存 UA、不设 cookie；session 是 sessionStorage 里的随机串
 * - 只存：时间戳 / 事件名 / 页面路径 / agent slug / 匿名 session / 国家（CF 边缘提供）
 * - 保留 90 天（清理见 ops/stats.mjs 的 purge 说明）
 *
 * 事件：
 * - view      页面浏览（每页一次）
 * - compare   对比器里选满 ≥2 个候选
 * - out       外链点击（官网 / 安装 / 商店）
 *
 * 这些事件用于计算北极星「每周决策会话」= 有 compare 或 out 的独立 session。
 */
interface Env {
  DB: D1Database;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED = new Set(['view', 'compare', 'out']);

const clip = (v: unknown, n: number): string =>
  typeof v === 'string' ? v.slice(0, n) : '';

export const onRequestOptions = async (): Promise<Response> =>
  new Response(null, { status: 204, headers: CORS });

export const onRequestPost = async (ctx: { request: Request; env: Env }): Promise<Response> => {
  try {
    const body = (await ctx.request.json()) as {
      e?: string;
      p?: string;
      a?: string;
      s?: string;
    };
    const event = clip(body.e, 20);
    if (!ALLOWED.has(event)) {
      return new Response(null, { status: 400, headers: CORS });
    }
    const country = (ctx.request.headers.get('cf-ipcountry') || '').slice(0, 2);
    await ctx.env.DB.prepare(
      'INSERT INTO events (ts, event, path, agent, session, country) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        Date.now(),
        event,
        clip(body.p, 160),
        clip(body.a, 60),
        clip(body.s, 40),
        country,
      )
      .run();
    return new Response(null, { status: 204, headers: CORS });
  } catch {
    return new Response(null, { status: 204, headers: CORS });
  }
};