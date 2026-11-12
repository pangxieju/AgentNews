import type { APIRoute } from 'astro';
import { loadAllScores } from '../../../lib/data';
import { buildScoresExport, JSON_HEADERS } from '../../../lib/export';

/** /data/{date}/scores.json —— 历史快照（只列出实际存在的日期） */
export function getStaticPaths() {
  return loadAllScores().map((d) => ({ params: { date: d.date } }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(buildScoresExport(params.date), null, 2), { headers: JSON_HEADERS });
