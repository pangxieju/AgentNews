import type { Agent, Metrics, Source } from '@agentrank/core';

export type CollectorResult = {
  agent: Agent;
  metrics: Metrics;
  /** 采集失败的数据源，用于 partial_data flag */
  errors: string[];
};

export type GitHubMode = 'api' | 'ungh';

/** ungh.cc（unjs 提供的 GitHub 只读代理，无鉴权、无限流），作为 API 限流时的降级通道 */
async function collectGitHubViaUngh(repo: string): Promise<{
  stars: number; forks: number; open_issues: number | null;
  last_commit: string; last_release: string | null; repo_created: string | null;
}> {
  const res = await fetch(`https://ungh.cc/repos/${repo}`, { headers: { 'User-Agent': 'agentrank-m0' } });
  if (!res.ok) throw new Error(`ungh ${repo}: ${res.status}`);
  const data = (await res.json()) as {
    repo?: { stars: number; forks: number; pushedAt: string; createdAt?: string; repo?: string };
  };
  const r = data.repo;
  if (!r) throw new Error(`ungh ${repo}: empty`);
  return {
    stars: r.stars,
    forks: r.forks,
    open_issues: null,
    last_commit: r.pushedAt,
    last_release: null,
    repo_created: r.createdAt ?? null,
  };
}

/** GitHub REST：单 repo 基础指标（1 次请求/repo） */
export async function collectGitHub(repo: string, token?: string, mode: GitHubMode = 'api'): Promise<{
  stars: number; forks: number; open_issues: number | null;
  last_commit: string; last_release: string | null; repo_created: string | null;
}> {
  if (mode === 'ungh') return collectGitHubViaUngh(repo);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'agentrank-m0',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let repoRes: Response;
  try {
    repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  } catch {
    return collectGitHubViaUngh(repo);
  }
  // 限流 → 自动降级，不丢数据
  if (repoRes.status === 403) {
    console.warn(`  ↳ ${repo}: API 限流，降级 ungh`);
    return collectGitHubViaUngh(repo);
  }
  if (repoRes.status === 404) throw new Error(`github repo ${repo}: not-found(404)`);
  if (!repoRes.ok) throw new Error(`github repo ${repo}: ${repoRes.status}`);
  const repoData = (await repoRes.json()) as {
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    pushed_at: string;
    created_at: string;
    license?: { spdx_id: string } | null;
  };

  return {
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    open_issues: repoData.open_issues_count,
    last_commit: repoData.pushed_at,
    // M0：不发 releases 请求（限流）。last_release 待 T1 有 token 后补
    last_release: null,
    repo_created: repoData.created_at ?? null,
  };
}

/**
 * 贡献者数：per_page=1 + Link header 的 rel="last" 页号（1 次请求拿总数）
 * 需 API 通道（ungh 不提供），仅在 mode='api' 且额度充足时调用
 */
