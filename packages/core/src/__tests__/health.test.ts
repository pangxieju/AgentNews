import { describe, expect, it } from 'vitest';
import {
  backlogPer1kStars,
  elapsedDays,
  elapsedHours,
  forkStarPct,
  median,
  medianReleaseGapDays,
  parseTime,
  releasesWithinDays,
} from '../health.js';

const NOW = new Date('2026-11-10T12:00:00Z');

describe('parseTime', () => {
  it('接受 ISO 字符串', () => {
    expect(parseTime('2026-11-10T00:00:00Z')).toBe(Date.parse('2026-11-10T00:00:00Z'));
  });
  it('缺失 / 非法 / 空串 → null', () => {
    expect(parseTime(null)).toBeNull();
    expect(parseTime(undefined)).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parseTime('不是日期')).toBeNull();
  });
});

describe('elapsedHours / elapsedDays', () => {
  it('向下取整', () => {
    expect(elapsedHours('2026-11-10T10:30:00Z', NOW)).toBe(1);
    expect(elapsedDays('2026-11-08T11:00:00Z', NOW)).toBe(2);
  });
  it('未来时间按 0，不出现负数', () => {
    expect(elapsedHours('2026-11-11T00:00:00Z', NOW)).toBe(0);
    expect(elapsedDays('2026-11-20T00:00:00Z', NOW)).toBe(0);
  });
  it('缺失 → null', () => {
    expect(elapsedDays(null, NOW)).toBeNull();
    expect(elapsedHours(undefined, NOW)).toBeNull();
  });
});

describe('median', () => {
  it('奇数取中位', () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it('偶数取中间两数均值', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('空集 / 全非法 → null', () => {
    expect(median([])).toBeNull();
    expect(median([NaN, Infinity])).toBeNull();
  });
});

describe('medianReleaseGapDays', () => {
  it('三次发版 → 两个间隔的中位', () => {
    // 间隔 10 天、20 天 → 中位 15
    expect(
      medianReleaseGapDays(['2026-10-01T00:00:00Z', '2026-10-11T00:00:00Z', '2026-10-31T00:00:00Z']),
    ).toBe(15);
  });
  it('重复时间戳去重后不足 2 个 → null', () => {
    expect(medianReleaseGapDays(['2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'])).toBeNull();
  });
  it('不足 2 个时间 → null（累积中）', () => {
    expect(medianReleaseGapDays(['2026-10-01T00:00:00Z'])).toBeNull();
    expect(medianReleaseGapDays([])).toBeNull();
  });
  it('忽略非法条目', () => {
    expect(medianReleaseGapDays([null, '2026-10-01T00:00:00Z', 'bad', '2026-10-21T00:00:00Z'])).toBe(20);
  });
});

describe('releasesWithinDays', () => {
  it('只数窗口内（含边界），同一版本只算一次', () => {
    const times = [
      '2026-11-01T00:00:00Z', // 9.5 天前 → 算
      '2026-11-01T00:00:00Z', // 重复 → 不算
      '2026-09-01T00:00:00Z', // 太旧 → 不算
      '2026-12-01T00:00:00Z', // 未来 → 不算
    ];
    expect(releasesWithinDays(times, 30, NOW)).toBe(1);
  });
  it('无时间 → null（未知，不是 0）', () => {
    expect(releasesWithinDays([], 30, NOW)).toBeNull();
    expect(releasesWithinDays([null], 30, NOW)).toBeNull();
  });
});

describe('backlogPer1kStars', () => {
  it('每千 star 的 open issue 数', () => {
    expect(backlogPer1kStars(4230, 225739)).toBe(18.7);
  });
  it('star 低于门槛 → null（分母不可信）', () => {
    expect(backlogPer1kStars(30, 800)).toBeNull();
    expect(backlogPer1kStars(30, 800, 100)).toBe(37.5);
  });
  it('缺失 → null', () => {
    expect(backlogPer1kStars(null, 5000)).toBeNull();
    expect(backlogPer1kStars(10, null)).toBeNull();
  });
});

describe('forkStarPct', () => {
  it('百分比一位小数', () => {
    expect(forkStarPct(30475, 225739)).toBe(13.5);
  });
  it('star 为 0 / 缺失 → null', () => {
    expect(forkStarPct(10, 0)).toBeNull();
    expect(forkStarPct(null, 1000)).toBeNull();
  });
});