/**
 * 公开数据导出（供 /data/* 与 /api/v1/* 复用）。
 * 口径：
 * - 只导出非误分类的条目（isListed）
 * - 开源 / 闭源是两套命名空间，score 只在本命名空间内可比
 * - 导出字段是公开契约，内部推断字段不进导出
 */
import { loadAllScores, loadAgentsMeta, loadLatestScores } from './data';
import { isListed } from './shared';
import { planFor, type PlanInfo } from './plans';

export const SITE = 'https://agentnews-c5h.pages.dev';

export type PublicRow = {
  slug: string;
  name: string;
  form: string;
  oss_bucket: string;
  score: number | null;
  rank_in_form: number | null;
  delta_1d: number | null;
  installs_delta_7d: number | null;
  installs_delta_30d: number | null;
  growth_30d_pct: number | null;
  data_level: string;
  flags: string[];
  license: string | null;
  homepage: string | null;
  /** 定价与约束：未核验不包含价格数字 */
  plan: PlanInfo;
  metrics: {
    stars: number | null;
    forks: number | null;
    contributors: number | null;
    installs: number | null;
    activity: number | null;
    last_release: string | null;
  };
};

export function buildScoresExport(date?: string) {
  const all = loadAllScores();
  const data = date ? (all.find((d) => d.date === date) ?? null) : loadLatestScores();
  const meta = loadAgentsMeta();
  const rows: PublicRow[] = (data?.rows ?? []).filter(isListed).map((r) => ({
    slug: r.slug,
    name: r.name ?? r.slug,
    form: r.form,
    oss_bucket: r.oss_bucket,
    score: r.score,
    rank_in_form: r.rank_in_form,
    delta_1d: r.delta_1d ?? null,
    installs_delta_7d: r.installs_delta_7d ?? null,
    installs_delta_30d: r.installs_delta_30d ?? null,
    growth_30d_pct: r.growth_30d_pct ?? null,
    data_level: r.data_level,
    flags: r.flags ?? [],
    license: meta[r.slug]?.license ?? null,
    homepage: meta[r.slug]?.homepage ?? null,
    plan: planFor(r.slug, meta[r.slug]?.license, meta[r.slug]?.homepage),
    metrics: {
      stars: r.metrics?.stars ?? null,
      forks: r.metrics?.forks ?? null,
      contributors: r.metrics?.contributors ?? null,
      installs: r.metrics?.installs ?? null,
      activity: r.metrics?.activity ?? null,
      last_release: r.metrics?.last_release ? String(r.metrics.last_release).slice(0, 10) : null,
    },
  }));
  return {
    meta: {
      site: SITE,
      date: data?.date ?? null,
      score_version: data?.version ?? null,
      coverage: {
        listed: rows.length,
        ranked: rows.filter((r) => r.score != null).length,
        open: rows.filter((r) => r.oss_bucket !== 'closed').length,
        closed: rows.filter((r) => r.oss_bucket === 'closed').length,
      },
      readme:
        'score is an in-form percentile over available signals; open (open+semi) and closed are separate namespaces and only comparable within a form. Not a capability benchmark.',
      license: 'Data CC BY 4.0 (attribution required) · Code MIT',
      terms: 'No paid placement. Corrections: /about/#corrections',
    },
    rows,
  };
}

export function buildDatesExport() {
  const all = loadAllScores();
  return {
    meta: {
      site: SITE,
      latest: all[0]?.date ?? null,
      pattern: '/data/{date}/scores.json',
      count: all.length,
    },
    dates: all.map((d) => ({
      date: d.date,
      score_version: d.version,
      rows: d.rows.length,
      ranked: d.rows.filter((r) => r.score != null).length,
      url: `/data/${d.date}/scores.json`,
    })),
  };
}

const esc = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildScoresCsv(): string {
  const { rows } = buildScoresExport();
  const head = [
    'slug',
    'name',
    'form',
    'oss_bucket',
    'score',
    'rank_in_form',
    'stars',
    'installs',
    'activity',
    'installs_delta_7d',
    'installs_delta_30d',
    'growth_30d_pct',
    'data_level',
    'license',
    'flags',
  ];
  const lines = rows.map((r) =>
    [
      r.slug,
      r.name,
      r.form,
      r.oss_bucket,
      r.score,
      r.rank_in_form,
      r.metrics.stars,
      r.metrics.installs,
      r.metrics.activity,
      r.installs_delta_7d,
      r.installs_delta_30d,
      r.growth_30d_pct,
      r.data_level,
      r.license,
      r.flags.join('|'),
    ]
      .map(esc)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n') + '\n';
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=600, must-revalidate',
};

export const JSON_HEADERS = jsonHeaders;
