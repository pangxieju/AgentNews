import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  AgentsFileSchema,
  FORMS,
  SCORE_VERSION,
  dataLevel,
  effectiveInstalls,
  scoreGroup,
  type Agent,
  type Metrics,
  type ScoreRow,
} from '@agentrank/core';
import { collectAgent, githubHasQuota } from './collectors/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const YAML_PATH = join(ROOT, 'agents.yaml');
const DATA_DIR = join(ROOT, 'data');

function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** 从 YAML 加载并校验 agent 名单 */
export async function loadAgents(): Promise<Agent[]> {
  const raw = await readFile(YAML_PATH, 'utf8');
  const parsed = parse(raw);
  const result = AgentsFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`agents.yaml 校验失败:\n${issues}`);
  }
  return result.data;
}

/** 读取指定日期的历史快照（不存在 → null） */
async function readSnapshot(date: string): Promise<Record<string, Metrics> | null> {
  try {
    const raw = await readFile(join(DATA_DIR, 'snapshots', `${date}.jsonl`), 'utf8');
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

/** 聚合为评分输入：合并当日 + 参考历史 */
async function buildScorables(
  agents: Agent[],
  metricsMap: Map<string, Metrics>,
): Promise<Parameters<typeof scoreGroup>[0]> {
  const today = isoDate();
  const prev = await readSnapshot(prevDate(today));
  const weekAgo = await readSnapshot(daysAgo(today, 7));
  const monthAgo = await readSnapshot(daysAgo(today, 30));
  const now = new Date();

  return agents.map((agent) => {
    const m = metricsMap.get(agent.slug) ?? {};
    return {
      slug: agent.slug,
      form: agent.form,
      oss_bucket: agent.oss_bucket,
      metrics: m,
      ref: {
        prev: prev?.[agent.slug] ?? {},
        weekAgo: weekAgo?.[agent.slug] ?? {},
        monthAgo: monthAgo?.[agent.slug] ?? {},
      },
    };
  });
}

function prevDate(today: string): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return isoDate(d);
}
function daysAgo(today: string, n: number): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}

