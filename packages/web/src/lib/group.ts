import type { ScoreRow } from '@agentnews/core';
import {
  backlogPer1kStars,
  elapsedDays,
  forkStarPct,
  median,
  percentileRank,
} from '@agentnews/core';

/**
 * 组内位置（详情页「维护健康」+ 指标明细的分位列）
 *
 * 口径与综合分一致：只在同 form 内比较，用秩中点平滑的分位（core/score.ts percentileRank）。
 * 刻意不做跨 form 归一 —— 跨形态的「分位」是假的可比性（PRD §4.2）。
 * 缺数据不进组、不给 0 分：宁可显示「—」，也不把「未知」画成「很差」（PRD §5.7）。
 */

export type HealthKey =
  | 'stars'
  | 'forks'
  | 'contributors'
  | 'installs'
  | 'activity'
  | 'commit'
  | 'release'
  | 'backlog'
  | 'forkStar'
  | 'growth30';

type Def = {
  /** 原始值；缺数据 → null（不参与分位计算） */
  raw: (r: ScoreRow, now: Date) => number | null;
  /** 越大越好；false 表示越小越好（越新 / 积压越少），排位时取反 */
  higherBetter: boolean;
};

const DEFS: Record<HealthKey, Def> = {
  stars: { raw: (r) => r.metrics.stars ?? null, higherBetter: true },
  forks: { raw: (r) => r.metrics.forks ?? null, higherBetter: true },
  contributors: { raw: (r) => r.metrics.contributors ?? null, higherBetter: true },
  installs: { raw: (r) => r.metrics.installs ?? null, higherBetter: true },
  activity: {
    /** 没有提交也没有发版记录 = 「未知」，不是「活跃度为 0」 */
    raw: (r) =>
      r.metrics.last_commit || r.metrics.last_release ? (r.metrics.activity ?? null) : null,
    higherBetter: true,
  },
  growth30: { raw: (r) => r.growth_30d_pct ?? null, higherBetter: true },
  /** 最近提交 / 发版：天数越小越新 */
  commit: { raw: (r, now) => elapsedDays(r.metrics.last_commit, now), higherBetter: false },
  release: { raw: (r, now) => elapsedDays(r.metrics.last_release, now), higherBetter: false },
  backlog: {
    raw: (r) => backlogPer1kStars(r.metrics.open_issues, r.metrics.stars),
    higherBetter: false,
  },
  forkStar: { raw: (r) => forkStarPct(r.metrics.forks, r.metrics.stars), higherBetter: true },
};

export type Position = {
  /** 0..1，0.5 = 组内中位（越高越好，已按 higherBetter 换算） */
  p: number;
  /** 参与该项比较的组内对象数（含自己） */
  n: number;
};

export type GroupBoard = {
  /** 同形态收录对象数 */
  n: number;
  position(key: HealthKey, slug: string): Position | null;
  /** 组内中位（原始值口径，不是分位） */
  medianOf(key: HealthKey): number | null;
};

export function buildGroupBoard(rows: ScoreRow[], form: string, now: Date): GroupBoard {
  const peers = rows.filter((r) => r.form === form);

  const cache = new Map<
    HealthKey,
    { positions: Map<string, number>; n: number; median: number | null }
  >();

  for (const key of Object.keys(DEFS) as HealthKey[]) {
    const def = DEFS[key];
    const items: { slug: string; raw: number; rank: number }[] = [];
    for (const r of peers) {
      const raw = def.raw(r, now);
      if (raw == null || !Number.isFinite(raw)) continue;
      items.push({ slug: r.slug, raw, rank: def.higherBetter ? raw : -raw });
    }
    const pcts = percentileRank(items.map((i) => i.rank));
    cache.set(key, {
      positions: new Map(items.map((i, idx) => [i.slug, pcts[idx] ?? 0.5])),
      n: items.length,
      median: median(items.map((i) => i.raw)),
    });
  }

  return {
    n: peers.length,
    position(key, slug) {
      const c = cache.get(key);
      const p = c?.positions.get(slug);
      return p == null || c == null ? null : { p, n: c.n };
    },
    medianOf(key) {
      return cache.get(key)?.median ?? null;
    },
  };
}