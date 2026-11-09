import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScoreRow } from '@agentrank/core';

/** 数据根目录（仓库根 data/，从 web 包向上两级） */
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data');

export type ScoreFile = { date: string; version: string; rows: ScoreRow[] };

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
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8')) as ScoreFile;
      } catch {
        return null;
      }
    })
    .filter((x): x is ScoreFile => x != null);
}

/** 读 agents.yaml 附带的元数据（name/vendor/homepage 等，供详情页） */
export function loadAgentMeta() {
  const yamlPath = join(DATA_DIR, '..', 'agents.yaml');
  if (!existsSync(yamlPath)) return new Map<string, Record<string, unknown>>();
  // 简化：从快照里带 name（未来从 YAML 解析）
  return new Map();
}

/** 格式化数字（k/M 缩写） */
export function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.round(n));
}

/** 格式化增速（+12.3%） */
export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const v = n * 100;
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
}
