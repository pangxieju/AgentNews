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

export const bucketBadgeClass = (b: string): string =>
  b === 'open' ? 'b-open' : b === 'semi' ? 'b-semi' : 'b-closed';

/** 格式化数字（T/B/k 缩写，小于 1k 保留原值） */
export function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(1) + 'T';
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
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
/** 粒度 → 默认排序键（PRD §5.5：粒度切换即排序口径切换） */
export const defaultSortFor = (g: string): string =>
  g === 'day' ? 'delta_1d' : g === 'week' ? 'delta_7d' : 'score';

export const rankUrl = (bucket: string, form: string, g: string): string =>
  `/top/${bucket}/${form}/${g}/`;


/* ───────────── 形态的英文名与决策文案 ───────────── */

export const FORM_EN: Record<string, string> = {
  cli: 'Terminal',
  'ide-plugin': 'IDE Extension',
  'ide-app': 'AI IDE',
  desktop: 'Desktop',
  browser: 'Browser',
  framework: 'Framework',
  autonomous: 'Autonomous',
};

/* ───────────── 安装渠道 / 入口链接 ───────────── */

export type SourceLite = { kind: string; identifier: string; is_primary?: boolean };
export type InstallInfo = {
  /** 可直接复制执行的安装命令；没有包管理渠道时为 null */
  command: string | null;
  /** 渠道说明，例如 npm / PyPI / VS Code 市场 */
  channel: string;
  /** 外链（GitHub / 包页 / 官网） */
  links: Array<{ label: string; href: string }>;
};

/**
 * 从 agents.yaml 的 sources 推导「怎么装、去哪找」。
 * 只做事实性映射，不猜价格、不猜功能。
 */
export function installInfo(sources: SourceLite[], homepage?: string | null): InstallInfo {
  const by = (k: string) => sources.find((s) => s.kind === k);
  const links: Array<{ label: string; href: string }> = [];
  const github = by('github');
  const npm = by('npm');
  const pypi = by('pypi');
  const brew = by('brew');
  const crates = by('crates');
  const vscode = by('vscode');
  const chrome = by('chrome');

  if (github) links.push({ label: 'GitHub', href: `https://github.com/${github.identifier}` });
  if (npm) links.push({ label: 'npm', href: `https://www.npmjs.com/package/${npm.identifier}` });
  if (pypi) links.push({ label: 'PyPI', href: `https://pypi.org/project/${pypi.identifier}/` });
  if (vscode)
    links.push({
      label: 'VS Code 市场',
      href: `https://marketplace.visualstudio.com/items?itemName=${vscode.identifier}`,
    });
  if (chrome) links.push({ label: 'Chrome 商店', href: `https://chromewebstore.google.com/detail/${chrome.identifier}` });
  if (homepage) links.push({ label: '官网', href: homepage });

  if (npm) return { command: `npm i -g ${npm.identifier}`, channel: 'npm', links };
  if (pypi) return { command: `pip install ${pypi.identifier}`, channel: 'PyPI', links };
  if (brew) return { command: `brew install ${brew.identifier}`, channel: 'Homebrew', links };
  if (crates) return { command: `cargo install ${crates.identifier}`, channel: 'crates.io', links };
  if (vscode) return { command: null, channel: 'VS Code 市场', links };
  if (chrome) return { command: null, channel: 'Chrome 商店', links };
  if (github) return { command: `git clone https://github.com/${github.identifier}.git`, channel: 'GitHub 源码', links };
  return { command: null, channel: '官网分发', links };
}
