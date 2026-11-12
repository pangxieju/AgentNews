import type { APIRoute } from 'astro';
import { buildScoresExport, JSON_HEADERS } from '../../lib/export';

/** /data/scores.json —— 与 /api/v1/scores.json 同源，方便直接下载 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildScoresExport(), null, 2), { headers: JSON_HEADERS });