/** 每日主入口 */
export async function runDaily(opts: { token?: string; concurrency?: number } = {}): Promise<{
  snapshotPath: string;
  scorePath: string;
  rows: ScoreRow[];
}> {
  const agents = await loadAgents();
  const today = isoDate();
  console.log(`[run] ${today} · ${agents.length} agents`);

  // 0. GitHub 额度保护：剩余不足则整轮跳过 GitHub 采集（保留旧快照，不覆盖成功数据）
  const ghEnabled = await githubHasQuota(opts.token);
  if (!ghEnabled) {
    console.warn('[run] GitHub rate limit 不足（<20），本轮跳过 GitHub 采集，保留旧数据');
  }

  // 1. 采集（串行跑，限流友好；后续可 p-limit 并行）
  const metricsMap = new Map<string, Metrics>();
  const errors: string[] = [];
  for (const agent of agents) {
    try {
      // GitHub 被跳过时：不调 GitHub 采集器，直接采非 GitHub 渠道
      const gh = agent.sources.filter((s) => s.kind === 'github');
      if (gh.length && !ghEnabled) {
        const r = await collectAgent({ ...agent, sources: agent.sources.filter((s) => s.kind !== 'github') }, opts.token);
        metricsMap.set(agent.slug, r.metrics);
        if (r.errors.length) {
          console.warn(`  ! ${agent.slug}: ${r.errors.join('; ')}`);
          errors.push(...r.errors.map((e) => `${agent.slug}: ${e}`));
        } else {
          console.log(`  ✓ ${agent.slug} (non-github)  ${JSON.stringify(r.metrics)}`);
        }
        continue;
      }
      const r = await collectAgent(agent, opts.token);
      metricsMap.set(agent.slug, r.metrics);
      if (r.errors.length) {
        console.warn(`  ! ${agent.slug}: ${r.errors.join('; ')}`);
        errors.push(...r.errors.map((e) => `${agent.slug}: ${e}`));
      } else {
        console.log(`  ✓ ${agent.slug}  stars=${r.metrics.stars ?? '-'}`);
      }
    } catch (e) {
      console.warn(`  ✗ ${agent.slug}: ${e instanceof Error ? e.message : e}`);
      metricsMap.set(agent.slug, {});
      errors.push(`${agent.slug}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 1.5 若无任何 star 数据（全 GitHub 失败），拒绝覆盖旧快照 —— 保留上次成功数据
  const anyStars = [...metricsMap.values()].some((m) => typeof m.stars === 'number');
  if (!anyStars) {
    console.error('[run] 本轮无任何 GitHub 数据，不写快照（保留上次成功数据）。请稍后重试或配置 GITHUB_TOKEN');
    return { snapshotPath: '', scorePath: '', rows: [] };
  }

  // 2. 落快照（原始指标）
  await mkdir(join(DATA_DIR, 'snapshots'), { recursive: true });
  const snapshotPath = join(DATA_DIR, 'snapshots', `${today}.jsonl`);
  const lines = agents.map((a) =>
    JSON.stringify({ slug: a.slug, form: a.form, oss_bucket: a.oss_bucket, metrics: metricsMap.get(a.slug) ?? {} }),
  );
  await writeFile(snapshotPath, lines.join('\n') + '\n');
  console.log(`[snapshot] ${lines.length} rows → ${snapshotPath}`);

  // 3. 打分（按 form 分组）
  const scorables = await buildScorables(agents, metricsMap);
  const rows: ScoreRow[] = [];
  for (const form of FORMS) {
    const group = scorables.filter((s) => s.form === form);
    if (group.length === 0) continue;
    const scores = scoreGroup(group, undefined, new Date());
    const bySlug = new Map(scores.map((s) => [s.slug, s.score]));
    // 组内排名（同分同名次）
    const ranked = [...group].sort((a, b) => (bySlug.get(b.slug) ?? 0) - (bySlug.get(a.slug) ?? 0));
    ranked.forEach((item, idx) => {
      const m = item.metrics;
      const stars = typeof m.stars === 'number' ? m.stars : null;
      const weekAgo = typeof item.ref?.weekAgo?.stars === 'number' ? item.ref.weekAgo.stars : null;
      const monthAgo = typeof item.ref?.monthAgo?.stars === 'number' ? item.ref.monthAgo.stars : null;
      const prevStars = typeof item.ref?.prev?.stars === 'number' ? item.ref.prev.stars : null;
      const delta1d = stars != null && prevStars != null ? stars - prevStars : null;
      rows.push({
        slug: item.slug,
        form: item.form,
        oss_bucket: item.oss_bucket,
        score: bySlug.get(item.slug) ?? 0,
        rank_in_form: idx + 1,
        delta_1d: delta1d,
        delta_7d: stars != null && weekAgo != null ? stars - weekAgo : null,
        delta_30d: stars != null && monthAgo != null ? stars - monthAgo : null,
        growth_7d_pct: growthPctSafe(stars, weekAgo, 50),
        growth_30d_pct: growthPctSafe(stars, monthAgo, 200),
        data_level: dataLevel(stars, effectiveInstalls(m)),
        flags: errors.some((e) => e.startsWith(item.slug)) ? ['partial_data'] : [],
        score_version: SCORE_VERSION,
      });
    });
  }

  // 4. 落评分快照
  await mkdir(join(DATA_DIR, 'scores'), { recursive: true });
  const scorePath = join(DATA_DIR, 'scores', `${today}.json`);
  await writeFile(scorePath, JSON.stringify({ date: today, version: SCORE_VERSION, rows }, null, 2));
  console.log(`[scores] ${rows.length} rows → ${scorePath}`);

  return { snapshotPath, scorePath, rows };
}

function growthPctSafe(
  now: number | null,
  then: number | null | undefined,
  floor: number,
): number | null {
  if (now == null || then == null || typeof then !== 'number') return null;
  if (then < floor || then <= 0) return null;
  return Math.round(((now - then) / then) * 1000) / 10;
}

// 直接运行时执行
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runDaily({ token: process.env.GITHUB_TOKEN }).then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
