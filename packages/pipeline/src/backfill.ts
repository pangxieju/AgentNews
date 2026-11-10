/**
 * 离线回填：给已归档的 data/scores/*.json 补上新增的派生字段。
 *
 * 为什么单独写一个脚本，而不是重跑 collect：
 * - 采集要联网，回填不要网；重跑 collect 会把 star / 下载量刷成「今天」的值，
 *   破坏历史一致性（归档是审计日志，不允许事后改写既有数值）。
 * - 这里只补字段、不动任何既有数值与名次；字段算不出来就留 null。
 *
 * 补什么：
 * - open_issues / last_commit / repo_created —— 来自当日快照
 * - installs_1d_ago / 7d_ago / 30d_ago —— 来自 t-1 / t-7 / t-30 快照（缺失则 null）
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { effectiveInstalls, type Metrics, type ScoreRow } from '@agentnews/core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DATA_DIR = join(ROOT, 'data');
const SCORES_DIR = join(DATA_DIR, 'scores');
const SNAPSHOT_DIR = join(DATA_DIR, 'snapshots');

type ScoreFile = { date: string; version: string; rows: ScoreRow[] };

async function readSnapshot(date: string): Promise<Record<string, Metrics> | null> {
  try {
    const raw = await readFile(join(SNAPSHOT_DIR, `${date}.jsonl`), 'utf8');
    const out: Record<string, Metrics> = {};
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as { slug: string; metrics: Metrics };
      out[row.slug] = row.metrics;
    }
    return out;
  } catch {
    return null;
  }
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

async function main(): Promise<void> {
  const files = (await readdir(SCORES_DIR)).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('[backfill] data/scores 为空，跳过');
    return;
  }

  for (const f of files) {
    const path = join(SCORES_DIR, f);
    const score = JSON.parse(await readFile(path, 'utf8')) as ScoreFile;
    const date = score.date ?? f.slice(0, 10);
    const snaps = {
      1: await readSnapshot(shiftDate(date, -1)),
      7: await readSnapshot(shiftDate(date, -7)),
      30: await readSnapshot(shiftDate(date, -30)),
    };
    const today = await readSnapshot(date);

    let patched = 0;
    for (const row of score.rows) {
      const m = today?.[row.slug];
      if (!m) continue;
      const before = JSON.stringify(row.metrics);

      row.metrics.last_commit = str(m.last_commit);
      row.metrics.open_issues = num(m.open_issues);
      row.metrics.repo_created = str(m.repo_created);
      row.metrics.installs_1d_ago = snaps[1]?.[row.slug] ? effectiveInstalls(snaps[1]![row.slug]!) : null;
      row.metrics.installs_7d_ago = snaps[7]?.[row.slug] ? effectiveInstalls(snaps[7]![row.slug]!) : null;
      row.metrics.installs_30d_ago = snaps[30]?.[row.slug] ? effectiveInstalls(snaps[30]![row.slug]!) : null;

      if (JSON.stringify(row.metrics) !== before) patched++;
    }

    await writeFile(path, JSON.stringify(score, null, 2));
    console.log(
      `[backfill] ${date}: ${patched}/${score.rows.length} 行补字段` +
        `（参考快照 t-1 ${snaps[1] ? '有' : '无'} · t-7 ${snaps[7] ? '有' : '无'} · t-30 ${snaps[30] ? '有' : '无'}）`,
    );
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});