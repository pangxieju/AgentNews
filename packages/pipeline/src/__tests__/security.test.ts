import { describe, expect, it } from 'vitest';
import type { Agent } from '@agentrank/core';
import { pickSecurityTargets } from '../security.js';

function agent(slug: string, sources: Agent['sources']): Agent {
  return {
    slug,
    name: slug.toUpperCase(),
    form: 'cli',
    oss_bucket: 'open',
    license_id: 'MIT',
    sources,
  };
}

describe('pickSecurityTargets', () => {
  it('只挑可查询 OSV 的包管理渠道', () => {
    const targets = pickSecurityTargets([
      agent('a', [
        { kind: 'github', identifier: 'x/a', is_primary: true },
        { kind: 'npm', identifier: '@x/a', is_primary: false },
      ]),
    ]);
    expect(targets).toEqual([{ slug: 'a', name: '@x/a', ecosystem: 'npm' }]);
  });

  it('生态映射正确（PyPI / crates.io）', () => {
    const t = pickSecurityTargets([
      agent('p', [{ kind: 'pypi', identifier: 'pkg', is_primary: true }]),
      agent('c', [{ kind: 'crates', identifier: 'crate', is_primary: true }]),
    ]);
    expect(t.map((x) => x.ecosystem)).toEqual(['PyPI', 'crates.io']);
  });

  it('纯 github / manual 渠道的 agent 被跳过', () => {
    const t = pickSecurityTargets([
      agent('g', [{ kind: 'github', identifier: 'x/g', is_primary: true }]),
      agent('m', [{ kind: 'manual', identifier: 'x/m', is_primary: true }]),
    ]);
    expect(t).toEqual([]);
  });

  it('多渠道时取第一个可查询的（避免重复计数）', () => {
    const t = pickSecurityTargets([
      agent('multi', [
        { kind: 'github', identifier: 'x/m', is_primary: true },
        { kind: 'npm', identifier: 'npm-pkg', is_primary: false },
        { kind: 'pypi', identifier: 'pypi-pkg', is_primary: false },
      ]),
    ]);
    expect(t).toHaveLength(1);
    expect(t[0]!.ecosystem).toBe('npm');
  });
});
