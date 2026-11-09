import { describe, expect, it } from 'vitest';
import {
  compress,
  normalizeGroup,
  percentileRank,
  scoreGroup,
} from '../score.js';

describe('compress', () => {
  it('log 压缩抑制数量级差距', () => {
    expect(compress(0)).toBe(0);
    expect(compress(999)).toBeCloseTo(3, 0);
    expect(compress(999_999)).toBeCloseTo(6, 0); // 1000x 差距 → log 只有 3x
  });
});

describe('percentileRank', () => {
  it('空数组安全', () => {
    expect(percentileRank([])).toEqual([]);
  });
  it('平局取中间分位', () => {
    // 1,2,2,3 → 各分位：0, (1+2)/2/3=0.5, 0.5, 1
    expect(percentileRank([1, 2, 2, 3])).toEqual([0, 0.5, 0.5, 1]);
  });
  it('单元素组归一为 0（不除零）', () => {
    expect(percentileRank([42])).toEqual([0]);
  });
  it('单调递增序列', () => {
    expect(percentileRank([1, 2, 3])).toEqual([0, 0.5, 1]);
  });
});

describe('normalizeGroup', () => {
  it('返回每项 ∈[0,1]', () => {
    const m = normalizeGroup([
      { slug: 'a', value: 1 },
      { slug: 'b', value: 2 },
      { slug: 'c', value: 3 },
    ]);
    expect(m.get('a')).toBe(0);
    expect(m.get('b')).toBe(0.5);
    expect(m.get('c')).toBe(1);
  });
});

describe('scoreGroup', () => {
  const base = (slug: string, stars: number, extra: Record<string, number> = {}) => ({
    slug,
    form: 'cli' as const,
    oss_bucket: 'open' as const,
    metrics: { stars, ...extra },
  });

  it('少于 2 项 → 全 0（无法算分位数）', () => {
    const r = scoreGroup([base('a', 100)]);
    expect(r[0]!.score).toBe(0);
  });

  it('star 高者分高（单指标）', () => {
    const r = scoreGroup([
      base('small', 1_000),
      base('big', 200_000),
    ]);
    const bySlug = Object.fromEntries(r.map((x) => [x.slug, x.score]));
    expect(bySlug['big']!).toBeGreaterThan(bySlug['small']!);
  });

  it('缺失指标 → 权重重分配后仍可比（不全为 0）', () => {
    // 只有 stars，其他人有 stars + installs
    const r = scoreGroup([
      base('onlyStars', 100_000),
      base('full', 50_000, { npm_weekly_dl: 200_000 }),
      base('full2', 60_000, { npm_weekly_dl: 300_000 }),
    ]);
    const bySlug = Object.fromEntries(r.map((x) => [x.slug, x.score]));
    expect(bySlug['onlyStars']!).toBeGreaterThan(0);
  });

  it('分数范围 ∈[0,100]', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      base(`p${i}`, 1000 * (i + 1), { forks: i * 10 }),
    );
    for (const { score } of scoreGroup(items)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('新增超级项目不压低原有排名相对关系（分位数特性）', () => {
    const before = scoreGroup([
      base('mid', 5_000),
      base('top', 50_000),
      base('low', 500),
    ]);
    const after = scoreGroup([
      base('mid', 5_000),
      base('top', 50_000),
      base('low', 500),
      base('super', 2_000_000),
    ]);
    const order = (r: { slug: string; score: number }[], exclude: string[] = []) =>
      [...r]
        .filter((x) => !exclude.includes(x.slug))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.slug);
    // 新项目加入后，原有项目（top/mid/low）相对顺序必须不变
    expect(order(after, ['super'])).toEqual(order(before));
    // 且 super 必须排第一
    expect(order(after)).toEqual(['super', 'top', 'mid', 'low']);
  });
});
