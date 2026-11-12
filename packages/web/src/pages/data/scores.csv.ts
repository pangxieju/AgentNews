import type { APIRoute } from 'astro';
import { buildScoresCsv } from '../../lib/export';

/** /data/scores.csv —— 给媒体/表格工具用的扁平导出 */
export const GET: APIRoute = () =>
  new Response(buildScoresCsv(), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="agentnews-scores.csv"',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=600, must-revalidate',
    },
  });
