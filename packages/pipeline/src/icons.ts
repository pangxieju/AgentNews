/**
 * 图标缓存：把每个 agent 的 logo 下载到仓库里（packages/web/public/icons）。
 *
 * 为什么要落盘：
 * - 不再依赖 github.com / duckduckgo / google 的实时请求（隐私、稳定性、限流）
 * - 每天采集时刷新，图标跟着产品换 logo 一起更新
 *
 * 取图优先级（越靠前越能代表「这个产品」而不是「这个组织」）：
 *   1. agents.yaml 的 icon: 覆盖（人工校准）
 *   2. 官网 web app manifest 里的大图标（manifest.json → 192/512 PNG，常是唯一高清来源）
 *   3. 官网 HTML 里声明的图标（apple-touch-icon / icon，按尺寸挑最大）
 *   4. 官网 og:image / twitter:image（仅接受近似正方形，避免拿到宣传大图）
 *   5. 官网约定路径 /apple-touch-icon.png、/apple-touch-icon-precomposed.png
 *   6. GitHub README 里明确写着 logo 的图（开源项目的产品 logo，常是 SVG）
 *   7. 第三方 logo API（icon.horse → favicone → unavatar → clearbit，给 ≥180px 真 logo）
 *   8. 官网 favicon 服务（Google s2 → DuckDuckGo）
 *   9. 官网 /favicon.ico（体积小，最后才用）
 *  10. GitHub owner 头像（最后兜底：个人仓库会拿到维护者头像，需人工核对）
 *
 * 任何一档都可能落空 —— 用 `pnpm icons:audit` 看谁退化到了 7~10 档，
 * 再在 agents.yaml 里加 icon: 覆盖。生产环境优先认「官网自述」，而不是猜测。
 *
 * 原则：只要有「真实官网」，就一定优先从官网取图；GitHub 头像只作为
 * 无官网 / 官网取不到图时的兜底。docs 托管域名（*.github.io、learn.microsoft.com
 * 等）不算真实官网——它们的 favicon 是平台自己的，不是产品的。
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Agent } from '@agentnews/core';

// 用真实浏览器 UA：不少官网（Vercel / Cloudflare 前置的站点）会直接 403/断开
// 通用 bot UA，导致明明有 logo 也抓不到。
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 AgentNewsBot/1.0 (+https://agentnews-c5h.pages.dev)';
const HTML_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
};
const IMAGE_HEADERS = { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' };
// 官网高清 logo 常见 800KB~1.2MB（如 voideditor 的 1200x1200），400KB 会误杀
const MAX_BYTES = 1536 * 1024;
const TIMEOUT_MS = 12_000;

export type IconRecord = {
  file: string;
  source: 'override' | 'manifest' | 'html' | 'well-known' | 'readme' | 'logo' | 'github' | 'google' | 'ddg';
  w: number;
  h: number;
  /** 取图来源 URL：排查「这张图到底是哪来的」时必备 */
  url?: string;
};

export type IconManifest = Record<string, IconRecord>;

type Image = { buf: Buffer; ext: string; w: number; h: number };

/* ───────────────────────── 图片嗅探 ───────────────────────── */

