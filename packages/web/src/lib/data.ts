import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { ScoreRow } from '@agentnews/core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const DATA_DIR = join(ROOT, 'data');
const AGENTS_YAML = join(ROOT, 'agents.yaml');

export type ScoreFile = { date: string; version: string; rows: ScoreRow[] };
export type ArchiveFile = {
  period: 'week' | 'month';
  label: string;
  end: string;
  version: string;
  rows: ScoreRow[];
};

/** 读最新评分快照（构建时） */
export function loadLatestScores(): ScoreFile | null {
  const dir = join(DATA_DIR, 'scores');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) return null;
  const latest = files[files.length - 1]!;
  try {
    return JSON.parse(readFileSync(join(dir, latest), 'utf8')) as ScoreFile;
  } catch {
    return null;
  }
}

/** 读所有历史评分快照（按日期倒序） */
export function loadAllScores(): ScoreFile[] {
  const dir = join(DATA_DIR, 'scores');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8')) as ScoreFile;
      } catch {
        return null;
      }
    })
    .filter((x): x is ScoreFile => x != null);
}

export type HistoryPoint = {
  date: string;
  score: number | null;
  stars: number | null;
  rank_in_form: number | null;
};

/** 单个 agent 的历史序列（按日期升序）—— 详情页趋势图用 */
export function loadHistory(slug: string): HistoryPoint[] {
  return loadAllScores()
    .slice()
    .reverse()
    .map((f) => {
      const r = f.rows.find((x) => x.slug === slug);
      return {
        date: f.date,
        score: r?.score ?? null,
        stars: r?.metrics?.stars ?? null,
        rank_in_form: r?.rank_in_form ?? null,
      };
    });
}

/** 每日快照的在榜数 / 收录数（按日期升序）—— 归档页折线图用 */
export function loadDailyCounts(): Array<{ date: string; ranked: number; listed: number }> {
  return loadAllScores()
    .slice()
    .reverse()
    .map((f) => ({
      date: f.date,
      ranked: f.rows.filter((r) => r.rank_in_form != null).length,
      listed: f.rows.length,
    }));
}

/** 读所有归档（周档 + 月档，按结束日倒序） */
export function loadArchives(): ArchiveFile[] {
  const dir = join(DATA_DIR, 'archive');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8')) as ArchiveFile;
      } catch {
        return null;
      }
    })
    .filter((x): x is ArchiveFile => x != null);
}

/** 读单个归档 */
export function loadArchive(label: string): ArchiveFile | null {
  const p = join(DATA_DIR, 'archive', `${label}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as ArchiveFile;
  } catch {
    return null;
  }
}

/* ───────────────── Agent 元信息 / 图标 ───────────────── */

export type AgentMeta = {
  name: string;
  vendor: string | null;
  homepage: string | null;
  license: string | null;
  note: string | null;
  sources: Array<{ kind: string; identifier: string; is_primary?: boolean }>;
  /** 主图标地址：优先 GitHub 组织头像，其次官网 favicon */
  icon: string | null;
  /** 主图标加载失败时的备选（favicon 服务之间互为兜底） */
  iconFallback: string | null;
};

let _agentsMeta: Record<string, AgentMeta> | null = null;

/**
 * 从 agents.yaml 读取展示元信息（构建时一次性读取）。
 * 图标策略：
 * - 有 GitHub 渠道 → 用 owner 头像（GitHub 上的真实 logo，最可靠）
 * - 闭源 / 无 GitHub → 用官网 favicon（DDG 为主，Google 兜底）
 * - 都没有 → 前端渲染 slug 首字母色块
 */
export function loadAgentsMeta(): Record<string, AgentMeta> {
  if (_agentsMeta) return _agentsMeta;
  const out: Record<string, AgentMeta> = {};
  if (!existsSync(AGENTS_YAML)) return (_agentsMeta = out);
  try {
    const list = parse(readFileSync(AGENTS_YAML, 'utf8')) as Array<{
      slug?: string;
      name?: string;
      vendor?: string;
      homepage?: string;
      license_id?: string;
      note?: string;
      sources?: Array<{ kind?: string; identifier?: string; is_primary?: boolean }>;
    }>;
    for (const a of list ?? []) {
      if (!a?.slug) continue;
      const gh = a.sources?.find((s) => s.kind === 'github' && s.identifier);
      const owner = gh?.identifier?.split('/')[0];
      let hostname: string | null = null;
      try {
        hostname = a.homepage ? new URL(a.homepage).hostname : null;
      } catch {
        hostname = null;
      }
      const icon = owner
        ? `https://github.com/${owner}.png?size=96`
        : hostname
          ? `https://icons.duckduckgo.com/ip3/${hostname}.ico`
          : null;
      const iconFallback =
        !owner && hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64` : null;
      out[a.slug] = {
        name: a.name ?? a.slug,
        vendor: a.vendor ?? null,
        homepage: a.homepage ?? null,
        license: a.license_id && a.license_id !== 'unknown' ? a.license_id : null,
        note: a.note ?? null,
        sources: (a.sources ?? [])
          .filter((x) => x.kind && x.identifier)
          .map((x) => ({ kind: x.kind!, identifier: x.identifier!, is_primary: x.is_primary })),
        icon,
        iconFallback,
      };
    }
  } catch {
    // 解析失败 → 全部走字母色块兜底
  }
  return (_agentsMeta = out);
}

// 纯展示工具统一在 shared.ts（客户端 island 也要用，不能带 node 依赖）
export { fmt, fmtPct, fmtSigned, formLabel, bucketText, bucketBadgeClass, FORM_ORDER, GRANS, granLabel, defaultSortFor, rankUrl } from './shared';

/* ───────────────── 活动事件流（PRD F-24） ───────────────── */

export type AgentEvent = {
  slug: string;
  name: string;
  kind: 'release' | 'listed' | 'rank_jump' | 'newcomer' | 'license_change' | 'archived';
  date: string;
  title: string;
  detail?: string;
  from?: number;
  to?: number;
};

/** 读所有事件（按日期倒序） */
export function loadEvents(): AgentEvent[] {
  const dir = join(DATA_DIR, 'events');
  if (!existsSync(dir)) return [];
  const out: AgentEvent[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl')).sort().reverse()) {
    try {
      for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
        if (line.trim()) out.push(JSON.parse(line) as AgentEvent);
      }
    } catch {
      // 跳过损坏文件
    }
  }
  return out;
}

export const EVENT_LABEL: Record<AgentEvent['kind'], string> = {
  release: '发版',
  listed: '新收录',
  rank_jump: '排名变化',
  newcomer: '新秀',
  license_change: 'License',
  archived: '归档',
};

/** 读首次收录状态 */
export function loadAgentState(): { started_at: string; agents: Record<string, { first_listed: string; last_seen: string }> } | null {
  const p = join(DATA_DIR, 'agents-state.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/* ───────────────── 安全公告（PRD F-26） ───────────────── */

export type SecurityInfo = {
  package: string;
  ecosystem: string;
  advisories: number;
  malicious: number;
  latest: string | null;
  url: string;
};

export function loadSecurity(): { date: string; subjects: Record<string, SecurityInfo> } | null {
  const dir = join(DATA_DIR, 'security');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) return null;
  try {
    return JSON.parse(readFileSync(join(dir, files[files.length - 1]!), 'utf8'));
  } catch {
    return null;
  }
}

/** 安全等级：仅用于视觉提示，不构成安全评级 */
export function securityLevel(s: SecurityInfo | undefined): 'none' | 'low' | 'high' {
  if (!s || s.advisories === 0) return 'none';
  if (s.malicious > 0) return 'high';
  return 'low';
}
