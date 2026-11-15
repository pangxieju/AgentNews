import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Agent,
  AgentsFileSchema,
  activityScore,
  dataLevel,
  effectiveInstalls,
  FLOOR,
  FORMS,
  growthPct,
  installsBasis,
  isDormant,
  type Metrics,
  SCORE_VERSION,
  type ScoreRow,
  scoreGroup,
} from '@agentnews/core';
import { parse } from 'yaml';
import { collectAgent, type GitHubMode, githubHasQuota } from './collectors/index.js';
import { diffEvents, readSnapshotMetrics, writeEvents } from './events.js';
import { collectInstallHistory, type InstallHistory, writeInstallHistory } from './history.js';
import { syncIcons } from './icons.js';
import { collectSecurity, pickSecurityTargets, writeSecurity } from './security.js';
import { loadState, mergeState, newcomerAgeDays, saveState } from './state.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const YAML_PATH = join(ROOT, 'agents.yaml');

/** 指标里的时间戳可能是 number/unknown，统一收敛成 string | null 再交给 isDormant */
const isoStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);

// 加载环境变量（Node 24 内置 loadEnvFile，无需 dotenv）
// 优先级：系统环境变量 > .env.local > .env
// 原理：loadEnvFile 不覆盖已存在的变量，所以先加载高优先级文件
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(ROOT, file));
  } catch {
    // 文件不存在 → 跳过
  }
}
const DATA_DIR = join(ROOT, 'data');

/** 业务日期 = 北京时间（UTC+8），不是 UTC。
 * 定时任务跑在北京时间凌晨 01:00（= UTC 前一天 17:00），
 * 快照/榜单/标记一律按「北京的天」命名，否则会错位一天。 */
function isoDate(d = new Date()): string {
  const cn = new Date(d.getTime() + 8 * 3_600_000);
  return cn.toISOString().slice(0, 10);
}

/** 从 YAML 加载并校验 agent 名单 */
export async function loadAgents(): Promise<Agent[]> {
  const raw = await readFile(YAML_PATH, 'utf8');
  const parsed = parse(raw);
  const result = AgentsFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`agents.yaml 校验失败:\n${issues}`);
  }
  return result.data;
}

/** 读取指定路径的评分快照（不存在 → null） */
async function readScoreFile(path: string): Promise<ScoreRow[] | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as { rows?: ScoreRow[] };
    return parsed.rows ?? null;
  } catch {
    return null;
  }
}

/** 聚合为评分输入：合并当日 + 参考历史 */
async function buildScorables(
  agents: Agent[],
  metricsMap: Map<string, Metrics>,
): Promise<Parameters<typeof scoreGroup>[0]> {
  const today = isoDate();
  const prev = await readSnapshotMetrics(join(DATA_DIR, 'snapshots'), prevDate(today));
  const weekAgo = await readSnapshotMetrics(join(DATA_DIR, 'snapshots'), daysAgo(today, 7));
  const monthAgo = await readSnapshotMetrics(join(DATA_DIR, 'snapshots'), daysAgo(today, 30));

  return agents.map((agent) => {
    const m = metricsMap.get(agent.slug) ?? {};
    return {
      slug: agent.slug,
      form: agent.form,
      oss_bucket: agent.oss_bucket,
      metrics: m,
      ref: {
        prev: prev?.[agent.slug] ?? {},
        weekAgo: weekAgo?.[agent.slug] ?? {},
        monthAgo: monthAgo?.[agent.slug] ?? {},
      },
    };
  });
}

function prevDate(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return isoDate(d);
}
function daysAgo(today: string, n: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}

