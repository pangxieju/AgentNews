import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScoreRow } from '@agentrank/core';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data');

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

/** 格式化数字（k/M 缩写，小于 1k 保留原值） */
export function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 10_000) return Math.round(n / 1_000) + 'k';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.round(n));
}

/** 格式化增速（+12.3%） */
export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const v = n * 100;
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
}

export const formLabel = (f: string): string =>
  ({ cli: 'CLI', 'ide-plugin': 'IDE 插件', 'ide-app': 'IDE 应用', desktop: '桌面', browser: '浏览器', framework: '框架', autonomous: '自主' })[f] ?? f;
