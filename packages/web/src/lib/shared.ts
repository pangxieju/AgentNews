/**
 * 纯展示工具 —— 无任何 Node 依赖。
 * 客户端 island（Preact）与服务端 Astro 页面共用这一份，
 * 保证榜单在 SSR 与 hydrate 后渲染结果一致（否则会闪烁）。
 */

export const FORM_ORDER = [
  'cli',
  'ide-plugin',
  'ide-app',
  'desktop',
  'browser',
  'framework',
  'autonomous',
] as const;

export type FormKey = (typeof FORM_ORDER)[number];

const FORM_LABELS: Record<string, string> = {
  all: '全部',
  cli: 'CLI',
  'ide-plugin': 'IDE 插件',
  'ide-app': 'IDE 应用',
  desktop: '桌面',
  browser: '浏览器',
  framework: '框架',
  autonomous: '自主',
};

export const formLabel = (f: string): string => FORM_LABELS[f] ?? f;

export const bucketText = (b: string): string =>
  b === 'open' ? '开源' : b === 'semi' ? '半开源' : '闭源';

export const bucketBadgeClass = (b: string): string =>
  b === 'open' ? 'b-open' : b === 'semi' ? 'b-semi' : 'b-closed';

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

/** 带符号的增量（+1.2k / -34） */
export function fmtSigned(n: number | null | undefined): string {
  if (n == null) return '—';
  return (n > 0 ? '+' : '') + fmt(n);
}

export const GRANS = ['day', 'week', 'month'] as const;
export const granLabel = (g: string): string =>
  g === 'day' ? '日榜' : g === 'week' ? '周榜' : '月榜';

/** 粒度 → 默认排序键（PRD §5.5：粒度切换即排序口径切换） */
export const defaultSortFor = (g: string): string =>
  g === 'day' ? 'delta_1d' : g === 'week' ? 'delta_7d' : 'score';

export const rankUrl = (bucket: string, form: string, g: string): string =>
  `/top/${bucket}/${form}/${g}/`;
