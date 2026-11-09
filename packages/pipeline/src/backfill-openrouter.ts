/**
 * 一次性回填：把 OpenRouter 用量写进已有的当日快照与评分文件，
 * 不重跑全量采集（避免动 star / 下载量等其它指标）。
 *
 *   npx tsx src/backfill-openrouter.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { Metrics } from '@agentnews/core';
import { collectOpenRouter } from './collectors/openrouter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DATA_DIR = join(ROOT, 'data');
const DATE = process.argv[2] ?? '2026-11-09';

type AgentRow = { slug: string; sources?: Array<{ kind: string; identifier: string }> };

const agents = parse(await readFile(join(ROOT, 'agents.yaml'), 'utf8')) as AgentRow[];
const orId = new Map<string, string>();
for (const a of agents) {
  const s = a.sources?.find((x) => x.kind === 'openrouter');
  if (s) orId.set(a.slug, s.identifier);
}
console.log(`[backfill] ${orId.size} 个 agent 带 openrouter 渠道`);

const patch = new Map<string, Partial<Metrics>>();
for (const [slug, id] of orId) {
  const r = await collectOpenRouter(id);
  if (r) patch.set(slug, r);
  else console.log(`  ! ${slug} (${id}) 未在榜单中`);
}

// 1) 快照 jsonl
const snapPath = join(DATA_DIR, 'snapshots', `${DATE}.jsonl`);
const snapLines = (await readFile(snapPath, 'utf8')).split('\n');
let snapHit = 0;
const newLines = snapLines.map((line) => {
  if (!line.trim()) return line;
  const row = JSON.parse(line) as { slug: string; metrics: Metrics };
  const p = patch.get(row.slug);
  if (!p) return line;
  snapHit++;
  row.metrics = { ...row.metrics, ...p };
  return JSON.stringify(row);
});
await writeFile(snapPath, newLines.join('\n'));
console.log(`[backfill] snapshot: ${snapHit} 行已更新 → ${snapPath}`);

// 2) 评分文件
const scorePath = join(DATA_DIR, 'scores', `${DATE}.json`);
const score = JSON.parse(await readFile(scorePath, 'utf8')) as {
  rows: Array<{ slug: string; metrics: Record<string, unknown> }>;
};
let scoreHit = 0;
for (const row of score.rows) {
  const p = patch.get(row.slug);
  if (!p) continue;
  scoreHit++;
  row.metrics.openrouter_tokens_month = p.openrouter_tokens_month ?? null;
  row.metrics.openrouter_requests_month = p.openrouter_requests_month ?? null;
  row.metrics.openrouter_rank_month = p.openrouter_rank_month ?? null;
}
await writeFile(scorePath, JSON.stringify(score, null, 2) + '\n');
console.log(`[backfill] scores: ${scoreHit} 行已更新 → ${scorePath}`);
