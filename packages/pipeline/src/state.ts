/**
 * agent 首次收录状态（用于新秀榜口径，PRD §5.6）
 *
 * 为什么需要：只用 repo 创建时间判定「出道」会误判 —— 老组织开新项目、
 * 或把已有项目拆成新仓库，都会被算成老项目。真正的「首次入榜」时间必须自己记。
 *
 * 关键区分（避免全员新秀的 bug）：
 * - `started_at`：本系统开始运行的第一天
 * - 若某 agent 的 first_listed == started_at → 它在上线前就已存在，**不算新**
 * - 只有 first_listed > started_at 的，才是「上线后冒出来的新项目」
 *
 * 落盘位置：data/agents-state.json（随 git 提交，可审计）
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type AgentState = {
  /** 本系统首日运行日期（YYYY-MM-DD），一旦写入不再改变 */
  started_at: string;
  agents: Record<
    string,
    {
      /** 首次被 AgentRank 收录的日期，一旦写入不再改变 */
      first_listed: string;
      /** 最近一次成功采集到的日期 */
      last_seen: string;
    }
  >;
};

export function emptyState(today: string): AgentState {
  return { started_at: today, agents: {} };
}

export async function loadState(path: string): Promise<AgentState | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AgentState>;
    if (!parsed || typeof parsed.started_at !== 'string' || !parsed.agents) return null;
    return parsed as AgentState;
  } catch {
    return null;
  }
}

export async function saveState(path: string, state: AgentState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const agents = Object.fromEntries(
    Object.entries(state.agents).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(path, JSON.stringify({ started_at: state.started_at, agents }, null, 2) + '\n');
}

/**
 * 合并当日结果：新条目写入 first_listed，所有条目更新 last_seen。
 * 幂等 —— 重复运行同一天不会改变 first_listed，也不会改变 started_at。
 */
export function mergeState(prev: AgentState | null, slugs: string[], today: string): AgentState {
  const base: AgentState = prev ?? emptyState(today);
  const agents = { ...base.agents };
  for (const slug of slugs) {
    const existing = base.agents[slug];
    agents[slug] = {
      first_listed: existing?.first_listed ?? today,
      last_seen: today,
    };
  }
  return { started_at: base.started_at, agents };
}

/** 两个日期之间相差的天数（b - a） */
export function daysBetween(a: string, b: string): number {
  const ta = new Date(a + 'T00:00:00Z').getTime();
  const tb = new Date(b + 'T00:00:00Z').getTime();
  return Math.floor((tb - ta) / 86_400_000);
}

/**
 * 出道天数 = min(可用信号)
 * 信号 1：repo 创建至今
 * 信号 2：首次收录至今 —— **仅当 first_listed 晚于系统上线日**时才可用，
 *        否则「首次收录」只代表我们自己刚开始跑，不代表项目新。
 */
export function newcomerAgeDays(
  repoCreated: string | null,
  firstListed: string | null,
  startedAt: string | null,
  today: string,
): number | null {
  const ages: number[] = [];
  if (repoCreated) {
    const d = Math.floor(
      (new Date(today + 'T00:00:00Z').getTime() - new Date(repoCreated).getTime()) / 86_400_000,
    );
    if (Number.isFinite(d) && d >= 0) ages.push(d);
  }
  // 只有「上线之后才被收录」的项目，其 first_listed 才有意义
  if (firstListed && (!startedAt || firstListed > startedAt)) {
    ages.push(daysBetween(firstListed, today));
  }
  if (!ages.length) return null;
  return Math.min(...ages);
}