export async function collectContributors(repo: string, token?: string): Promise<number | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'agentrank-m0',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contributors?per_page=1&anon=true`, { headers });
    if (!res.ok) return null;
    const link = res.headers.get('link');
    if (!link) {
      // 无 Link 头 → 单页，直接数
      const arr = (await res.json()) as unknown[];
      return Array.isArray(arr) ? arr.length : null;
    }
    const m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** 最新 release 日期（1 次请求） */
export async function collectLatestRelease(repo: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'agentrank-m0',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
    if (!res.ok) return null;
    const d = (await res.json()) as { published_at?: string };
    return d.published_at ?? null;
  } catch {
    return null;
  }
}

/**
 * 探测 GitHub 剩余额度。
 * 无 token 时每小时只有 60 次，而每个 repo 需 3 次（repo+contributors+release），
 * 所以门槛必须按待采集 repo 数动态计算；额度不够就整轮走 ungh（只需 1 次/repo，且不占额度）。
 */
export async function githubQuota(token?: string): Promise<{ remaining: number; enough: boolean }> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'agentrank-m0' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch('https://api.github.com/rate_limit', { headers });
    if (!res.ok) return { remaining: 0, enough: false };
    const data = (await res.json()) as { resources: { core: { remaining: number } } };
    return { remaining: data.resources.core.remaining, enough: false };
  } catch {
    return { remaining: 0, enough: false };
  }
}

/** 兼容旧签名：返回是否足够采完 needRepos 个 repo（每个 3 次请求） */
export async function githubHasQuota(token?: string, needRepos = 0): Promise<boolean> {
  const { remaining } = await githubQuota(token);
  if (needRepos <= 0) return remaining >= 3;
  return remaining >= needRepos * 3;
}

/** npm：周/月下载量（无鉴权） */
export async function collectNpm(pkg: string): Promise<{
  npm_weekly_dl: number;
  npm_monthly_dl: number;
}> {
  const [weekly, monthly] = await Promise.all([
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`),
    fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`),
  ]);
  if (!weekly.ok || !monthly.ok) {
    throw new Error(`npm ${pkg}: ${weekly.status}/${monthly.status}`);
  }
  const w = (await weekly.json()) as { downloads: number };
  const m = (await monthly.json()) as { downloads: number };
  return { npm_weekly_dl: w.downloads, npm_monthly_dl: m.downloads };
}

/** PyPI：月下载量（pypistats 经常 429，带重试退避） */
export async function collectPypi(pkg: string, retries = 3): Promise<{ pypi_monthly_dl: number }> {
  let lastErr = '';
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(
        `https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/recent`,
        { headers: { 'User-Agent': 'agentrank-m0 (github.com/agentrank)' } },
      );
      if (res.status === 429 || res.status >= 500) {
        lastErr = `pypi ${pkg}: ${res.status}`;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`pypi ${pkg}: ${res.status}`);
      const data = (await res.json()) as { data: { last_month: number } };
      return { pypi_monthly_dl: data.data.last_month };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error(lastErr || `pypi ${pkg}: failed`);
}

/** VS Code Marketplace installs（非官方 API，低频） */
export async function collectVscode(extensionId: string): Promise<{ vscode_installs: number }> {
  const res = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json;api-version=3.0-preview.1' },
    body: JSON.stringify({
      filters: [{ criteria: [{ filterType: 7, value: extensionId }] }],
      flags: 914,
    }),
  });
  if (!res.ok) throw new Error(`vscode ${extensionId}: ${res.status}`);
  const data = (await res.json()) as {
    results: { extensions: { statistics?: { statisticName: string; value: number }[] }[] }[];
  };
  const stats = data.results?.[0]?.extensions?.[0]?.statistics ?? [];
  const installs = stats.find((s) => s.statisticName === 'install')?.value ?? 0;
  return { vscode_installs: installs };
}

/** 按 source.kind 分发采集 */
export async function collectAgent(
  agent: Agent,
  token?: string,
  ghMode: GitHubMode = 'api',
): Promise<CollectorResult> {
  const metrics: Metrics = {};
  const errors: string[] = [];

  // GitHub 只采主渠道（或唯一的 github source）
  const ghSources = agent.sources.filter((s) => s.kind === 'github');
  const ghPrimary = ghSources.find((s) => s.is_primary) ?? ghSources[0];
  if (ghPrimary) {
    try {
      const g = await collectGitHub(ghPrimary.identifier, token, ghMode);
      Object.assign(metrics, g);

      // API 通道才补 contributors / latest release（各 1 次请求，不浪费额度）
      if (ghMode === 'api') {
        const [contrib, release] = await Promise.all([
          collectContributors(ghPrimary.identifier, token),
          collectLatestRelease(ghPrimary.identifier, token),
        ]);
        if (contrib != null) metrics.contributors = contrib;
        if (release != null) metrics.last_release = release;
      }
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }

  const npmSources = agent.sources.filter((s) => s.kind === 'npm');
  const pypiSources = agent.sources.filter((s) => s.kind === 'pypi');
  const vscodeSources = agent.sources.filter((s) => s.kind === 'vscode');

  // npm：主渠道优先，否则第一个（不叠加，避免重复计数 PRD §4.5）
  const npmSrc: Source | undefined = npmSources.find((s) => s.is_primary) ?? npmSources[0];
  if (npmSrc) {
    try {
      const n = await collectNpm(npmSrc.identifier);
      Object.assign(metrics, n);
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }
  const pypiSrc = pypiSources.find((s) => s.is_primary) ?? pypiSources[0];
  if (pypiSrc) {
    try {
      const p = await collectPypi(pypiSrc.identifier);
      Object.assign(metrics, p);
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }
  const vscodeSrc = vscodeSources.find((s) => s.is_primary) ?? vscodeSources[0];
  if (vscodeSrc) {
    try {
      const v = await collectVscode(vscodeSrc.identifier);
      Object.assign(metrics, v);
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }

  return { agent, metrics, errors };
}
