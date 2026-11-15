import type { APIRoute } from 'astro';
import { loadArchive, loadArchives } from '../../../lib/data';
import { JSON_HEADERS } from '../../../lib/export';

/**
 * /data/archive/{label}.json —— 单周 / 单月冻结归档（label 如 2026-W46、2026-11）。
 * 归档是审计快照，不会被事后改写。
 */
export function getStaticPaths() {
  return loadArchives().map((a) => ({ params: { label: a.label } }));
}

export const GET: APIRoute = ({ params }) => {
  const label = params.label ?? '';
  const data = loadArchive(label);
  if (!data) return new Response('{"error":"not found"}', { status: 404, headers: JSON_HEADERS });
  return new Response(JSON.stringify(data, null, 2), { headers: JSON_HEADERS });
};
