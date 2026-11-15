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

/** 单次请求体上限：正常事件 < 400B，超过直接丢弃（防刷） */
const MAX_BODY_BYTES = 2048;
/** 同一 session 每分钟最多写入的事件数（view 也会被限，避免刷新刷量） */
const MAX_EVENTS_PER_MINUTE = 60;

const clip = (v: unknown, n: number): string =>
  typeof v === 'string' ? v.slice(0, n) : '';

export const onRequestOptions = async (): Promise<Response> =>
  new Response(null, { status: 204, headers: CORS });

export const onRequestPost = async (ctx: { request: Request; env: Env }): Promise<Response> => {
  try {
    const len = Number(ctx.request.headers.get('content-length') ?? 0);
    if (len > MAX_BODY_BYTES) return new Response(null, { status: 413, headers: CORS });

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
    const now = Date.now();
    const session = clip(body.s, 40);
    const path = clip(body.p, 160);
    const agent = clip(body.a, 60);

    if (!session) {
      // 没有 session 就不写（无法去重、也无法限流）
      return new Response(null, { status: 204, headers: CORS });
    }

    // 单条 SQL 完成限流 + 写入：窗口内超过上限时 SELECT 不产出行，INSERT 自然跳过
    await ctx.env.DB.prepare(
      `INSERT INTO events (ts, event, path, agent, session, country)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE (SELECT COUNT(*) FROM events WHERE session = ?5 AND ts >= ?7) < ?8`,
    )
      .bind(
        now,
        event,
        path,
        agent,
        session,
        country,
        now - 60_000,
        MAX_EVENTS_PER_MINUTE,
      )
      .run();

    return new Response(null, { status: 204, headers: CORS });
  } catch {
    // 采集失败不影响页面：永远 204
    return new Response(null, { status: 204, headers: CORS });
  }
};
