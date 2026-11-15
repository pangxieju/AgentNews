import type { APIRoute } from 'astro';
import { buildArchivesExport, JSON_HEADERS } from '../../lib/export';

/** /data/archives.json —— 周档 / 月档清单（pipeline 每周日 / 每月末冻结） */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildArchivesExport(), null, 2), { headers: JSON_HEADERS });
