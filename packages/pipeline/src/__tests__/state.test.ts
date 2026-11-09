import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  emptyState,
  mergeState,
  newcomerAgeDays,
  type AgentState,
} from '../state.js';

describe('mergeState', () => {
  it('首次运行：写入 started_at 与 first_listed', () => {
    const s = mergeState(null, ['a', 'b'], '2026-11-09');
    expect(s.started_at).toBe('2026-11-09');
    expect(s.agents['a']).toEqual({ first_listed: '2026-11-09', last_seen: '2026-11-09' });
  });

  it('幂等：同一天重跑不改 first_listed 与 started_at', () => {
    const s1 = mergeState(null, ['a'], '2026-11-09');
    const s2 = mergeState(s1, ['a'], '2026-11-09');
    expect(s2).toEqual(s1);
  });

  it('后续新增条目：first_listed = 当天，且不覆盖原条目', () => {
    const s1 = mergeState(null, ['a'], '2026-11-09');
    const s2 = mergeState(s1, ['a', 'b'], '2026-12-01');
    expect(s2.started_at).toBe('2026-11-09'); // 上线日不变
    expect(s2.agents['a']!.first_listed).toBe('2026-11-09'); // 老条目不变
    expect(s2.agents['a']!.last_seen).toBe('2026-12-01');
    expect(s2.agents['b']!.first_listed).toBe('2026-12-01');
  });
});

describe('newcomerAgeDays —— 新秀口径核心', () => {
  it('上线前就存在的项目：不算新秀（用 repo 创建时间）', () => {
    // repo 创建于 2 年前，first_listed == started_at（上线当天收录）
    const age = newcomerAgeDays('2024-11-09', '2026-11-09', '2026-11-09', '2026-11-09');
    expect(age).toBe(730);
    expect(age!).toBeGreaterThan(180);
  });

  it('上线后才冒出来的项目：按收录时间算（这才是真新秀）', () => {
    // 系统 2026-01 上线；该项目 repo 创建于 3 年前（重建/fork 导致），10 天前才被收录
    const age = newcomerAgeDays('2023-01-01', '2026-10-30', '2026-01-01', '2026-11-09');
    expect(age).toBe(10);
  });

  it('repo 本身很新：取更小的那个', () => {
    const age = newcomerAgeDays('2026-10-01', '2026-11-09', '2026-11-09', '2026-11-09');
    expect(age).toBe(39);
  });

  it('无 repo 时间、且上线前已存在 → null（无法判断）', () => {
    expect(newcomerAgeDays(null, '2026-11-09', '2026-11-09', '2026-11-09')).toBeNull();
  });

  it('无 repo 时间、但上线后收录 → 按收录时间', () => {
    expect(newcomerAgeDays(null, '2026-10-30', '2026-01-01', '2026-11-09')).toBe(10);
  });

  it('完全没有时间信息 → null', () => {
    expect(newcomerAgeDays(null, null, '2026-11-09', '2026-11-09')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('跨月计算', () => {
    expect(daysBetween('2026-10-30', '2026-11-09')).toBe(10);
  });
  it('同一天为 0', () => {
    expect(daysBetween('2026-11-09', '2026-11-09')).toBe(0);
  });
});

describe('emptyState', () => {
  it('结构正确', () => {
    const s: AgentState = emptyState('2026-11-09');
    expect(s).toEqual({ started_at: '2026-11-09', agents: {} });
  });
});
