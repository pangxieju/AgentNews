import { describe, expect, it } from 'vitest';
import { guessFormText, marketplaceUrl, normRepoUrl, parseMarketplace } from '../discover.js';

describe('normRepoUrl', () => {
  it('从 npm links.repository 的各种写法归一成 owner/repo', () => {
    expect(normRepoUrl('https://github.com/sst/opencode')).toBe('sst/opencode');
    expect(normRepoUrl('git+https://github.com/Aider-AI/aider.git')).toBe('Aider-AI/aider');
    expect(normRepoUrl('https://github.com/owner/repo.git')).toBe('owner/repo');
    expect(normRepoUrl('git://github.com/owner/repo.git#main')).toBe('owner/repo');
    expect(normRepoUrl('github:owner/repo')).toBe('owner/repo');
    expect(normRepoUrl('https://github.com/owner/repo/tree/main/packages/cli')).toBe('owner/repo');
  });

  it('非 GitHub / 空值 → 空串（不制造假 repo）', () => {
    expect(normRepoUrl('')).toBe('');
    expect(normRepoUrl(null)).toBe('');
    expect(normRepoUrl(undefined)).toBe('');
    expect(normRepoUrl('https://gitlab.com/owner/repo')).toBe('');
    expect(normRepoUrl('https://example.com/repo')).toBe('');
  });
});

describe('marketplaceUrl', () => {
  it('按 publisher.extension 生成商店页面（PRD §4.4 闭源落地页）', () => {
    expect(marketplaceUrl('GitHub.copilot')).toBe(
      'https://marketplace.visualstudio.com/items?itemName=GitHub.copilot',
    );
  });
});

describe('parseMarketplace', () => {
  it('拍平 results[].extensions[]，缺失结构不崩', () => {
    const body = {
      results: [
        {
          extensions: [
            { extensionName: 'copilot', displayName: 'GitHub Copilot', statistics: [{ statisticName: 'install', value: 42 }] },
          ],
        },
        { extensions: [{ extensionName: 'roo-code', displayName: 'Roo Code' }] },
      ],
    };
    const out = parseMarketplace(body);
    expect(out).toHaveLength(2);
    expect(out[0]?.displayName).toBe('GitHub Copilot');
    expect(out[1]?.extensionName).toBe('roo-code');
  });

  it('结构异常 → 空数组', () => {
    expect(parseMarketplace(null)).toEqual([]);
    expect(parseMarketplace({})).toEqual([]);
    expect(parseMarketplace({ results: 'nope' })).toEqual([]);
    expect(parseMarketplace({ results: [{}] })).toEqual([]);
  });
});

describe('guessFormText', () => {
  it('按描述关键词给出形态猜测（兜底 ? 不猜）', () => {
    expect(guessFormText('multi-agent orchestrator framework for python')).toBe('framework');
    expect(guessFormText('browser agent built on playwright')).toBe('browser');
    expect(guessFormText('VS Code extension for AI coding')).toBe('ide-plugin');
    expect(guessFormText('terminal coding agent for your shell')).toBe('cli');
    expect(guessFormText('a desk lamp')).toBe('?');
  });
});