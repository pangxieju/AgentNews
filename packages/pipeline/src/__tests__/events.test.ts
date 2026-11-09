import { describe, expect, it } from 'vitest';
import type { Metrics, ScoreRow } from '@agentnews/core';
import { diffEvents } from '../events.js';

function row(slug: string, over: Partial<ScoreRow> = {}): ScoreRow {
  return {
    slug,
    name: slug.toUpperCase(),
    form: 'cli',
    oss_bucket: 'open',
    score: 50,
    rank_in_form: 1,
    delta_1d: null,
    delta_7d: null,
    delta_30d: null,
    growth_7d_pct: null,
    growth_30d_pct: null,
    metrics: {
      stars: 1000,
      forks: 100,
      contributors: 10,
      installs: null,
      activity: 1,
      last_release: '2026-11-01',
      version: '1.0.0',
      version_at: '2026-11-01T00:00:00Z',
      version_source: 'npm',
    },
    age_days: 500,
    first_listed: '2026-11-09',
    data_level: 'L2',
    flags: [],
    score_version: 'v1',
    ...over,
  };
}

describe('diffEvents', () => {
  it('首次运行（无基线）不产生任何事件', () => {
    const events = diffEvents('2026-11-09', [row('a'), row('b')], null, null);
    expect(events).toEqual([]);
  });

  it('新收录：仅产生 listed 事件（不得误报 release）', () => {
    const events = diffEvents('2026-11-10', [row('a'), row('new')], [row('a')], {
      a: { last_release: '2026-11-01' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ slug: 'new', kind: 'listed' });
  });

  it('通道切换（release 从无到有）不得产生发版事件', () => {
    // 上一轮走 ungh（无 last_release），本轮走 API（有值）
    const prev: Record<string, Metrics> = { a: {} };
    const events = diffEvents('2026-11-10', [row('a')], [row('a')], prev);
    expect(events.some((e) => e.kind === 'release')).toBe(false);
  });

  it('发版：last_release 前后都有值且不同才产生事件', () => {
    const prev: Record<string, Metrics> = { a: { last_release: '2026-11-01' } };
    // 没变化 → 无事件
    expect(diffEvents('2026-11-10', [row('a')], [row('a')], prev)).toEqual([]);
    // 有变化 → release 事件
    const changed = row('a', {
      metrics: { ...row('a').metrics, last_release: '2026-11-09' },
    });
    const events = diffEvents('2026-11-10', [changed], [row('a')], prev);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'release', detail: '2026-11-09' });
  });

  it('排名跃迁 ≥5 位才记录', () => {
    const prevRow = row('a', { rank_in_form: 10 });
    const jumped = row('a', { rank_in_form: 5 }); // 升 5 位
    const events = diffEvents('2026-11-10', [jumped], [prevRow], { a: {} });
    expect(events.some((e) => e.kind === 'rank_jump')).toBe(true);

    const small = row('a', { rank_in_form: 8 }); // 升 2 位
    const none = diffEvents('2026-11-10', [small], [prevRow], { a: {} });
    expect(none.some((e) => e.kind === 'rank_jump')).toBe(false);
  });

  it('新秀：从无到有 newcomer 标记', () => {
    const events = diffEvents(
      '2026-11-10',
      [row('a', { flags: ['newcomer'] })],
      [row('a', { flags: [] })],
      { a: {} },
    );
    expect(events.some((e) => e.kind === 'newcomer')).toBe(true);
  });

  it('L3 无数据条目不会因 rank 变化产生事件', () => {
    const prevRow = row('a', { rank_in_form: 10 });
    const cur = row('a', { rank_in_form: null, score: null, data_level: 'L3' });
    const events = diffEvents('2026-11-10', [cur], [prevRow], { a: {} });
    expect(events.some((e) => e.kind === 'rank_jump')).toBe(false);
  });
});
