/**
 * 维护健康度派生指标（详情页「维护健康」区块，PRD §7）
 *
 * 设计约束：
 * - 纯函数 + 显式 `now`：SSR 构建期必须可复现——详情页的「N 天前」用快照日期当 now，
 *   而不是构建时刻，否则同一份数据每次部署都换一种说法。
 * - 算不出来一律返回 null，不接受「估」：缺失由前端显式说明（PRD §5.7 产品纪律）。
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** ISO 字符串 → 毫秒时间戳；缺失 / 非法 → null */
export function parseTime(iso: string | null | undefined): number | null {
  if (typeof iso !== 'string' || !iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** 距今小时数（向下取整，未来时间按 0 处理） */
export function elapsedHours(iso: string | null | undefined, now: Date): number | null {
  const t = parseTime(iso);
  if (t == null) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / HOUR));
}

/** 距今天数（向下取整，未来时间按 0 处理） */
export function elapsedDays(iso: string | null | undefined, now: Date): number | null {
  const h = elapsedHours(iso, now);
  return h == null ? null : Math.floor(h / 24);
}

/** 中位数；空集 / 全非法 → null（偶数个取中间两数均值） */
export function median(values: number[]): number | null {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = nums.length >> 1;
  return nums.length % 2 === 1 ? nums[mid]! : (nums[mid - 1]! + nums[mid]!) / 2;
}

/**
 * 中位发版间隔（天），入参为各版本的发布时间（ISO）。
 *
 * 只认「版本发布时刻」，不用快照日期——快照日期只是我们哪天看到的，
 * 拿它算节奏会把采集频率当成发版频率（错得体面，但仍然是错的）。
 * 可解析时间 < 2 个 → null（累积中，前端显示「记录不足」）。
 */
export function medianReleaseGapDays(times: (string | null | undefined)[]): number | null {
  const ms = [...new Set(times.map(parseTime).filter((t): t is number => t != null))].sort(
    (a, b) => a - b,
  );
  if (ms.length < 2) return null;
  const gaps = ms.slice(1).map((t, i) => (t - ms[i]!) / DAY);
  const m = median(gaps);
  return m == null ? null : Math.round(m * 10) / 10;
}

/** 近 N 天内发版的次数（按发布时间统计，同一版本只算一次） */
export function releasesWithinDays(
  times: (string | null | undefined)[],
  days: number,
  now: Date,
): number | null {
  const ms = [...new Set(times.map(parseTime).filter((t): t is number => t != null))];
  if (ms.length === 0) return null;
  const cutoff = now.getTime() - days * DAY;
  return ms.filter((t) => t >= cutoff && t <= now.getTime()).length;
}

/**
 * Issue 积压：每千 star 的 open issue 数。
 * star 太少时分母不可信（新项目 issue/star 天然虚高）→ null，不上页面。
 */
export function backlogPer1kStars(
  openIssues: number | null | undefined,
  stars: number | null | undefined,
  floorStars = 1000,
): number | null {
  if (typeof openIssues !== 'number' || typeof stars !== 'number') return null;
  if (!Number.isFinite(openIssues) || !Number.isFinite(stars)) return null;
  if (stars < floorStars || openIssues < 0) return null;
  return Math.round((openIssues / stars) * 1000 * 10) / 10;
}

/**
 * Fork / Star 比率（%）：衡量「有多少人真的拿它改」。
 * agent 类项目 fork 常常是为了自定义工作流，和普通库的 fork 语义不同，
 * 所以只作为参考量展示，不进综合分。
 */
export function forkStarPct(
  forks: number | null | undefined,
  stars: number | null | undefined,
): number | null {
  if (typeof forks !== 'number' || typeof stars !== 'number') return null;
  if (!Number.isFinite(forks) || !Number.isFinite(stars) || stars <= 0 || forks < 0) return null;
  return Math.round((forks / stars) * 1000) / 10;
}