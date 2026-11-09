/**
 * 安全模块（PRD F-26 / F-27）
 *
 * 定位：只做公开公告聚合与标注，**不做安全评级、不做安全背书**。
 *
 * 数据源：OSV.dev（免费、无鉴权），一次 querybatch 批量查询所有包。
 * 输出：每个包的公告数与恶意包数，附 OSV 链接。
 * 不做的事：判断「是否已修复」（需要版本比对，误判成本高）。
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Agent } from '@agentnews/core';

export type SecurityInfo = {
  /** 被查询的包名 */
  package: string;
  ecosystem: string;
  /** 历史安全公告总数 */
  advisories: number;
  /** 其中恶意包公告（MAL-*）数量 */
  malicious: number;
  /** 最近一条公告的更新时间 */
  latest: string | null;
  /** OSV 包页链接 */
  url: string;
};

const ECOSYSTEM: Partial<Record<string, string>> = {
  npm: 'npm',
  pypi: 'PyPI',
  crates: 'crates.io',
};

/** 从 agents.yaml 的 sources 里挑出可查询 OSV 的包（每 agent 取第一个） */
export function pickSecurityTargets(agents: Agent[]): { slug: string; name: string; ecosystem: string }[] {
  const out: { slug: string; name: string; ecosystem: string }[] = [];
  for (const a of agents) {
    const src = a.sources.find((s) => ECOSYSTEM[s.kind]);
    if (!src) continue;
    out.push({ slug: a.slug, name: src.identifier, ecosystem: ECOSYSTEM[src.kind]! });
  }
  return out;
}

type OsvBatchResp = {
  results: { vulns?: { id: string; modified: string }[] }[];
};

/** 批量查询 OSV（一次请求覆盖所有包） */
export async function collectSecurity(
  targets: { slug: string; name: string; ecosystem: string }[],
): Promise<Record<string, SecurityInfo>> {
  if (!targets.length) return {};
  const res = await fetch('https://api.osv.dev/v1/querybatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'agentnews' },
    body: JSON.stringify({
      queries: targets.map((t) => ({ package: { name: t.name, ecosystem: t.ecosystem } })),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`osv: ${res.status}`);
  const data = (await res.json()) as OsvBatchResp;

  const out: Record<string, SecurityInfo> = {};
  targets.forEach((t, i) => {
    const vulns = data.results[i]?.vulns ?? [];
    const malicious = vulns.filter((v) => v.id.startsWith('MAL-')).length;
    const latest = vulns
      .map((v) => v.modified)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    out[t.slug] = {
      package: t.name,
      ecosystem: t.ecosystem,
      advisories: vulns.length,
      malicious,
      latest,
      url: osvPackageUrl(t.name, t.ecosystem),
    };
  });
  return out;
}

function osvPackageUrl(name: string, ecosystem: string): string {
  const eco = ecosystem === 'PyPI' ? 'PyPI' : ecosystem === 'npm' ? 'npm' : ecosystem;
  return `https://osv.dev/list?q=${encodeURIComponent(name)}&ecosystem=${encodeURIComponent(eco)}`;
}

export async function writeSecurity(dataDir: string, date: string, info: Record<string, SecurityInfo>) {
  const path = join(dataDir, 'security', `${date}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ date, subjects: info }, null, 2) + '\n');
  return path;
}
