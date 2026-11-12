import type { APIRoute } from 'astro';
import { loadLatestScores } from '../lib/data';

export const GET: APIRoute = ({ site }) => {
  const data = loadLatestScores();
  const base = site?.toString().replace(/\/$/, '') ?? 'https://agentnews-c5h.pages.dev';
  const date = data?.date ?? '';
  const rows = data?.rows ?? [];
  const items = rows
    .filter((r) => r.score != null)
    .slice(0, 30)
    .map((r) => {
      const pub = r.metrics?.last_release ?? r.metrics?.last_commit ?? date;
      const stamp = pub ? new Date(pub).toUTCString() : new Date().toUTCString();
      return `    <item>
      <title>${r.name ?? r.slug}: score ${r.score} · rank #${r.rank_in_form ?? '—'}</title>
      <link>${base}/agent/${r.slug}/</link>
      <guid>${base}/agent/${r.slug}/#${date}</guid>
      <pubDate>${stamp}</pubDate>
      <description>AgentNews snapshot ${date} — form ${r.form}, data level ${r.data_level}.</description>
    </item>`;
    });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AgentNews · AI Agent Index</title>
    <link>${base}/</link>
    <description>Rankings and releases across AI coding agents.</description>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};