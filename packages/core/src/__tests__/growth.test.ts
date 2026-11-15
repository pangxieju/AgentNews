import { describe, expect, it } from 'vitest';
import {
  absoluteDelta,
  activityScore,
  DORMANT_DAYS,
  dataLevel,
  growthPct,
  isDormant,
} from '../growth.js';

describe('absoluteDelta', () => {
  it('增量 = now - then', () => {
    expect(absoluteDelta(200, 150)).toBe(50);
  });
  it('缺任一 → null', () => {
    expect(absoluteDelta(null, 150)).toBeNull();
    expect(absoluteDelta(200, undefined)).toBeNull();
  });
});

describe('growthPct', () => {  it('相对增速', () => {
    expect(growthPct(200, 100, 50)).toBe(1);
  });
  it('基准低于 FLOOR → null（防小基数抖动）', () => {
    expect(growthPct(100, 5, 50)).toBeNull(); // 5→100 是 1900%，不可信
  });
  it('基准为 0 → null', () => {
    expect(growthPct(100, 0, 50)).toBeNull();
  });
  it('缺值 → null', () => {
    expect(growthPct(null, 100, 50)).toBeNull();
  });
});

describe('activityScore', () => {
  const now = new Date('2025-10-19T00:00:00Z');
  it('今天有提交 + 90 天内发版 → 接近满分', () => {
    const s = activityScore('2025-10-18', '2025-10-01', now);
    expect(s).toBeGreaterThan(0.9);
  });
  it('无任何提交/发版 → 0', () => {
    expect(activityScore(null, null, now)).toBe(0);
  });
  it('半年无提交但 90 天内发版 → 低活跃', () => {
    const s = activityScore('2025-04-01', '2025-08-01', now);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.8);
  });
});

describe('dataLevel', () => {
  it('有 star + 有安装 → L1', () => {
    expect(dataLevel(10_000, 50_000)).toBe('L1');
  });
  it('只有 star → L2', () => {
    expect(dataLevel(10_000, null)).toBe('L2');
  });
  it('全缺 → L3', () => {
    expect(dataLevel(null, null)).toBe('L3');
  });
});

describe('isDormant（PRD §4.4 活跃闸门）', () => {
  const now = new Date('2026-11-12T00:00:00Z');
  it('近 180 天有提交 → 清醒', () => {
    expect(isDormant('2026-11-01T00:00:00Z', null, now)).toBe(false);
  });
  it('提交和发版都超过 180 天 → 停更', () => {
    expect(isDormant('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', now)).toBe(true);
  });
  it('发版新、提交旧 → 以最新时间为准，不算停更', () => {
    expect(isDormant('2025-01-01T00:00:00Z', '2026-10-01T00:00:00Z', now)).toBe(false);
  });
  it('两个时间戳都缺失 → 无法判定，不标记', () => {
    expect(isDormant(null, null, now)).toBe(false);
  });
  it('边界：恰好 180 天内仍算清醒', () => {
    const exactly = new Date(now.getTime() - (DORMANT_DAYS - 1) * 86_400_000).toISOString();
    expect(isDormant(exactly, null, now)).toBe(false);
  });
});
