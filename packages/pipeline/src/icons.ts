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
 *   3. 官网约定路径 /apple-touch-icon.png、/favicon.ico
 *   4. GitHub owner 头像（开源项目通常就是项目 logo）
 *   5. Google s2 / DuckDuckGo favicon 服务
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Agent } from '@agentnews/core';

const UA =
  'Mozilla/5.0 (compatible; AgentNewsBot/1.0; +https://agentnews-c5h.pages.dev)';
const MAX_BYTES = 400 * 1024;

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

async function fetchImage(url: string, timeoutMs = 10_000): Promise<Image | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!/image\//i.test(type) && !/octet-stream/i.test(type)) return null;
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;
    return sniff(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url: string, timeoutMs = 10_000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: ctrl.signal });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html/i.test(type)) return null;
    const text = await res.text();
    return text.slice(0, 600_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ───────────────────────── 官网图标发现 ───────────────────────── */

type Candidate = { url: string; score: number; source: IconRecord['source'] };

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
    try {
      url = new URL(href, pageUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(url)) continue;
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

function wellKnown(origin: string): Candidate[] {
  return [
    { url: `${origin}/apple-touch-icon.png`, score: 180 * 180, source: 'well-known' as const },
    { url: `${origin}/apple-touch-icon-precomposed.png`, score: 170 * 170, source: 'well-known' as const },
    { url: `${origin}/favicon.ico`, score: 32 * 32, source: 'well-known' as const },
  ];
}

/* ───────────────────────── 单个 agent ───────────────────────── */

type Resolved = { image: Image; source: IconRecord['source']; url: string };

export async function resolveIcon(agent: Agent): Promise<Resolved | null> {
  const tryList = async (cands: Candidate[]): Promise<Resolved | null> => {
    let best: Resolved | null = null;
    for (const c of cands.slice(0, 6)) {
      const img = await fetchImage(c.url);
      if (!img) continue;
      const isVector = img.ext === 'svg';
      const big = isVector || Math.min(img.w, img.h) >= 64;
      if (big) return { image: img, source: c.source, url: c.url };
      if (!best || Math.min(img.w, img.h) > Math.min(best.image.w, best.image.h)) {
        best = { image: img, source: c.source, url: c.url };
      }
    }
    return best;
  };

  // 1. 人工覆盖
  if (agent.icon) {
    const img = await fetchImage(agent.icon);
    if (img) return { image: img, source: 'override', url: agent.icon };
  }

  // 2. 官网声明的图标
  //    注意：主页就是 GitHub 仓库时，页面里声明的 icon 是 GitHub 自己的 favicon，
  //    必须跳过，否则每个开源项目都会变成 GitHub 章鱼猫。
  const isGitHubHome = !!agent.homepage && /^https?:\/\/(www\.)?github\.com\//i.test(agent.homepage);
  let origin: string | null = null;
  if (agent.homepage && !isGitHubHome) {
    try {
      const u = new URL(agent.homepage);
      origin = u.origin;
      const html = await fetchHtml(u.toString());
      if (html) {
        const found = await tryList(htmlCandidates(html, u.toString()));
        if (found && (found.image.ext === 'svg' || Math.min(found.image.w, found.image.h) >= 64)) return found;
        if (found) return found;
      }
      const wk = await tryList(wellKnown(origin));
      if (wk) return wk;
    } catch {
      origin = null;
    }
  }

  // 3. GitHub owner 头像
  const gh = agent.sources.find((s) => s.kind === 'github');
  const owner = gh?.identifier.split('/')[0];
  if (owner) {
    const url = `https://github.com/${owner}.png?size=192`;
    const img = await fetchImage(url);
    if (img) return { image: img, source: 'github', url };
  }

  // 4. favicon 服务
  if (origin) {
    const host = new URL(origin).hostname;
    const google = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    const g = await fetchImage(google);
    if (g) return { image: g, source: 'google', url: google };
    const ddg = `https://icons.duckduckgo.com/ip3/${host}.ico`;
    const d = await fetchImage(ddg);
    if (d) return { image: d, source: 'ddg', url: ddg };
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
