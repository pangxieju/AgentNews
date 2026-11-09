/**
 * OpenRouter 应用榜单（https://openrouter.ai/apps）
 *
 * 为什么值得采：
 * - 这是目前唯一公开的「按真实调用量」排的 AI 应用榜，口径是我们缺的
 *   （star / 下载量都是「装了多少」，token 用量是「真的在用多少」）
 * - 同一份榜单里有日 / 周 / 月三个窗口，能算增速，且天然跨生态可比
 *
 * 口径限制（必须记在页面上，否则会误导）：
 * - 只覆盖「通过 OpenRouter 转发请求」的流量，自带 key / 直连厂商的用量不计入
 * - 所以它是「relative usage within OpenRouter」，不是全网份额
 *
 * 接口：https://openrouter.ai/api/frontend/v1/apps/marketplace/marketplace
 * 一次请求返回全部榜单（popular / trending / leaderboards / globalRankingMap），
 * 所以进程内缓存一份，60 个 agent 不重复拉。
 */
import type { Metrics } from '@agentnews/core';

const ENDPOINT = 'https://openrouter.ai/api/frontend/v1/apps/marketplace/marketplace';
const TTL_MS = 30 * 60 * 1000;

type RankedItem = {
  app_id: number;
  total_tokens: string;
  total_requests: string;
  rank: number;
  app: { id: number; title: string; slug: string | null; origin_url: string | null };
};

type MarketPayload = {
  globalRankingMap?: { day?: RankedItem[]; week?: RankedItem[]; month?: RankedItem[] };
};

type OpenRouterUsage = {
  appId: number;
  title: string;
  slug: string | null;
  tokensMonth: number;
  tokensWeek: number;
  requestsMonth: number;
  rankMonth: number;
};

let cache: { at: number; bySlug: Map<string, OpenRouterUsage>; byId: Map<string, OpenRouterUsage> } | null = null;

const toNum = (s: string | number | undefined): number => {
  const n = typeof s === 'number' ? s : Number(s);
  return Number.isFinite(n) ? n : 0;
};

/** 拉取并索引榜单（进程内缓存 30 分钟） */
async function loadOpenRouterUsage(): Promise<{
  bySlug: Map<string, OpenRouterUsage>;
  byId: Map<string, OpenRouterUsage>;
}> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;

  const res = await fetch(ENDPOINT, {
    headers: { 'User-Agent': 'AgentNewsBot/1.0 (+https://agentnews-c5h.pages.dev)', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`openrouter: ${res.status}`);
  const payload = (await res.json()) as { data?: MarketPayload };
  const month = payload.data?.globalRankingMap?.month ?? [];
  const week = payload.data?.globalRankingMap?.week ?? [];
  if (month.length === 0) throw new Error('openrouter: empty ranking');

  const weekById = new Map(week.map((i) => [i.app_id, i]));
  const bySlug = new Map<string, OpenRouterUsage>();
  const byId = new Map<string, OpenRouterUsage>();

  for (const it of month) {
    const w = weekById.get(it.app_id);
    const usage: OpenRouterUsage = {
      appId: it.app_id,
      title: it.app?.title ?? '',
      slug: it.app?.slug ?? null,
      tokensMonth: toNum(it.total_tokens),
      tokensWeek: w ? toNum(w.total_tokens) : 0,
      requestsMonth: toNum(it.total_requests),
      rankMonth: it.rank,
    };
    byId.set(String(it.app_id), usage);
    if (usage.slug) bySlug.set(usage.slug, usage);
  }

  cache = { at: Date.now(), bySlug, byId };
  return cache;
}

/**
 * 查一个 agent 在 OpenRouter 榜单上的用量。
 * identifier 可以是 app slug（如 claude-code），也可以是数字 app_id。
 * 未收录 → 返回 null（不写任何指标，交由「缺失权重重分配」处理）。
 */
export async function collectOpenRouter(identifier: string): Promise<Partial<Metrics> | null> {
  const { bySlug, byId } = await loadOpenRouterUsage();
  const hit = bySlug.get(identifier) ?? byId.get(identifier);
  if (!hit) return null;
  return {
    openrouter_tokens_month: hit.tokensMonth,
    openrouter_tokens_week: hit.tokensWeek,
    openrouter_requests_month: hit.requestsMonth,
    openrouter_rank_month: hit.rankMonth,
  };
}
