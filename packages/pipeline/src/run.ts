import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  AgentsFileSchema,
  FORMS,
  SCORE_VERSION,
  activityScore,
  dataLevel,
  effectiveInstalls,
  scoreGroup,
  type Agent,
  type Metrics,
  type ScoreRow,
} from '@agentrank/core';
import { collectAgent, githubHasQuota, type GitHubMode } from './collectors/index.js';

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

  // 0. 选 GitHub 通道：有额度用官方 API（字段更全），否则自动降级 ungh（无限流）
  const hasQuota = await githubHasQuota(opts.token);
  const ghMode: GitHubMode = hasQuota ? 'api' : 'ungh';
  console.log(`[run] GitHub 通道：${ghMode}${hasQuota ? '' : '（API 额度不足，降级 ungh）'}`);

  // 1. 采集（串行跑，限流友好；后续可 p-limit 并行）
  const metricsMap = new Map<string, Metrics>();
  const errors: string[] = [];
  for (const agent of agents) {
    try {
      const r = await collectAgent(agent, opts.token, ghMode);
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

  // 3. 打分（按 form 分组）—— L3（无数据）不参与排名（PRD §5.7）
  const scorables = await buildScorables(agents, metricsMap);
  const agentName = new Map(agents.map((a) => [a.slug, a.name]));
  const rows: ScoreRow[] = [];

  for (const form of FORMS) {
    const group = scorables.filter((s) => s.form === form);
    if (group.length === 0) continue;
    const scores = scoreGroup(group, undefined, new Date());
    const scoreMap = new Map(scores.map((s) => [s.slug, s.score]));

    const enriched = group.map((item) => {
      const m = item.metrics;
      const stars = typeof m.stars === 'number' ? m.stars : null;
      const installs = effectiveInstalls(m);
      const level = dataLevel(stars, installs);
      return { item, m, stars, installs, level, score: level === 'L3' ? null : (scoreMap.get(item.slug) ?? null) };
    });

    // 仅 L1/L2 且组内 ≥2 项才有资格排名
    const rankable = enriched
      .filter((e) => e.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const rankMap = new Map(rankable.map((e, i) => [e.item.slug, i + 1]));
    const ordered = [
      ...rankable,
      ...enriched.filter((e) => e.score == null).sort((a, b) => a.item.slug.localeCompare(b.item.slug)),
    ];

    for (const e of ordered) {
      const { item, m, stars, installs, level, score } = e;
      const weekAgo = typeof item.ref?.weekAgo?.stars === 'number' ? item.ref.weekAgo.stars : null;
      const monthAgo = typeof item.ref?.monthAgo?.stars === 'number' ? item.ref.monthAgo.stars : null;
      const prevStars = typeof item.ref?.prev?.stars === 'number' ? item.ref.prev.stars : null;

      const flags: string[] = [];
      if (errors.some((err) => err.startsWith(item.slug))) flags.push('partial_data');
      if (level === 'L3') flags.push('no_data');
      if (installs != null && installs >= 1_000_000) flags.push('installs_may_include_ci');
      if (group.length <= 2 && level !== 'L3') flags.push('small_group');

      // 出道天数（PRD §5.6 新秀资格）
      const createdAt = typeof m.repo_created === 'string' ? m.repo_created : null;
      const ageDays = createdAt
        ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
        : null;
      if (ageDays != null && ageDays <= 180) flags.push('newcomer');

      rows.push({
        slug: item.slug,
        name: agentName.get(item.slug) ?? item.slug,
        form: item.form,
        oss_bucket: item.oss_bucket,
        score: score == null ? null : Math.round(score * 10) / 10,
        rank_in_form: rankMap.get(item.slug) ?? null,
        delta_1d: stars != null && prevStars != null ? stars - prevStars : null,
        delta_7d: stars != null && weekAgo != null ? stars - weekAgo : null,
        delta_30d: stars != null && monthAgo != null ? stars - monthAgo : null,
        growth_7d_pct: growthPctSafe(stars, weekAgo, 50),
        growth_30d_pct: growthPctSafe(stars, monthAgo, 200),
        metrics: {
          stars,
          forks: typeof m.forks === 'number' ? m.forks : null,
          contributors: typeof m.contributors === 'number' ? m.contributors : null,
          installs,
          activity: activityScore(
            typeof m.last_commit === 'string' ? m.last_commit : null,
            typeof m.last_release === 'string' ? m.last_release : null,
          ),
        },
        data_level: level,
        flags,
        age_days: ageDays,
        score_version: SCORE_VERSION,
      });
    }
  }

  // 4. 落评分快照
  await mkdir(join(DATA_DIR, 'scores'), { recursive: true });
  const scorePath = join(DATA_DIR, 'scores', `${today}.json`);
  await writeFile(scorePath, JSON.stringify({ date: today, version: SCORE_VERSION, rows }, null, 2));
  console.log(`[scores] ${rows.length} rows → ${scorePath}`);

  // 5. 周期归档（PRD §5.5）：周日冻结周档，月末冻结月档
  const archived = await archiveIfNeeded(today, rows);
  if (archived.length) console.log(`[archive] ${archived.join(', ')}`);

  return { snapshotPath, scorePath, rows };
}

/** ISO 8601 周号（周一为周起点） */
function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7; // 周日=7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum); // 移到本周周四
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

/** 周日/月末冻结归档；幂等（同一周期重复跑覆盖同文件） */
async function archiveIfNeeded(today: string, rows: ScoreRow[]): Promise<string[]> {
  const d = new Date(today + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=周日
  const tomorrow = new Date(d);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const isMonthEnd = tomorrow.getUTCMonth() !== d.getUTCMonth();
  const isWeekEnd = dow === 0;

  const written: string[] = [];
  const dir = join(DATA_DIR, 'archive');
  await mkdir(dir, { recursive: true });

  if (isWeekEnd) {
    const { year, week } = isoWeek(d);
    const name = `${year}-W${String(week).padStart(2, '0')}`;
    await writeFile(
      join(dir, `${name}.json`),
      JSON.stringify({ period: 'week', label: name, end: today, version: SCORE_VERSION, rows }, null, 2),
    );
    written.push(name);
  }
  if (isMonthEnd) {
    const name = today.slice(0, 7); // YYYY-MM
    await writeFile(
      join(dir, `${name}.json`),
      JSON.stringify({ period: 'month', label: name, end: today, version: SCORE_VERSION, rows }, null, 2),
    );
    written.push(name);
  }
  return written;
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
