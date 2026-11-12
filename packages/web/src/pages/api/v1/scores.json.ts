import type { APIRoute } from 'astro';
import { buildScoresExport, JSON_HEADERS } from '../../../lib/export';

/** 公开只读 API：最新快照（字段契约见 lib/export.ts） */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildScoresExport(), null, 2), { headers: JSON_HEADERS });
