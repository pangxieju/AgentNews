import type { APIRoute } from 'astro';
import { loadLatestScores } from '../../lib/data';
import { isListed } from '../../lib/shared';

/**
 * 可嵌入徽章：/badge/{slug}.svg
 * 用途：项目作者/媒体在 README 或文章里引用名次，形成回链。
 * 口径：只对在榜（score != null）的条目生成；未在榜返回 noindex 的"unranked"徽章。
 */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const truncate = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function getStaticPaths() {
  const rows = (loadLatestScores()?.rows ?? []).filter(isListed);
  return rows.map((r) => ({ params: { slug: r.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  const data = loadLatestScores();
  const row = (data?.rows ?? []).find((r) => r.slug === params.slug && isListed(r));
  const name = truncate(row?.name ?? params.slug ?? 'unknown', 24);
  const score = row?.score != null ? String(row.score) : '—';
  const rank = row?.rank_in_form != null ? `#${row.rank_in_form}` : 'unranked';
  const date = data?.date ?? '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="68" viewBox="0 0 360 68" role="img" aria-label="AgentNews: ${esc(name)} ${esc(rank)} ${esc(score)}">
  <rect x="0.5" y="0.5" width="359" height="67" rx="10" fill="#0f1115" stroke="#2a2f3a"/>
  <text x="16" y="24" fill="#8b93a7" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="10" letter-spacing="1.6">AGENTNEWS · ${esc(rank)}</text>
  <text x="16" y="48" fill="#f5f7fa" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="16" font-weight="600">${esc(name)}</text>
  <text x="344" y="48" text-anchor="end" fill="#7dd3a7" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="20" font-weight="700">${esc(score)}</text>
  <text x="344" y="24" text-anchor="end" fill="#8b93a7" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="10">${esc(date)}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600, must-revalidate',
    },
  });
};