function sniff(buf: Buffer): Image | null {
  if (buf.length < 12) return null;

  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { buf, ext: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') {
    return { buf, ext: 'gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  // WEBP
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    const kind = buf.subarray(12, 16).toString('ascii');
    if (kind === 'VP8X') return { buf, ext: 'webp', w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { buf, ext: 'webp', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    return { buf, ext: 'webp', w: 0, h: 0 };
  }
  // ICO
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) {
    const count = buf.readUInt16LE(4);
    let best = { w: 0, h: 0 };
    for (let i = 0; i < count; i++) {
      const off = 6 + i * 16;
      if (off + 2 >= buf.length) break;
      const w = buf[off] === 0 ? 256 : buf[off]!;
      const h = buf[off + 1] === 0 ? 256 : buf[off + 1]!;
      if (w * h > best.w * best.h) best = { w, h };
    }
    return { buf, ext: 'ico', ...best };
  }
  // JPEG：扫 SOF 段
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { buf, ext: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
    return { buf, ext: 'jpg', w: 0, h: 0 };
  }
  // SVG（文本）
  const head = buf.subarray(0, 400).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return { buf, ext: 'svg', w: 0, h: 0 };
  }
  return null;
}

/* ───────────────────────── 抓取 ───────────────────────── */

/**
 * 带超时的 GET：超时覆盖「拿到响应头」与「读完 body」全程，
 * 网络错误 / 非 2xx / read 内抛错统一返回 null。
 */
async function get<T>(
  url: string,
  headers: Record<string, string>,
  read: (res: Response) => Promise<T | null>,
  timeoutMs = TIMEOUT_MS,
): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' });
    return res.ok ? await read(res) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fetchImage(url: string, timeoutMs = TIMEOUT_MS): Promise<Image | null> {
  return get(
    url,
    IMAGE_HEADERS,
    async (res) => {
      const type = res.headers.get('content-type') ?? '';
      if (!/image\//i.test(type) && !/octet-stream/i.test(type)) return null;
      if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length && buf.length <= MAX_BYTES ? sniff(buf) : null;
    },
    timeoutMs,
  );
}

/** 抓官网 HTML；返回最终 URL（跟随跳转后），相对 href 要以它为基准解析 */
function fetchHtmlOnce(
  url: string,
  timeoutMs: number,
): Promise<{ html: string; url: string } | null> {
  return get(
    url,
    HTML_HEADERS,
    async (res) => {
      if (!/text\/html/i.test(res.headers.get('content-type') ?? '')) return null;
      const text = await res.text();
      return { html: text.slice(0, 600_000), url: res.url || url };
    },
    timeoutMs,
  );
}

async function fetchHtml(url: string, timeoutMs = TIMEOUT_MS): Promise<{ html: string; url: string } | null> {
  const first = await fetchHtmlOnce(url, timeoutMs);
  if (first) return first;
  // 官网偶发超时/连接重置：重试一次，避免官网图标无故退化成 GitHub 头像
  await new Promise((r) => setTimeout(r, 500));
  return fetchHtmlOnce(url, timeoutMs);
}

/* ───────────────────────── 官网图标发现 ───────────────────────── */

type Candidate = { url: string; score: number; source: IconRecord['source']; square?: boolean };

/**
 * 哪些域名不算「产品自己的官网」——它们的 favicon 是平台 logo，
 * 拿它当产品图标反而是错的（如 *.github.io 会给 GitHub 章鱼猫）。
 */
const NOT_A_SITE = [
  /^github\.com$/i,
  /\.github\.io$/i,
  /^gist\.github\.com$/i,
  /^raw\.githubusercontent\.com$/i,
  /^learn\.microsoft\.com$/i,
  /(^|\.)huggingface\.co$/i,
  /\.gitbook\.io$/i,
  /\.readthedocs\.(io|org)$/i,
  /^npmjs\.com$/i,
  /^pypi\.org$/i,
];

/** agent 的真实官网 origin；无官网或官网只是 docs/仓库托管时返回 null */
function siteOrigin(agent: Agent): { origin: string; page: string } | null {
  if (!agent.homepage) return null;
  let u: URL;
  try {
    u = new URL(agent.homepage);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (NOT_A_SITE.some((re) => re.test(u.hostname))) return null;
  return { origin: u.origin, page: u.toString() };
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

function sizeScore(sizes: string | null): number {
  if (!sizes) return 0;
  if (/any/i.test(sizes)) return 4096; // 矢量
  let best = 0;
  for (const part of sizes.split(/\s+/)) {
    const m = part.match(/^(\d+)x(\d+)$/i);
    if (m) best = Math.max(best, Number(m[1]) * Number(m[2]));
  }
  return best;
}

function htmlCandidates(html: string, pageUrl: string): Candidate[] {
  const out: Candidate[] = [];
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    const href = attr(tag, 'href');
    if (!href || !/icon/i.test(rel)) continue;
    let url: string;
    if (/^data:image\//i.test(href)) {
      // 内联 base64 图标（theia-ide.org 等），无需再发请求
      url = href;
    } else {
      try {
        url = new URL(href, pageUrl).toString();
      } catch {
        continue;
      }
      if (!/^https?:/i.test(url)) continue;
    }
    const type = (attr(tag, 'type') ?? '').toLowerCase();
    const sizes = attr(tag, 'sizes');
    let score = sizeScore(sizes);
    if (/svg/i.test(type) || /\.svg(\?|$)/i.test(url)) score = Math.max(score, 4096);
    if (/apple-touch-icon/i.test(rel)) score += 2048;
    if (/mask-icon/i.test(rel)) score -= 500; // 单色 mask，通常不适合当 logo
    if (!score) score = 32 * 32;
    out.push({ url, score, source: 'html' });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** og:image / twitter:image —— 官网「品牌图」的常见位置，但常是宣传大图，
 *  只接受近似正方形（logo 特征），横幅图一律不认。 */
function metaCandidates(html: string, pageUrl: string): Candidate[] {
  const out: Candidate[] = [];
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? '').toLowerCase();
    if (!/^(og:image|og:image:url|og:image:secure_url|twitter:image|twitter:image:src)$/.test(key)) continue;
    const content = attr(tag, 'content');
    if (!content) continue;
    let url: string;
    try {
      url = new URL(content, pageUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(url)) continue;
    out.push({ url, score: 1024, source: 'html', square: true });
  }
  return out;
}

/** 官网约定路径：大图优先，favicon.ico 单独放到最后（通常只有 32x32） */
function wellKnown(origin: string): Candidate[] {
  return [
    { url: `${origin}/apple-touch-icon.png`, score: 180 * 180, source: 'well-known' as const },
    { url: `${origin}/apple-touch-icon-precomposed.png`, score: 170 * 170, source: 'well-known' as const },
  ];
}

function wellKnownFavicon(origin: string): Candidate[] {
  return [{ url: `${origin}/favicon.ico`, score: 32 * 32, source: 'well-known' as const }];
}

/**
 * 官网 web app manifest 里的图标：现代站点（Next.js / Astro / Vite）通常在这里声明
 * 192x192、512x512 的 PNG —— 而 <head> 里只挂了个 32x32 favicon。这是「官网自述」
 * 里最容易漏掉的高清来源。
 */
async function manifestCandidates(html: string, pageUrl: string): Promise<Candidate[]> {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const hrefs = new Set<string>();
  for (const tag of links) {
    if (!/manifest/i.test(attr(tag, 'rel') ?? '')) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    try {
      const u = new URL(href, pageUrl);
      if (/^https?:$/i.test(u.protocol)) hrefs.add(u.toString());
    } catch {
      /* 忽略非法 href */
    }
  }
  const out: Candidate[] = [];
  const fetchJson = async (url: string): Promise<string | null> => {
    const rd = async (): Promise<string | null> =>
      get(url, { 'User-Agent': UA, Accept: 'application/manifest+json,application/json,*/*' }, async (res) =>
        (await res.text()).slice(0, 200_000),
      );
    const first = await rd();
    if (first) return first;
    // manifest 抓取失败会把整条官网高清路径打掉，必须重试一次
    await new Promise((r) => setTimeout(r, 500));
    return rd();
  };
  for (const href of [...hrefs].slice(0, 2)) {
    const json = await fetchJson(href);
    if (!json) continue;
    let icons: unknown;
    try {
      icons = (JSON.parse(json) as { icons?: unknown }).icons;
    } catch {
      continue;
    }
    if (!Array.isArray(icons)) continue;
    for (const icon of icons) {
      const src = (icon as { src?: unknown }).src;
      if (typeof src !== 'string' || !src) continue;
      let url: string;
      try {
        url = new URL(src, href).toString();
      } catch {
        continue;
      }
      if (!/^https?:/i.test(url)) continue;
      const sizes = String((icon as { sizes?: unknown }).sizes ?? '');
      const type = String((icon as { type?: unknown }).type ?? '');
      let score = sizeScore(sizes);
      if (/svg/i.test(type) || /\.svg(\?|$)/i.test(url)) score = Math.max(score, 4096);
      if (!score) score = 192 * 192;
      out.push({ url, score, source: 'manifest' });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** 第三方 logo API —— 按「域名」查，返回的是品牌 logo 而不是 32px favicon。
 *  顺序即可信度：icon.horse 给 256/512 位图，favicone 给 256，unavatar 常给矢量，
 *  clearbit 在部分网络下不可达（放在最后，失败即跳过）。*/
function logoApiCandidates(hostname: string, source: IconRecord['source'] = 'logo'): Candidate[] {
  const h = encodeURIComponent(hostname);
  return [
    { url: `https://icon.horse/icon/${h}`, score: 100_000, source },
    { url: `https://favicone.com/${h}?s=256`, score: 90_000, source },
    { url: `https://unavatar.io/${h}?fallback=false`, score: 80_000, source },
    { url: `https://logo.clearbit.com/${h}`, score: 70_000, source },
  ];
}

/** 子域 → 父域：junie.jetbrains.com 取不到图时，退到 jetbrains.com（品牌 logo） */
function parentHosts(hostname: string): string[] {
  const parts = hostname.split('.').filter(Boolean);
  const out: string[] = [];
  for (let i = 1; i < parts.length - 1; i++) out.push(parts.slice(i).join('.'));
  return out;
}

/** 徽章/统计图 —— 出现在 README 顶部但不是 logo，必须排除 */
const BADGE_RE =
  /shields\.io|badgen|badge\.fury|codecov|travis-ci|circleci|appveyor|snyk\.io|deps\.rs|gitter|discord|opencollective|star-history|visitor-badge|hits\.se|npmjs\.com\/package\/[^\s]*\/badge/i;

/**
 * GitHub README 里的产品 logo：开源项目往往把真 logo 放在 README 顶部，
 * 而官网只是个 docs 站（.github.io / readthedocs），官网取图全落空。
 * 只认「矢量」或「路径/alt 里明确写 logo|icon|brand|avatar」的图，避免抓到截图。
 */
function readmeImageCandidates(readmeText: string, rawBase: string): Candidate[] {
  const out: Candidate[] = [];
  const push = (src: string, alt: string): void => {
    if (!src || /^data:/i.test(src)) return;
    if (BADGE_RE.test(src) || BADGE_RE.test(alt)) return;
    if (/\.gif(\?|$)/i.test(src)) return;
    const isSvg = /\.svg(\?|$)/i.test(src);
    const looksLogo = /logo|icon|brand|avatar|wordmark|mark/i.test(src + ' ' + alt);
    // 位图只信「明确写着 logo」的，否则很容易抓到 demo 截图
    if (!isSvg && !looksLogo) return;
    let url: string;
    try {
      url = new URL(src, rawBase).toString();
    } catch {
      return;
    }
    if (!/^https?:/i.test(url)) return;
    out.push({
      url,
      score: (isSvg ? 4096 : 1024) + (looksLogo ? 512 : 0),
      source: 'readme',
      // 位图必须是近正方形：README 里“写着 logo”的宽横幅（1470x414 那种）当图标很难看
      square: !isSvg,
    });
  };
  // Markdown: ![alt](src "title")
  for (const m of readmeText.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)) push(m[2]!, m[1]!);
  // HTML: <img src="..." alt="...">
  for (const m of readmeText.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(m[0], 'src');
    if (src) push(src, attr(m[0], 'alt') ?? '');
  }
  return out.sort((a, b) => b.score - a.score);
}

const README_NAMES = ['README.md', 'readme.md', 'README.markdown', 'Readme.md', 'README.rst'];

/** 抓 GitHub README 文本；raw.githubusercontent 不需要 token，也不吃 API 配额 */
async function fetchReadme(owner: string, repo: string): Promise<{ text: string; base: string } | null> {
  for (const name of README_NAMES) {
    const base = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;
    const text = await get(
      base + name,
      { 'User-Agent': UA, Accept: 'text/plain,*/*' },
      async (res) => (await res.text()).slice(0, 300_000),
    );
    if (text) return { text, base };
  }
  return null;
}

/** 解码 data:image/... 图标 */
function decodeDataUrl(url: string): Image | null {
  const m = /^data:image\/[a-z0-9.+-]+(;base64)?,(.*)$/is.exec(url);
  if (!m) return null;
  try {
    const buf = m[1]
      ? Buffer.from(m[2]!, 'base64')
      : Buffer.from(decodeURIComponent(m[2]!), 'utf8');
    if (!buf.length || buf.length > MAX_BYTES) return null;
    return sniff(buf);
  } catch {
    return null;
  }
}

/* ───────────────────────── 单个 agent ───────────────────────── */

type Resolved = { image: Image; source: IconRecord['source']; url: string };

export async function resolveIcon(agent: Agent): Promise<Resolved | null> {
  const tryList = async (cands: Candidate[], allowSmall = true): Promise<Resolved | null> => {
    let best: Resolved | null = null;
    for (const c of cands.slice(0, 6)) {
      const img = c.url.startsWith('data:') ? decodeDataUrl(c.url) : await fetchImage(c.url);
      if (!img) continue;
      const isVector = img.ext === 'svg';
      // og:image 常是 1200x630 的宣传图，只有近似正方形才当 logo 用
      if (c.square && !isVector && img.w > 0 && img.h > 0) {
        const ratio = img.w / img.h;
        if (ratio < 0.75 || ratio > 1.34) continue;
      }
      if (isVector || Math.min(img.w, img.h) >= 64) return { image: img, source: c.source, url: c.url };
      if (!best || Math.min(img.w, img.h) > Math.min(best.image.w, best.image.h)) {
        best = { image: img, source: c.source, url: c.url };
      }
    }
    return allowSmall ? best : null;
  };

  // 1. 人工覆盖
  if (agent.icon) {
    let img = await fetchImage(agent.icon);
    if (!img) {
      await new Promise((r) => setTimeout(r, 600));
      img = await fetchImage(agent.icon);
    }
    if (img) return { image: img, source: 'override', url: agent.icon };
  }

  /** 高清：矢量，或位图 >= 阈值 */
  const high = (r: Resolved | null, min = 64): r is Resolved =>
    !!r && (r.image.ext === 'svg' || Math.min(r.image.w, r.image.h) >= min);

  /** 两份候选里挑更好的：矢量优先，其次尺寸大的；同尺寸时 png/jpg 优先于 ico */
  const better = (a: Resolved | null, b: Resolved | null): Resolved | null => {
    if (!a) return b;
    if (!b) return a;
    const va = a.image.ext === 'svg';
    const vb = b.image.ext === 'svg';
    if (va !== vb) return va ? a : b;
    const sa = Math.min(a.image.w, a.image.h);
    const sb = Math.min(b.image.w, b.image.h);
    if (sa !== sb) return sa > sb ? a : b;
    return a.image.ext === 'ico' && b.image.ext !== 'ico' ? b : a;
  };

  /** 网络抖动很常见（GitHub / 各站点都会偶尔超时），候选链整条重试一次 */
  const tryListRetry = async (cands: Candidate[], allowSmall = true): Promise<Resolved | null> => {
    const first = await tryList(cands, allowSmall);
    if (first) return first;
    await new Promise((r) => setTimeout(r, 600));
    return tryList(cands, allowSmall);
  };

  // 2~5. 官网自述优先
  let fallback: Resolved | null = null; // 官网只给了 32x32 时先存着，继续往后找高清
  let origin: string | null = null;
  let host: string | null = null;

  const site = siteOrigin(agent);
  if (site) {
    const page = await fetchHtml(site.page);
    let pageOrigin = site.origin;
    // 站点常整体跳转到另一个域名（ai.pydantic.dev → pydantic.dev/docs），
    // 约定路径与 favicon 服务要用跳转后的 origin 才拿得到图。
    if (page) {
      try {
        pageOrigin = new URL(page.url).origin;
      } catch {
        /* 保留原 origin */
      }
      const siteHost = (() => {
        try {
          return new URL(site.origin).hostname;
        } catch {
          return null;
        }
      })();
      const pageHost = (() => {
        try {
          return new URL(pageOrigin).hostname;
        } catch {
          return null;
        }
      })();
      // 域名被并购/迁移后常整体跳到母公司站（windsurf.com → devin.ai）：
      // 母公司站给的 icon 是母公司 logo，这时优先用 agent 自己首页域名上的 logo。
      if (siteHost && pageHost && siteHost !== pageHost) {
        const own = await tryListRetry(logoApiCandidates(siteHost));
        if (high(own, 128)) return own;
        fallback = better(fallback, own);
      }

      // 2. web app manifest 里声明的大图标（head 里常只挂 32x32 favicon）
      const mf = await tryList(await manifestCandidates(page.html, page.url));
      if (high(mf, 128)) return mf;
      fallback = better(fallback, mf);

      // 3. 页面声明的图标
      const found = await tryList(htmlCandidates(page.html, page.url));
      if (high(found)) return found;
      fallback = better(fallback, found);

      // 4. og:image（只认正方形）
      const og = await tryList(metaCandidates(page.html, page.url), false);
      if (og) return og;
    }
    // 5. 约定路径 /apple-touch-icon*.png
    for (const o of pageOrigin === site.origin ? [site.origin] : [pageOrigin, site.origin]) {
      const wk = await tryList(wellKnown(o), false);
      if (wk) return wk;
    }
    origin = pageOrigin;
    try {
      host = new URL(pageOrigin).hostname;
    } catch {
      host = null;
    }
  }

  // 6. GitHub README 里明确写着 logo 的图：开源项目的官网常常只是 docs 站，官网取图全落空
  const gh = agent.sources.find((s) => s.kind === 'github');
  if (gh && !agent.icon) {
    const [owner, repo] = gh.identifier.split('/');
    if (owner && repo) {
      const readme = await fetchReadme(owner, repo);
      if (readme) {
        const r = await tryListRetry(readmeImageCandidates(readme.text, readme.base));
        if (high(r)) return r;
        fallback = better(fallback, r);
      }
    }
  }

  // 7. 第三方 logo API：先本域，再父域（junie.jetbrains.com → jetbrains.com 品牌 logo）
  if (host) {
    for (const h of [host, ...parentHosts(host)]) {
      const r = await tryListRetry(logoApiCandidates(h));
      if (high(r, 128)) return r;
      fallback = better(fallback, r);
    }
  }

  // 8. 官网自己给的图（哪怕只有 32~48px），比「服务端放大版」可信
  if (fallback) return fallback;

  // 9. 官网 favicon 服务
  if (host) {
    const google = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    const g = await fetchImage(google);
    if (g && Math.min(g.w, g.h) >= 32) return { image: g, source: 'google', url: google };
    const ddg = `https://icons.duckduckgo.com/ip3/${host}.ico`;
    const d = await fetchImage(ddg);
    if (d && Math.min(d.w, d.h) >= 32) return { image: d, source: 'ddg', url: ddg };
  }

  // 10. 官网 /favicon.ico（通常 32x32，聊胜于无）
  if (origin) {
    const fav = await tryList(wellKnownFavicon(origin));
    if (fav) return fav;
  }

  // 11. GitHub owner 头像（最后兜底：个人仓库会拿到维护者头像，不是产品 logo）
  const owner = gh?.identifier.split('/')[0];
  if (owner) {
    const url = `https://github.com/${owner}.png?size=192`;
    const img = await fetchImage(url);
    if (img) return { image: img, source: 'github', url };
  }

  return null;
}

/* ───────────────────────── 批量同步 ───────────────────────── */

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** 来源可信度：数字越小越能代表「这个产品」本身。同步时只允许向上升级，
 *  避免某天某个站点抓取抽风，就把昨天的高清官网图换成第三方小图标。 */
export const SOURCE_RANK: Record<IconRecord['source'], number> = {
  override: 0,
  manifest: 1,
  html: 2,
  'well-known': 3,
  readme: 4,
  logo: 5,
  google: 6,
  ddg: 7,
  github: 8,
};

/** 分辨率打分：矢量最高，位图取短边 */
function pixels(r: Pick<IconRecord, 'file' | 'w' | 'h'>): number {
  if (r.file.endsWith('.svg')) return 4096;
  return Math.min(r.w, r.h) || 0;
}

/**
 * 新抓的图能不能替掉上一轮的：
 * - 来源更可信 → 换（但新图小得可怜、旧图又够大时保留旧图）
 * - 来源同级 → 分辨率明显更大才换（避免每日抖动）
 * - 来源更差 → 不换（不能因为官网今天挂了就退化成组织头像）
 */
export function shouldReplace(next: IconRecord, prev: IconRecord): boolean {
  const rn = SOURCE_RANK[next.source] ?? 99;
  const rp = SOURCE_RANK[prev.source] ?? 99;
  const pn = pixels(next);
  const pp = pixels(prev);
  if (rn < rp) return !(pn < 64 && pp >= 128);
  if (rn === rp) {
    if (pn > pp * 1.2) return true;
    // 同尺寸下 png/jpg 优于 ico（favicone 等站点只回 ico，尺寸相同但体积大、兼容性差）
    if (!next.file.endsWith('.ico') && prev.file.endsWith('.ico')) return true;
    return false;
  }
  return false;
}

export async function syncIcons(
  agents: Agent[],
  opts: { dir: string; manifestPath: string; concurrency?: number; log?: (s: string) => void },
): Promise<{ ok: number; failed: string[]; manifest: IconManifest }> {
  const log = opts.log ?? (() => {});
  await mkdir(opts.dir, { recursive: true });

  // 上一轮清单：本轮抓取失败时沿用旧图，避免一次网络抖动就把图标抹成字母块
  let prev: IconManifest = {};
  try {
    prev = JSON.parse(await readFile(opts.manifestPath, 'utf8')) as IconManifest;
  } catch {
    prev = {};
  }
  const exists = (f: string) => access(join(opts.dir, f)).then(() => true, () => false);

  const results = await mapLimit(agents, opts.concurrency ?? 6, async (agent) => {
    try {
      let r = await resolveIcon(agent);
      // 站点偶发 502 / 超时：重试一次，避免图标在两次采集之间无故消失
      if (!r) {
        await new Promise((res) => setTimeout(res, 700));
        r = await resolveIcon(agent);
      }
      return { agent, r };
    } catch (e) {
      return { agent, r: null, err: String(e) };
    }
  });

  const manifest: IconManifest = {};
  const failed: string[] = [];
  const keep = new Set<string>();

  for (const { agent, r } of results) {
    if (!r) {
      const old = prev[agent.slug];
      if (old && (await exists(old.file))) {
        keep.add(old.file);
        manifest[agent.slug] = old;
        log(`  = ${old.file} (本轮抓取失败，沿用上一轮)`);
        continue;
      }
      failed.push(agent.slug);
      continue;
    }
    const hash = createHash('sha1').update(r.image.buf).digest('hex').slice(0, 8);
    const file = `${agent.slug}.${hash}.${r.image.ext}`;
    const record: IconRecord = { file, source: r.source, w: r.image.w, h: r.image.h, url: r.url };

    // 不许降级：官网今天抽风只会拿到低优先级的图，别把昨天的高清图冲掉
    const old = prev[agent.slug];
    if (old && (await exists(old.file)) && !shouldReplace(record, old)) {
      keep.add(old.file);
      manifest[agent.slug] = old;
      if (old.file !== file) log(`  = ${old.file} (${old.source} 优于本轮的 ${record.source}，沿用旧图)`);
      continue;
    }

    keep.add(file);
    manifest[agent.slug] = record;

    const target = join(opts.dir, file);    try {
      await readFile(target);
    } catch {
      await writeFile(target, r.image.buf);
      log(`  + ${file} (${r.source}${r.image.w ? ` ${r.image.w}x${r.image.h}` : ''})`);
    }
  }

  // 清理旧版本文件（内容变化后 hash 会变）
  for (const f of await readdir(opts.dir)) {
    if (f.startsWith('.')) continue;
    if (!keep.has(f)) {
      await unlink(join(opts.dir, f)).catch(() => {});
      log(`  - ${f}`);
    }
  }

  const sorted: IconManifest = {};
  for (const k of Object.keys(manifest).sort()) sorted[k] = manifest[k]!;
  await writeFile(opts.manifestPath, JSON.stringify(sorted, null, 2) + '\n');

  return { ok: Object.keys(manifest).length, failed, manifest: sorted };
}
