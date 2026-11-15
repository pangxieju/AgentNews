import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScoreRow } from '@agentnews/core';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const DATA_DIR = join(ROOT, 'data');
const AGENTS_YAML = join(ROOT, 'agents.yaml');
const ICONS_MANIFEST = join(DATA_DIR, 'icons.json');
const ICONS_DIR = join(ROOT, 'packages', 'web', 'public', 'icons');

const SCORES_DIR = join(DATA_DIR, 'scores');
const ARCHIVE_DIR = join(DATA_DIR, 'archive');
const SNAPSHOT_DIR = join(DATA_DIR, 'snapshots');
const EVENTS_DIR = join(DATA_DIR, 'events');
const SECURITY_DIR = join(DATA_DIR, 'security');

/** 读 JSON 文件；不存在 / 解析失败 → null */
function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** 目录下文件名排序后的末尾一个；目录不存在或为空 → null */
function latestFile(dir: string, ext = '.json'): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(ext)).sort();
  return files.length ? files[files.length - 1]! : null;
}

/** 读目录下全部 JSON（按文件名排序，desc=true 时最新在前），跳过解析失败的 */
function readJsonDir<T>(dir: string, desc = false): T[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (desc) files.reverse();
  return files.map((f) => readJson<T>(join(dir, f))).filter((x): x is T => x != null);
}

type ScoreFile = { date: string; version: string; rows: ScoreRow[] };

/** 读最新评分快照（构建时） */
export function loadLatestScores(): ScoreFile | null {
  const f = latestFile(SCORES_DIR);
  return f ? readJson<ScoreFile>(join(SCORES_DIR, f)) : null;
}

/** 读所有历史评分快照（按日期倒序）。构建期内只读盘一次：583 页都会调它 */
let _allScores: ScoreFile[] | null = null;
let _allScoresKey = '';
export function loadAllScores(): ScoreFile[] {
  // 按目录里最新的文件名做失效：dev 下新增快照时自动重读
  const key = latestFile(SCORES_DIR) ?? '';
  if (_allScores && key === _allScoresKey) return _allScores;
  _allScores = readJsonDir<ScoreFile>(SCORES_DIR, true);
  _allScoresKey = key;
  return _allScores;
}

type ArchiveFile = {
  period: 'week' | 'month';
  label: string;
  end: string;
  version: string;
  rows: ScoreRow[];
};

/** 读所有归档（周档 / 月档，按结束日倒序） */
export function loadArchives(): ArchiveFile[] {
  return readJsonDir<ArchiveFile>(ARCHIVE_DIR, true);
}

/** 读单个归档（label 如 2026-W46 / 2026-11） */
export function loadArchive(label: string): ArchiveFile | null {
  return readJson<ArchiveFile>(join(ARCHIVE_DIR, `${label}.json`));
}

type HistoryPoint = {
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

/* ───────────────── 版本历史 ───────────────── */

type VersionEntry = {
  date: string;
  version: string;
  version_at: string | null;
  source: string | null;
};

let _versions: Record<string, VersionEntry[]> | null = null;

/**
 * 从每日快照里还原版本变更（只保留版本号变化的那几天）。
 * 一次解析全部快照并缓存，避免每个详情页重复读盘。
 */
export function loadVersionHistory(slug: string): VersionEntry[] {
  if (!_versions) {
    const out: Record<string, VersionEntry[]> = {};
    if (existsSync(SNAPSHOT_DIR)) {
      for (const f of readdirSync(SNAPSHOT_DIR).filter((x) => x.endsWith('.jsonl')).sort()) {
        const date = f.slice(0, 10);
        let raw = '';
        try {
          raw = readFileSync(join(SNAPSHOT_DIR, f), 'utf8');
        } catch {
          continue;
        }
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          let row: { slug?: string; metrics?: { version?: unknown; version_at?: unknown; version_source?: unknown } };
          try {
            row = JSON.parse(line);
          } catch {
            continue;
          }
          const v = row.metrics?.version;
          if (typeof v !== 'string' || !v || !row.slug) continue;
          let list = out[row.slug];
          if (!list) {
            list = [];
            out[row.slug] = list;
          }
          if (list.length && list[list.length - 1]!.version === v) continue;
          list.push({
            date,
            version: v,
            version_at: typeof row.metrics?.version_at === 'string' ? row.metrics.version_at : null,
            source: typeof row.metrics?.version_source === 'string' ? row.metrics.version_source : null,
          });
        }
      }
    }
    _versions = out;
  }
  return _versions[slug] ?? [];
}

/* ───────────────── Agent 元信息 / 图标 ───────────────── */

type AgentMeta = {
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

type IconManifest = Record<string, { file: string; source: string; w: number; h: number }>;
let _iconManifest: IconManifest | null = null;

/** 读 data/icons.json（由 pipeline 每日下载图标后生成） */
function loadIconManifest(): IconManifest {
  _iconManifest ??= readJson<IconManifest>(ICONS_MANIFEST) ?? {};
  return _iconManifest;
}

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
  if (!existsSync(AGENTS_YAML)) {
    _agentsMeta = out;
    return out;
  }
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
      // 优先用仓库里缓存的图标（pipeline 每日下载），没有再退回远程
      const cached = loadIconManifest()[a.slug];
      const cachedOk = cached ? existsSync(join(ICONS_DIR, cached.file)) : false;
      const remote = owner
        ? `https://github.com/${owner}.png?size=96`
        : hostname
          ? `https://icons.duckduckgo.com/ip3/${hostname}.ico`
          : null;
      const icon = cachedOk ? `/icons/${cached!.file}` : remote;
      const iconFallback =
        !cachedOk && !owner && hostname
          ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
          : null;
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
  _agentsMeta = out;
  return out;
}

export { fmt, fmtPct, fmtSigned } from './shared';

/* ───────────────── 活动事件流（PRD F-24） ───────────────── */

export type AgentEvent = {
  slug: string;
  name: string;
  kind: 'release' | 'version' | 'listed' | 'rank_jump' | 'newcomer' | 'license_change' | 'archived';
  date: string;
  title: string;
  detail?: string;
  from?: number;
  to?: number;
};

/** 读所有事件（按日期倒序） */
export function loadEvents(): AgentEvent[] {
  if (!existsSync(EVENTS_DIR)) return [];
  const out: AgentEvent[] = [];
  for (const f of readdirSync(EVENTS_DIR).filter((x) => x.endsWith('.jsonl')).sort().reverse()) {
    try {
      for (const line of readFileSync(join(EVENTS_DIR, f), 'utf8').split('\n')) {
        if (line.trim()) out.push(JSON.parse(line) as AgentEvent);
      }
    } catch {
      // 跳过损坏文件
    }
  }
  return out;
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
  const f = latestFile(SECURITY_DIR);
  return f ? readJson(join(SECURITY_DIR, f)) : null;
}

