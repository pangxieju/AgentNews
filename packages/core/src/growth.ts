/**
 * 增量与增速（PRD §5.5）
 * - 增量榜（日/周/月）用绝对增量：谁在真正变大
 * - 综合分 / 趋势榜用相对增速 %：谁势头更好，FLOOR 抑制小基数暴涨
 */

/** 小基数抑制下限：低于此基准的增速不可信（如 5→50 star 是 900% 的抖动） */
export const FLOOR = { day: 50, week: 50, month: 200 } as const;

/** 绝对增量 */
export function absoluteDelta(
  now: number | null | undefined,
  then: number | null | undefined,
): number | null {
  if (now == null || then == null) return null;
  return now - then;
}

/** 相对增速 %；基准低于 FLOOR 或不可得 → null（不参与增速榜） */
export function growthPct(
  now: number | null | undefined,
  then: number | null | undefined,
  floor: number,
): number | null {
  if (now == null || then == null) return null;
  if (then < floor) return null;
  if (then <= 0) return null;
  return (now - then) / then;
}

/**
 * 活跃度分 ∈ [0,1]（PRD §5.2）
 * 近 90 天有提交的周数权重 60% + 近 90 天发版次数权重 40%
 * last_commit / last_release 由 pipeline 以 ISO 日期字符串传入
 */
export function activityScore(
  lastCommit: string | null | undefined,
  lastRelease: string | null | undefined,
  now: Date = new Date(),
): number {
  const day = 86_400_000;
  const commitWeeks = lastCommit
    ? (now.getTime() - new Date(lastCommit).getTime()) / (7 * day)
    : Infinity;
  const commitPart = commitWeeks === Infinity
    ? 0
    : Math.min(1, Math.max(0, 1 - commitWeeks / 13)); // 90 天内活跃→1，超过 90 天线性衰减

  // release 部分：pipeline 传最近发版日期，90 天内发过版→1，否则 0.5 衰减
  let releasePart = 0;
  if (lastRelease) {
    const releaseDays = (now.getTime() - new Date(lastRelease).getTime()) / day;
    releasePart = releaseDays <= 90 ? 1 : Math.max(0, 1 - (releaseDays - 90) / 180);
  }
  return Number((0.6 * commitPart + 0.4 * releasePart).toFixed(3));
}

/** 数据完整度等级（PRD §5.7）：有 star + 任一安装/商店指标 → L1，只有部分 → L2，几乎全缺 → L3 */
export function dataLevel(
  stars: number | null | undefined,
  installs: number | null | undefined,
): 'L1' | 'L2' | 'L3' {
  if (stars != null && installs != null) return 'L1';
  if (stars != null || installs != null) return 'L2';
  return 'L3';
}
