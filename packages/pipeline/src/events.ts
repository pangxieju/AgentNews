/**
 * 事件流（PRD F-24 活动模块）
 *
 * 通过与上一个快照 diff 生成高价值事件，落盘 data/events/YYYY-MM-DD.jsonl。
 * 只收录 6 类信号，不收录 commit / issue / PR（噪声过大）。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Metrics, ScoreRow } from '@agentnews/core';

export type EventKind =
  | 'release'        // 发版
  | 'listed'         // 首次收录
  | 'rank_jump'      // 排名跃迁 ≥5 位
  | 'newcomer'       // 出道 ≤180 天
  | 'license_change' // License 变更
  | 'archived';      // 仓库归档

export type AgentEvent = {
  slug: string;
  name: string;
  kind: EventKind;
  date: string;
  title: string;
  detail?: string;
  /** 排名跃迁用：from → to */
  from?: number;
  to?: number;
};

const RANK_JUMP_THRESHOLD = 5;

/** 从上一个快照读取 metrics（用于比对 last_release 等） */
export async function readSnapshotMetrics(
  snapshotsDir: string,
  date: string,
): Promise<Record<string, Metrics> | null> {
  try {
    const raw = await readFile(join(snapshotsDir, `${date}.jsonl`), 'utf8');
    const out: Record<string, Metrics> = {};
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as { slug: string; metrics: Metrics };
      out[row.slug] = row.metrics ?? {};
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * 生成当日事件。
 * @param prevRows 上一次评分结果；null 表示首次运行（此时不产生 listed 事件）
 * @param prevMetrics 上一次快照的原始指标
 */
export function diffEvents(
  today: string,
  currRows: ScoreRow[],
  prevRows: ScoreRow[] | null,
  prevMetrics: Record<string, Metrics> | null,
): AgentEvent[] {
  // 首次运行：没有可比基线，不产生任何事件（否则会一次性刷出几十条假事件）
  if (prevRows == null && prevMetrics == null) return [];

  const events: AgentEvent[] = [];
  const prevBySlug = new Map((prevRows ?? []).map((r) => [r.slug, r]));
  const isFirstRun = prevRows == null;

  for (const row of currRows) {
    const prev = prevBySlug.get(row.slug);

    // 1. 首次收录（首次运行跳过，否则会一次性刷 60 条）
    if (!isFirstRun && !prev) {
      events.push({
        slug: row.slug,
        name: row.name,
        kind: 'listed',
        date: today,
        title: `新收录 ${row.name}`,
      });
    }

    // 2. 发版：last_release 变化（**必须前后都有值** —— 否则从 ungh 切到 API
    //    时，release 从「无」变「有」会被误判成 60 条假发版事件）
    const prevRel = prevMetrics?.[row.slug]?.last_release;
    const currRel = row.metrics.last_release;
    if (
      typeof prevRel === 'string' &&
      prevRel.length > 0 &&
      typeof currRel === 'string' &&
      currRel !== prevRel
    ) {
      events.push({
        slug: row.slug,
        name: row.name,
        kind: 'release',
        date: today,
        title: `${row.name} 发布新版本`,
        detail: currRel.slice(0, 10),
      });
    }

    // 3. 排名跃迁
    if (prev?.rank_in_form != null && row.rank_in_form != null) {
      const delta = prev.rank_in_form - row.rank_in_form;
      if (Math.abs(delta) >= RANK_JUMP_THRESHOLD) {
        events.push({
          slug: row.slug,
          name: row.name,
          kind: 'rank_jump',
          date: today,
          title: `${row.name} 排名 ${delta > 0 ? '上升' : '下降'} ${Math.abs(delta)} 位`,
          from: prev.rank_in_form,
          to: row.rank_in_form,
        });
      }
    }

    // 4. 新秀
    if (row.flags.includes('newcomer') && !prev?.flags.includes('newcomer')) {
      events.push({
        slug: row.slug,
        name: row.name,
        kind: 'newcomer',
        date: today,
        title: `${row.name} 首次进入新秀榜`,
        detail: row.age_days != null ? `出道 ${row.age_days} 天` : undefined,
      });
    }
  }

  return events;
}

/** 追加写入当日事件文件（幂等：同一天重跑会覆盖） */
export async function writeEvents(dir: string, date: string, events: AgentEvent[]): Promise<string> {
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${date}.jsonl`);
  await writeFile(path, events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''));
  return path;
}
