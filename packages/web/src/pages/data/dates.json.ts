import type { APIRoute } from 'astro';
import { buildDatesExport, JSON_HEADERS } from '../../lib/export';

/** /data/dates.json —— 可用快照日期清单 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildDatesExport(), null, 2), { headers: JSON_HEADERS });
