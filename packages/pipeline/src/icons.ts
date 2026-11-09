/**
 * 图标缓存：把每个 agent 的 logo 下载到仓库里（packages/web/public/icons）。
 *
 * 为什么要落盘：
 * - 不再依赖 github.com / duckduckgo / google 的实时请求（隐私、稳定性、限流）
 * - 每天采集时刷新，图标跟着产品换 logo 一起更新
 *
 * 取图优先级（越靠前越能代表「这个产品」而不是「这个组织」）：
 *   1. agents.yaml 的 icon: 覆盖（人工校准）
 *   2. 官网 HTML 里声明的图标（apple-touch-icon / icon，按尺寸挑最大）
 *   3. 官网 og:image / twitter:image（仅接受近似正方形，避免拿到宣传大图）
 *   4. 官网约定路径 /apple-touch-icon.png、/apple-touch-icon-precomposed.png
 *   5. 官网 favicon 服务（Google s2 → DuckDuckGo）
 *   6. 官网 /favicon.ico（体积小，最后才用）
 *   7. GitHub owner 头像（开源项目通常就是项目 logo）
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
  source: 'override' | 'html' | 'well-known' | 'github' | 'google' | 'ddg';
  w: number;
  h: number;
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
    const img = await fetchImage(agent.icon);
    if (img) return { image: img, source: 'override', url: agent.icon };
  }

  // 2~6. 官网优先
  const site = siteOrigin(agent);
  if (site) {
    const page = await fetchHtml(site.page);
    // 站点常整体跳转到另一个域名（ai.pydantic.dev → pydantic.dev/docs），
    // 约定路径与 favicon 服务要用跳转后的 origin 才拿得到图。
    let pageOrigin = site.origin;
    // 官网只声明了 32x32 favicon 时，先存着，继续往后找更大的图
    let smallSite: Resolved | null = null;
    if (page) {
      try {
        pageOrigin = new URL(page.url).origin;
      } catch {
        /* 保留原 origin */
      }
      // 2. 页面声明的图标
      const found = await tryList(htmlCandidates(page.html, page.url));
      if (found && (found.image.ext === 'svg' || Math.min(found.image.w, found.image.h) >= 64)) return found;
      smallSite = found;
      // 3. og:image（只认正方形）
      const og = await tryList(metaCandidates(page.html, page.url), false);
      if (og) return og;
    }
    // 4. 约定路径 /apple-touch-icon*.png
    for (const origin of pageOrigin === site.origin ? [site.origin] : [pageOrigin, site.origin]) {
      const wk = await tryList(wellKnown(origin), false);
      if (wk) return wk;
    }

    // 5. 官网 favicon 服务（仍属于官网，优先于 GitHub 组织头像）
    const host = new URL(pageOrigin).hostname;
    const google = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    const g = await fetchImage(google);
    if (g && Math.min(g.w, g.h) >= (smallSite ? 48 : 32)) return { image: g, source: 'google', url: google };
    const ddg = `https://icons.duckduckgo.com/ip3/${host}.ico`;
    const d = await fetchImage(ddg);
    if (d && Math.min(d.w, d.h) >= (smallSite ? 48 : 32)) return { image: d, source: 'ddg', url: ddg };

    // 6. 官网 /favicon.ico（通常 32x32，聊胜于无）
    const fav = await tryList(wellKnownFavicon(pageOrigin));
    if (fav) return smallSite ?? fav;
    if (smallSite) return smallSite;
  }

  // 7. GitHub owner 头像（无官网或官网取不到图时的兜底）
  const gh = agent.sources.find((s) => s.kind === 'github');
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
    keep.add(file);
    manifest[agent.slug] = { file, source: r.source, w: r.image.w, h: r.image.h };

    const target = join(opts.dir, file);
    try {
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
