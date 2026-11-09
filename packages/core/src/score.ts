import type { Form, Metrics, OssBucket } from './schema.js';
import { activityScore, FLOOR, growthPct } from './growth.js';

/**
 * 综合分算法（PRD §5.3 / §5.2）
 * log 压缩 → 组内（同 form）分位数归一 → 缺失权重重分配 → 加权求和
 *
 * 参与打分的指标分为两类：
 * - 原始量（stars/forks/contributors/installs/ecosystem）：log 压缩后归一
 * - 派生量（star_growth_30d/activity）：本身已是有界量，直接归一或直接用
 */

export type ScoreMetricKey =
  | 'stars'
  | 'forks'
  | 'contributors'
  | 'installs'
  | 'ecosystem'
  | 'star_growth_30d'
  | 'activity';

export type Weights = Partial<Record<ScoreMetricKey, number>>;

export const DEFAULT_WEIGHTS: Weights = {
  stars: 0.2,
  star_growth_30d: 0.25,
  activity: 0.15,
  installs: 0.2,
  contributors: 0.1,
  ecosystem: 0.05,
  forks: 0.05,
};

/** 量级跨度大的原始量需要 log 压缩；有界派生量不压缩 */
const COMPRESS_KEYS = new Set<ScoreMetricKey>([
  'stars',
  'forks',
  'contributors',
  'installs',
  'ecosystem',
]);

/** log 压缩：抑制数量级差距（800 star 与 200k star 不可线性比较） */
export function compress(x: number): number {
  return Math.log10(1 + Math.max(0, x));
}

/**
 * 组内分位数排名 ∈ (0,1)，使用「秩中点平滑」：
 *   (midRank + 0.5) / n
 * 为什么不平滑成 lo/(n-1)（即最小=0、最大=1）：
 * 小组（n=3）时会退化成 {0, 0.5, 1}，星数最少的项目直接拿 0 分，
 * 看起来像 bug。平滑后得到 {0.167, 0.5, 0.833}，保留相对顺序且不极端。
 */
export function percentileRank(values: number[]): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return values.map((v) => {
    const lo = sorted.findIndex((s) => s >= v);
    const hi = sorted.findLastIndex((s) => s <= v);
    const midRank = (lo + hi) / 2; // 0-based，平局取中点
    return (midRank + 0.5) / n;
  });
}

export function normalizeGroup(items: { slug: string; value: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  if (items.length === 0) return out;
  const ranks = percentileRank(items.map((i) => i.value));
  items.forEach((item, i) => out.set(item.slug, ranks[i] ?? 0));
  return out;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** 安装量：取最佳可得渠道（周下载优先，其次月/4，商店 install 兜底） */
export function effectiveInstalls(m: Metrics): number | null {
  if (num(m.npm_weekly_dl) != null) return num(m.npm_weekly_dl);
  if (num(m.npm_monthly_dl) != null) return Math.round((num(m.npm_monthly_dl)! / 30) * 7);
  if (num(m.pypi_monthly_dl) != null) return Math.round((num(m.pypi_monthly_dl)! / 30) * 7);
  if (num(m.vscode_installs) != null) return num(m.vscode_installs);
  return null;
}

export type Scorable = {
  slug: string;
  form: Form;
  oss_bucket: OssBucket;
  metrics: Metrics;
  /** 参考历史值：t-7 / t-30（由 pipeline 从历史快照解析） */
  ref?: {
    prev?: Metrics;
    weekAgo?: Metrics;
    monthAgo?: Metrics;
  };
};

/** 取某项指标的分值（未压缩的原始语义），派生量在此计算 */
export function valueFor(item: Scorable, key: ScoreMetricKey, now: Date): number | null {
  const m = item.metrics;
  switch (key) {
    case 'stars': return num(m.stars);
    case 'forks': return num(m.forks);
    case 'contributors': return num(m.contributors);
    case 'installs': return effectiveInstalls(m);
    case 'ecosystem': return num(m.discord_members);
    case 'star_growth_30d': {
      const g = growthPct(num(m.stars), num(item.ref?.monthAgo?.stars), FLOOR.month);
      return g;
    }
    case 'activity': {
      return activityScore(str(m.last_commit), str(m.last_release), now);
    }
  }
}

export type ScoreResult = { slug: string; score: number }[];

/**
 * 对一个组（同 form）打分，score ∈ [0,100]
 * 组内 < 2 项 → 全 0（无法算分位数，调用方应把该组并入「无分」处理）
 */
export function scoreGroup(
  items: Scorable[],
  weights: Weights = DEFAULT_WEIGHTS,
  now: Date = new Date(),
): ScoreResult {
  if (items.length < 2) return items.map((i) => ({ slug: i.slug, score: 0 }));
  const keys = Object.keys(weights) as ScoreMetricKey[];

  // 1. 每个指标：组内归一（缺失者不入组）
  const normCache = new Map<ScoreMetricKey, Map<string, number>>();
  for (const key of keys) {
    if (!(weights[key] ?? 0)) continue;
    const present: { slug: string; value: number }[] = [];
    for (const item of items) {
      const v = valueFor(item, key, now);
      if (v != null && Number.isFinite(v)) {
        present.push({ slug: item.slug, value: COMPRESS_KEYS.has(key) ? compress(v) : v });
      }
    }
    normCache.set(key, normalizeGroup(present));
  }

  // 2. 逐项：缺失权重重分配后加权求和
  const out: ScoreResult = [];
  for (const item of items) {
    let sum = 0;
    let wsum = 0;
    for (const key of keys) {
      const n = normCache.get(key)?.get(item.slug);
      if (n == null) continue;
      sum += (weights[key] ?? 0) * n;
      wsum += weights[key] ?? 0;
    }
    const score = wsum > 0 ? (sum / wsum) * 100 : null;
    out.push({ slug: item.slug, score: score == null ? 0 : Math.round(score * 10) / 10 });
  }
  return out;
}
