import type { APIRoute } from 'astro';
import { loadLatestScores } from '../lib/data';
import { isListed } from '../lib/shared';

/** XML 文本转义：先 & 再其余，顺序不能换 */
const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** 任意日期串 → RFC 822；无法解析时返回 null */
const toStamp = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toUTCString();
};

export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') ?? 'https://agentnews-c5h.pages.dev';
  const data = loadLatestScores();
  const date = data?.date ?? '';
  /* 列表口径统一：误分类条目不进 feed */
  const rows = (data?.rows ?? [])
    .filter(isListed)
    .filter((r) => r.score != null)
    /* 快照文件按形态分组排列，直接切前 30 会全是 cli —— 按综合分取全局前 30 */
    .sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        (a.rank_in_form ?? 999) - (b.rank_in_form ?? 999) ||
        a.slug.localeCompare(b.slug),
    );

  const buildStamp = toStamp(date) ?? new Date().toUTCString();

  const items = rows.slice(0, 30).map((r) => {
    const link = `${base}/agent/${r.slug}/`;
    /* pubDate 取最近一次发布，退回到最近提交，再退回到快照日 */
    const stamp = toStamp(r.metrics?.last_release) ?? toStamp(r.metrics?.last_commit) ?? buildStamp;
    const rank = r.rank_in_form ?? '—';
    const title = `${r.name ?? r.slug} · score ${r.score} · rank #${rank} (${r.form})`;
    const desc = `AgentNews snapshot ${date}. form ${r.form}, ${r.oss_bucket === 'open' ? 'open source' : 'closed source'}, data level ${r.data_level}.`;
    return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(`${r.slug}@${date}`)}</guid>
      <pubDate>${stamp}</pubDate>
      <description>${esc(desc)}</description>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AgentNews · AI Agent Index</title>
    <link>${esc(`${base}/`)}</link>
    <description>AI agent rankings across terminal, IDE plugin, AI IDE, desktop, browser, framework and autonomous forms. One snapshot per day, top 30 listed agents.</description>
    <language>en</language>
    <atom:link href="${esc(`${base}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${buildStamp}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};