/** 每日主入口 */
export async function runDaily(opts: { token?: string } = {}): Promise<{
  snapshotPath: string;
  scorePath: string;
  rows: ScoreRow[];
}> {
  const agents = await loadAgents();
  const today = isoDate();
  console.log(`[run] ${today} · ${agents.length} agents`);

  // 0. 图标缓存（下载到 packages/web/public/icons，随仓库发布）
  try {
    const r = await syncIcons(agents, {
      dir: join(ROOT, 'packages', 'web', 'public', 'icons'),
      manifestPath: join(DATA_DIR, 'icons.json'),
      concurrency: 6,
      log: (s) => console.log(`[icons]${s}`),
    });
    console.log(`[icons] ${r.ok}/${agents.length} 已缓存${r.failed.length ? `，失败：${r.failed.join(', ')}` : ''}`);
  } catch (e) {
    console.warn(`[icons] 同步失败（不影响采集）：${e instanceof Error ? e.message : e}`);
  }

  // 0. 首次收录状态（新秀榜口径，PRD §5.6）
  const statePath = join(DATA_DIR, 'agents-state.json');
  const statePrev = await loadState(statePath);
  const state = mergeState(statePrev, agents.map((a) => a.slug), today);
  await saveState(statePath, state);
  console.log(`[state] started_at=${state.started_at} · ${Object.keys(state.agents).length} agents`);

  // 上一次的评分与快照（用于事件 diff）
  const prevScoreDate = prevDate(today);
  const prevRows = await readScoreFile(join(DATA_DIR, 'scores', `${prevScoreDate}.json`));
  const prevMetrics = await readSnapshotMetrics(join(DATA_DIR, 'snapshots'), prevScoreDate);

  // 0. 选 GitHub 通道：额度够（3 次/repo）用官方 API（能拿 contributors + release），否则走 ungh
  const ghRepoCount = agents.filter((a) => a.sources.some((s) => s.kind === 'github')).length;
  const hasQuota = await githubHasQuota(opts.token, ghRepoCount);
  const ghMode: GitHubMode = hasQuota ? 'api' : 'ungh';
  console.log(
    `[run] GitHub 通道：${ghMode}` +
      (hasQuota ? `（额度充足，${ghRepoCount} repo × 3 请求）` : `（额度不足，降级 ungh）`),
  );

  // 1. 采集（串行跑，限流友好；后续可 p-limit 并行）
  const metricsMap = new Map<string, Metrics>();
  const errors: string[] = [];
  for (const agent of agents) {
    try {
      const r = await collectAgent(agent, opts.token, ghMode);
      metricsMap.set(agent.slug, r.metrics);
      if (r.errors.length) {
        console.warn(`  ! ${agent.slug}: ${r.errors.join('; ')}`);
        errors.push(...r.errors.map((e) => `${agent.slug}: ${e}`));
      } else {
        console.log(`  ✓ ${agent.slug}  stars=${r.metrics.stars ?? '-'}`);
      }
    } catch (e) {
      console.warn(`  ✗ ${agent.slug}: ${e instanceof Error ? e.message : e}`);
      metricsMap.set(agent.slug, {});
      errors.push(`${agent.slug}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 1.5 若无任何 star 数据（全 GitHub 失败），拒绝覆盖旧快照 —— 保留上次成功数据
  const anyStars = [...metricsMap.values()].some((m) => typeof m.stars === 'number');
  if (!anyStars) {
    console.error('[run] 本轮无任何 GitHub 数据，不写快照（保留上次成功数据）。请稍后重试或配置 GITHUB_TOKEN');
    return { snapshotPath: '', scorePath: '', rows: [] };
  }

  // 2. 落快照（原始指标）
  await mkdir(join(DATA_DIR, 'snapshots'), { recursive: true });
  const snapshotPath = join(DATA_DIR, 'snapshots', `${today}.jsonl`);
  const lines = agents.map((a) =>
    JSON.stringify({ slug: a.slug, form: a.form, oss_bucket: a.oss_bucket, metrics: metricsMap.get(a.slug) ?? {} }),
  );
  await writeFile(snapshotPath, `${lines.join('\n')}\n`);
  console.log(`[snapshot] ${lines.length} rows → ${snapshotPath}`);

  // 2.5 安装量历史（npm / PyPI 公开 API）—— 周榜用安装增量（star 历史无法合法回填）
  let installHistory: InstallHistory | null = null;
  try {
    installHistory = await collectInstallHistory(agents, today);
    const historyPath = join(DATA_DIR, 'history', `${today}.json`);
    await writeInstallHistory(historyPath, installHistory);
    console.log(
      `[history] ${Object.keys(installHistory.agents).length}/${agents.length} agents → data/history/${today}.json`,
    );
  } catch (e) {
    console.warn(`[history] 回填失败，继续（周榜会缺数据）：${e instanceof Error ? e.message : e}`);
  }

  // 3. 打分（按 form 分组）—— L3（无数据）不参与排名（PRD §5.7）
  const scorables = await buildScorables(agents, metricsMap);
  const agentName = new Map(agents.map((a) => [a.slug, a.name]));
  const rows: ScoreRow[] = [];

  // 一次算清所有 agent 的停更状态（之前在 form 循环里重算 9 遍）
  const now = new Date();
  const dormancy = new Map(
    scorables.map((s) => [
      s.slug,
      isDormant(isoStr(s.metrics.last_commit), isoStr(s.metrics.last_release), now),
    ]),
  );
  // 分数命名空间：开源（open+semi）与闭源分开做组内分位（PRD §5.7）。
  // 开源套件有 star/contributors，闭源只有安装/用量，混在一个分位里会让闭源系统性吃亏。
  const bucketOf = (s: { oss_bucket: string }) => (s.oss_bucket === 'closed' ? 'closed' : 'open');

  for (const form of FORMS) {
    const group = scorables.filter((s) => s.form === form);
    if (group.length === 0) continue;
    const scoreMap = new Map<string, number>();
    const bucketActiveSize = new Map<string, number>();
    for (const bucket of ['open', 'closed'] as const) {
      const activeBucketGroup = group.filter(
        (s) => bucketOf(s) === bucket && !dormancy.get(s.slug),
      );
      bucketActiveSize.set(bucket, activeBucketGroup.length);
      const scores = activeBucketGroup.length >= 2 ? scoreGroup(activeBucketGroup, undefined, now) : [];
      for (const s of scores) scoreMap.set(s.slug, s.score);
    }

    const enriched = group.map((item) => {
      const m = item.metrics;
      const stars = typeof m.stars === 'number' ? m.stars : null;
      const installs = effectiveInstalls(m);
      const level = dataLevel(stars, installs);
      // 停更闸门（PRD §4.4）：近 180 天无提交/发版 → 不排名，只保留详情页
      const dormant = dormancy.get(item.slug) ?? false;
      return {
        item,
        m,
        stars,
        installs,
        level,
        dormant,
        score: level === 'L3' || dormant ? null : (scoreMap.get(item.slug) ?? null),
      };
    });

    // 仅 L1/L2 且组内 ≥2 项才有资格排名；名次按「形态 × 开源/闭源命名空间」计算
    const rankMap = new Map<string, number>();
    for (const bucket of ['open', 'closed'] as const) {
      const bucketRankable = enriched
        .filter((e) => bucketOf(e.item) === bucket && e.score != null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      bucketRankable.forEach((e, i) => {
        rankMap.set(e.item.slug, i + 1);
      });
    }
    const ordered = [
      ...enriched
        .filter((e) => e.score != null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
      ...enriched.filter((e) => e.score == null).sort((a, b) => a.item.slug.localeCompare(b.item.slug)),
    ];

    for (const e of ordered) {
      const { item, m, stars, installs, level, score, dormant } = e;
      const basis = installsBasis(m);
      const weekAgo = typeof item.ref?.weekAgo?.stars === 'number' ? item.ref.weekAgo.stars : null;
      const monthAgo = typeof item.ref?.monthAgo?.stars === 'number' ? item.ref.monthAgo.stars : null;
      const prevStars = typeof item.ref?.prev?.stars === 'number' ? item.ref.prev.stars : null;
      // 下载量参考值：口径与 effectiveInstalls 一致（渠道降级规则不变）
      const installsPrev = item.ref?.prev ? effectiveInstalls(item.ref.prev) : null;
      const installsWeekAgo = item.ref?.weekAgo ? effectiveInstalls(item.ref.weekAgo) : null;
      const installsMonthAgo = item.ref?.monthAgo ? effectiveInstalls(item.ref.monthAgo) : null;
      // 快照不足 7/30 天时，用历史回填补齐（口径：以 t-7 / t-30 为结束的 7 日窗口）
      const hist = installHistory?.agents[item.slug];
      const installsPrevEff = installsPrev ?? hist?.installs_1d_ago ?? null;
      const installsWeekAgoEff = installsWeekAgo ?? hist?.installs_7d_ago ?? null;
      const installsMonthAgoEff = installsMonthAgo ?? hist?.installs_30d_ago ?? null;
      const backfilled =
        hist != null && (installsWeekAgo == null || installsMonthAgo == null) && (hist.installs_7d_ago != null || hist.installs_30d_ago != null);
      const delta7dInstalls =
        installs != null && installsWeekAgoEff != null ? installs - installsWeekAgoEff : null;
      const delta30dInstalls =
        installs != null && installsMonthAgoEff != null ? installs - installsMonthAgoEff : null;
      const growth7dInstalls = growthPctSafe(installs, installsWeekAgoEff, 1000);
      const growth30dInstalls = growthPctSafe(installs, installsMonthAgoEff, 1000);

      const flags: string[] = [];
      if (errors.some((err) => err.startsWith(`${item.slug}:`))) flags.push('partial_data');
      if (level === 'L3') flags.push('no_data');
      if (dormant) flags.push('dormant');
      // 口径分离：商店累计安装不是周下载流，CI 噪声 flag 只适用于 npm/PyPI 周下载
      if (basis === 'store_total') flags.push('store_installs');
      if (basis === 'weekly_dl' && installs != null && installs >= 1_000_000) flags.push('installs_may_include_ci');
      if (backfilled) flags.push('backfilled_installs');
      if ((bucketActiveSize.get(bucketOf(item)) ?? 0) <= 2 && level !== 'L3') flags.push('small_group');

      // 出道天数（PRD §5.6）：min(repo 创建至今, 首次收录至今)
      const createdAt = typeof m.repo_created === 'string' ? m.repo_created : null;
      const firstListed = state.agents[item.slug]?.first_listed ?? null;
      const ageDays = newcomerAgeDays(createdAt, firstListed, state.started_at, today);
      if (ageDays != null && ageDays <= 180) flags.push('newcomer');

      rows.push({
        slug: item.slug,
        name: agentName.get(item.slug) ?? item.slug,
        form: item.form,
        oss_bucket: item.oss_bucket,
        score: score == null ? null : Math.round(score * 10) / 10,
        rank_in_form: rankMap.get(item.slug) ?? null,
        delta_1d: stars != null && prevStars != null ? stars - prevStars : null,
        delta_7d: stars != null && weekAgo != null ? stars - weekAgo : null,
        installs_delta_7d: delta7dInstalls,
        installs_delta_30d: delta30dInstalls,
        growth_7d_installs_pct: growth7dInstalls,
        growth_30d_installs_pct: growth30dInstalls,
        delta_30d: stars != null && monthAgo != null ? stars - monthAgo : null,
        growth_7d_pct: growthPctSafe(stars, weekAgo, FLOOR.week),
        growth_30d_pct: growthPctSafe(stars, monthAgo, FLOOR.month),
        metrics: {
          stars,
          forks: typeof m.forks === 'number' ? m.forks : null,
          contributors: typeof m.contributors === 'number' ? m.contributors : null,
          installs,
          activity: activityScore(
            typeof m.last_commit === 'string' ? m.last_commit : null,
            typeof m.last_release === 'string' ? m.last_release : null,
            now,
          ),
          last_release: typeof m.last_release === 'string' ? m.last_release : null,
          // 维护健康（详情页）：最近提交 / issue 积压 / 仓库创建时间 / 下载参考值
          last_commit: typeof m.last_commit === 'string' ? m.last_commit : null,
          open_issues: typeof m.open_issues === 'number' ? m.open_issues : null,
          repo_created: typeof m.repo_created === 'string' ? m.repo_created : null,
          installs_1d_ago: installsPrevEff,
          installs_7d_ago: installsWeekAgoEff,
          installs_30d_ago: installsMonthAgoEff,
          version: typeof m.version === 'string' ? m.version : null,
          version_at: typeof m.version_at === 'string' ? m.version_at : null,
          version_source: typeof m.version_source === 'string' ? m.version_source : null,
          release_tag: typeof m.release_tag === 'string' ? m.release_tag : null,
          release_notes: typeof m.release_notes === 'string' ? m.release_notes : null,
          release_url: typeof m.release_url === 'string' ? m.release_url : null,
          openrouter_tokens_month:
            typeof m.openrouter_tokens_month === 'number' ? m.openrouter_tokens_month : null,
          openrouter_requests_month:
            typeof m.openrouter_requests_month === 'number' ? m.openrouter_requests_month : null,
          openrouter_rank_month:
            typeof m.openrouter_rank_month === 'number' ? m.openrouter_rank_month : null,
        },
        data_level: level,
        flags,
        age_days: ageDays,
        first_listed: firstListed,
        score_version: SCORE_VERSION,
      });
    }
  }

  // 4. 落评分快照
  await mkdir(join(DATA_DIR, 'scores'), { recursive: true });
  const scorePath = join(DATA_DIR, 'scores', `${today}.json`);
  await writeFile(scorePath, JSON.stringify({ date: today, version: SCORE_VERSION, rows }, null, 2));
  console.log(`[scores] ${rows.length} rows → ${scorePath}`);

  // 5. 事件流（PRD F-24）
  const events = diffEvents(today, rows, prevRows, prevMetrics);
  if (events.length || !prevRows) {
    const p = await writeEvents(join(DATA_DIR, 'events'), today, events);
    console.log(`[events] ${events.length} 条 → ${p}`);
  }

  // 5.5 安全模块（PRD F-26）：一次 querybatch 查所有包
  try {
    const targets = pickSecurityTargets(agents);
    const sec = await collectSecurity(targets);
    const p = await writeSecurity(DATA_DIR, today, sec);
    const total = Object.values(sec).reduce((s, x) => s + x.advisories, 0);
    const mal = Object.values(sec).reduce((s, x) => s + x.malicious, 0);
    console.log(`[security] ${targets.length} 包 · ${total} 条历史公告（含 ${mal} 条恶意包）→ ${p}`);
  } catch (e) {
    console.warn(`[security] 跳过：${e instanceof Error ? e.message : e}`);
  }

  // 6. 周期归档（PRD §5.5）：周日冻结周档，月末冻结月档
  const archived = await archiveIfNeeded(today, rows);
  if (archived.length) console.log(`[archive] ${archived.join(', ')}`);

  return { snapshotPath, scorePath, rows };
}

/** ISO 8601 周号（周一为周起点） */
function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7; // 周日=7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum); // 移到本周周四
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

/** 周日/月末冻结归档；幂等（同一周期重复跑覆盖同文件） */
async function archiveIfNeeded(today: string, rows: ScoreRow[]): Promise<string[]> {
  const d = new Date(`${today}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=周日
  const tomorrow = new Date(d);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const isMonthEnd = tomorrow.getUTCMonth() !== d.getUTCMonth();
  const isWeekEnd = dow === 0;

  const written: string[] = [];
  const dir = join(DATA_DIR, 'archive');
  await mkdir(dir, { recursive: true });

  if (isWeekEnd) {
    const { year, week } = isoWeek(d);
    const name = `${year}-W${String(week).padStart(2, '0')}`;
    await writeFile(
      join(dir, `${name}.json`),
      JSON.stringify({ period: 'week', label: name, end: today, version: SCORE_VERSION, rows }, null, 2),
    );
    written.push(name);
  }
  if (isMonthEnd) {
    const name = today.slice(0, 7); // YYYY-MM
    await writeFile(
      join(dir, `${name}.json`),
      JSON.stringify({ period: 'month', label: name, end: today, version: SCORE_VERSION, rows }, null, 2),
    );
    written.push(name);
  }
  return written;
}

/** 增速（小数）：复用 core 的 growthPct（小基数 FLOOR 抑制），仅额外保留 4 位小数 */
function growthPctSafe(
  now: number | null,
  then: number | null | undefined,
  floor: number,
): number | null {
  const g = growthPct(now ?? null, then ?? null, floor);
  // 存储为小数（0.123 = +12.3%），前端 fmtPct 再乘 100 展示
  return g == null ? null : Math.round(g * 10000) / 10000;
}

// 直接运行时执行
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const token = process.env.GITHUB_TOKEN?.trim();
  console.log(
    token
      ? `[env] GITHUB_TOKEN 已加载（${token.slice(0, 4)}…${token.slice(-4)}，len=${token.length}）`
      : '[env] 未发现 GITHUB_TOKEN —— 将走 ungh 降级通道（拿不到 contributors/release）',
  );
  runDaily({ token }).then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
