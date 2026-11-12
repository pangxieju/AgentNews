/**
 * 安装量历史回填（npm / PyPI 公开 API）。
 *
 * 为什么只回填安装量：GitHub star 没有官方的历史查询接口（拉 stargazers 时间戳
 * 在上万 star 规模下不可行），所以「周增量」用安装量口径，星标增量只能等快照自然积累。
 *
 * 输出与语义：
 * - weekly_1d_ago  = 以 t-1  为结束的 7 日窗口下载总和
 * - weekly_7d_ago  = 以 t-7  为结束的 7 日窗口下载总和
 * - weekly_30d_ago = 以 t-30 为结束的 7 日窗口下载总和
 * 三者都是「每周下载量」口径，与 effectiveInstalls 的 npm_weekly_dl 同单位。
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DAY = 86_400_000;
const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

type SourceLite = { kind: string; identifier: string; is_primary?: boolean };
type AgentLite = { slug: string; sources: SourceLite[] };

export type InstallHistoryRow = {
  installs_1d_ago: number | null;
  installs_7d_ago: number | null;
  installs_30d_ago: number | null;
  /** 数据来自哪个渠道，便于审计 */
  channel: 'npm' | 'pypi';
};

export type InstallHistory = {
  date: string;
  agents: Record<string, InstallHistoryRow>;
};

/**
 * 以 endDate 为结束的 7 日窗口总和。
 * 7 天里至少要有 5 天数据，否则返回 null —— 缺口太大时不臆造历史。
 */
export function weeklyWindowEnding(series: Map<string, number>, endDate: string): number | null {
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(end)) return null;
  let sum = 0;
  let seen = 0;
  for (let i = 0; i < 7; i++) {
    const v = series.get(iso(end - i * DAY));
    if (v == null) continue;
    sum += v;
    seen++;
  }
  return seen >= 5 ? sum : null;
}

async function fetchNpmSeries(pkg: string, start: string, end: string): Promise<Map<string, number>> {
  const res = await fetch(
    `https://api.npmjs.org/downloads/range/${start}:${end}/${encodeURIComponent(pkg)}`,
    { headers: { 'User-Agent': 'agentnews-m0 (github.com/pangxieju/AgentNews)' } },
  );
  if (!res.ok) throw new Error(`npm range ${pkg}: ${res.status}`);
  const data = (await res.json()) as { downloads?: { day: string; downloads: number }[] };
  const out = new Map<string, number>();
  for (const d of data.downloads ?? []) {
    if (typeof d.downloads === 'number') out.set(d.day, d.downloads);
  }
  return out;
}

async function fetchPypiSeries(pkg: string): Promise<Map<string, number>> {
  const res = await fetch(
    `https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/overall?mirrors=false`,
    { headers: { 'User-Agent': 'agentnews-m0 (github.com/pangxieju/AgentNews)' } },
  );
  if (!res.ok) throw new Error(`pypi stats ${pkg}: ${res.status}`);
  const data = (await res.json()) as { data?: { date: string; downloads: number }[] };
  const out = new Map<string, number>();
  for (const d of data.data ?? []) {
    if (typeof d.downloads === 'number') out.set(d.date, d.downloads);
  }
  return out;
}

/** 并发上限：公开 API 不宜打太猛 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * 采集所有有 npm / PyPI 渠道的 agent 的安装历史。
 * date 用北京时间当天；窗口结束日取 t-1（当天数据不完整）。
 */
export async function collectInstallHistory(agents: AgentLite[], date: string): Promise<InstallHistory> {
  const now = new Date(`${date}T00:00:00Z`).getTime();
  if (!Number.isFinite(now)) throw new Error(`invalid date: ${date}`);
  const start = iso(now - 40 * DAY);
  const end = iso(now - DAY);

  const targets = agents
    .map((a) => {
      const npm = a.sources.find((s) => s.kind === 'npm');
      if (npm) return { slug: a.slug, kind: 'npm' as const, identifier: npm.identifier };
      const pypi = a.sources.find((s) => s.kind === 'pypi');
      if (pypi) return { slug: a.slug, kind: 'pypi' as const, identifier: pypi.identifier };
      return null;
    })
    .filter((x): x is { slug: string; kind: 'npm' | 'pypi'; identifier: string } => x !== null);

  const rows = await mapLimit(targets, 6, async (t) => {
    try {
      const series =
        t.kind === 'npm'
          ? await fetchNpmSeries(t.identifier, start, end)
          : await fetchPypiSeries(t.identifier);
      if (series.size === 0) return null;
      const row: InstallHistoryRow = {
        installs_1d_ago: weeklyWindowEnding(series, iso(now - DAY)),
        installs_7d_ago: weeklyWindowEnding(series, iso(now - 7 * DAY)),
        installs_30d_ago: weeklyWindowEnding(series, iso(now - 30 * DAY)),
        channel: t.kind,
      };
      return { slug: t.slug, row };
    } catch (e) {
      console.warn(`[history] ${t.slug}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  });

  const out: InstallHistory = { date, agents: {} };
  for (const r of rows) {
    if (r) out.agents[r.slug] = r.row;
  }
  return out;
}

export async function writeInstallHistory(path: string, history: InstallHistory): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(history, null, 2) + '\n');
}

export { num };
