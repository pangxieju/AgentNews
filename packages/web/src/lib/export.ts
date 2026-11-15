/**
 * 公开数据导出（供 /data/* 与 /api/v1/* 复用）。
 * 口径：
 * - 只导出非误分类的条目（isListed）
 * - 开源 / 闭源是两套命名空间，score 只在本命名空间内可比
 * - 导出字段是公开契约，内部推断字段不进导出
 */
import { loadAgentsMeta, loadAllScores, loadArchives, loadLatestScores } from './data';
import { type PlanInfo, planFor } from './plans';
import { isListed } from './shared';

/** 站点地址：与 astro.config 的 site 一致（SITE_URL 可覆盖），不要写死域名 */
export const SITE =
  (import.meta.env.SITE as string | undefined) ?? 'https://agentnews-c5h.pages.dev';

export type PublicRow = {
  slug: string;
  name: string;
  form: string;
  oss_bucket: string;
  score: number | null;
  rank_in_form: number | null;
  delta_1d: number | null;
  delta_7d: number | null;
  installs_delta_7d: number | null;
  installs_delta_30d: number | null;
  growth_7d_pct: number | null;
  growth_30d_pct: number | null;
  data_level: string;
  flags: string[];
  license: string | null;
  homepage: string | null;
  /** 首次收录日 / 出道天数（新秀口径） */
  first_listed: string | null;
  age_days: number | null;
  /** 定价与约束：未核验不包含价格数字 */
  plan: PlanInfo;
  metrics: {
    stars: number | null;
    forks: number | null;
    contributors: number | null;
    installs: number | null;
    activity: number | null;
    last_release: string | null;
    last_commit: string | null;
    version: string | null;
    version_at: string | null;
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
    delta_7d: r.delta_7d ?? null,
    installs_delta_7d: r.installs_delta_7d ?? null,
    installs_delta_30d: r.installs_delta_30d ?? null,
    growth_7d_pct: r.growth_7d_pct ?? null,
    growth_30d_pct: r.growth_30d_pct ?? null,
    data_level: r.data_level,
    flags: r.flags ?? [],
    license: meta[r.slug]?.license ?? null,
    homepage: meta[r.slug]?.homepage ?? null,
    first_listed: r.first_listed ?? null,
    age_days: r.age_days ?? null,
    plan: planFor(r.slug, meta[r.slug]?.license, meta[r.slug]?.homepage),
    metrics: {
      stars: r.metrics?.stars ?? null,
      forks: r.metrics?.forks ?? null,
      contributors: r.metrics?.contributors ?? null,
      installs: r.metrics?.installs ?? null,
      activity: r.metrics?.activity ?? null,
      last_release: r.metrics?.last_release ? String(r.metrics.last_release).slice(0, 10) : null,
      last_commit: r.metrics?.last_commit ? String(r.metrics.last_commit).slice(0, 10) : null,
      version: r.metrics?.version ?? null,
      version_at: r.metrics?.version_at ? String(r.metrics.version_at).slice(0, 10) : null,
    },
  }));
  return {
    meta: {
      site: SITE,
      /** 公开字段契约版本：新增字段不改此值，删字段/改语义才加 */
      schema_version: 1,
      date: data?.date ?? null,
      score_version: data?.version ?? null,
      /** 历史里出现过的打分口径（v1 早期日期、v2 当前） */
      score_versions: [...new Set(all.map((d) => d.version))].sort(),
      per_date_version: Object.fromEntries(all.map((d) => [d.date, d.version])),
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

/** 周档 / 月档归档（pipeline 每周日 / 每月末冻结） */
export function buildArchivesExport() {
  const all = loadArchives();
  return {
    meta: {
      site: SITE,
      pattern: '/data/archive/{label}.json',
      count: all.length,
      note: 'Frozen on the period end (Sunday / month end). Same row schema as /data/scores.json.',
    },
    archives: all.map((a) => ({
      label: a.label,
      period: a.period,
      end: a.end,
      score_version: a.version,
      rows: a.rows.length,
      ranked: a.rows.filter((r) => r.score != null).length,
      url: `/data/archive/${a.label}.json`,
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
    'delta_1d',
    'delta_7d',
    'installs_delta_7d',
    'installs_delta_30d',
    'growth_7d_pct',
    'growth_30d_pct',
    'data_level',
    'license',
    'last_release',
    'last_commit',
    'version',
    'first_listed',
    'age_days',
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
      r.delta_1d,
      r.delta_7d,
      r.installs_delta_7d,
      r.installs_delta_30d,
      r.growth_7d_pct,
      r.growth_30d_pct,
      r.data_level,
      r.license,
      r.metrics.last_release,
      r.metrics.last_commit,
      r.metrics.version,
      r.first_listed,
      r.age_days,
      r.flags.join('|'),
    ]
      .map(esc)
      .join(','),
  );
  return `${[head.join(','), ...lines].join('\n')}\n`;
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=600, must-revalidate',
};

export const JSON_HEADERS = jsonHeaders;
