/**
 * 图标体检：`pnpm icons:audit`
 *
 * 自动取图再完善也会有落空的（官网是 SPA / 反爬 / 只给 32px favicon），
 * 这个命令把「谁退化到了低优先级来源」摊开来看，方便在 agents.yaml 里
 * 加 icon: 覆盖做人工校准。
 *
 * 标记含义：
 *   ⚠️ github  —— 用了 GitHub owner 头像兜底：开源组织通常没问题，
 *                  个人仓库会拿到维护者头像（pi 就是踩了这个坑）
 *   ⚠️ 低清    —— .ico 或 < 64px，实际渲染会糊
 *   ⚠️ 重复    —— 多个 agent 共用同一张图，多半都是同一个组织 logo
 *   ❌ 缺图    —— 完全没有，站点会退化成首字母块
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, stat } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { IconManifest } from './icons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ICON_DIR = join(ROOT, 'packages', 'web', 'public', 'icons');
const strict = process.argv.includes('--strict');

type AgentRow = { slug: string; name: string; homepage?: string; oss_bucket?: string };

const doc = parseYaml(await readFile(join(ROOT, 'agents.yaml'), 'utf8')) as AgentRow[];
const manifest = JSON.parse(await readFile(join(ROOT, 'data', 'icons.json'), 'utf8')) as IconManifest;
const files = new Set(await readdir(ICON_DIR));

const byHash = new Map<string, string[]>();
for (const [slug, rec] of Object.entries(manifest)) {
  const hash = rec.file.split('.')[1] ?? rec.file;
  byHash.set(hash, [...(byHash.get(hash) ?? []), slug]);
}

const missing: string[] = [];
const suspicious: { slug: string; why: string }[] = [];
const rows: string[] = [];

for (const a of doc) {
  const rec = manifest[a.slug];
  if (!rec) {
    missing.push(a.slug);
    rows.push(`❌ ${a.slug.padEnd(22)} 缺图`);
    continue;
  }
  const flags: string[] = [];
  const fileOk = files.has(rec.file);
  if (!fileOk) flags.push('文件缺失');
  if (rec.source === 'github') flags.push('github头像');
  const min = Math.min(rec.w, rec.h);
  if (rec.file.endsWith('.ico')) flags.push('ico');
  else if (min > 0 && min < 64) flags.push(`低清${rec.w}x${rec.h}`);
  const dup = byHash.get(rec.file.split('.')[1] ?? '') ?? [];
  if (dup.length > 1) flags.push(`与${dup.filter((s) => s !== a.slug).join('/')}共用`);

  let size = 0;
  try {
    size = (await stat(join(ICON_DIR, rec.file))).size;
  } catch {
    /* 文件缺失已标记 */
  }
  const dim = rec.w ? `${rec.w}x${rec.h}` : '矢量';
  const from = rec.url ? `  ← ${rec.url.replace(/^https?:\/\//, '').slice(0, 60)}` : '';
  rows.push(
    `${flags.length ? '⚠️' : '✅'} ${a.slug.padEnd(22)} ${rec.source.padEnd(10)} ${dim.padEnd(10)} ${String(Math.round(size / 1024)).padStart(4)}KB  ${rec.file}${flags.length ? '  ← ' + flags.join(', ') : ''}`,
  );
  if (flags.length) suspicious.push({ slug: a.slug, why: flags.join(',') + (from ? `  ${from.trim()}` : '') });
}

console.log(rows.join('\n'));

const dupGroups = [...byHash.entries()].filter(([, slugs]) => slugs.length > 1);
console.log('\n── 汇总 ─────────────────────────────');
console.log(`agent 总数      ${doc.length}`);
console.log(`有图            ${Object.keys(manifest).length}`);
console.log(`缺图            ${missing.length}${missing.length ? ' → ' + missing.join(', ') : ''}`);
console.log(`需人工核对      ${suspicious.length}`);
if (dupGroups.length) {
  console.log('\n共用同一张图（同一个组织 logo 的可能性高）：');
  for (const [, slugs] of dupGroups) console.log(`  ${slugs.join(', ')}`);
}
if (suspicious.length) {
  console.log('\n需人工核对（在 agents.yaml 里加 icon: 覆盖）：');
  for (const s of suspicious) console.log(`  ${s.slug.padEnd(22)} ${s.why}`);
}
const bySrc: Record<string, number> = {};
for (const rec of Object.values(manifest)) bySrc[rec.source] = (bySrc[rec.source] ?? 0) + 1;
console.log('\n来源分布：', Object.entries(bySrc).map(([k, v]) => `${k}=${v}`).join('  '));

if (strict && (missing.length || suspicious.length)) {
  console.error('\n[strict] 存在缺图或需人工核对的图标');
  process.exit(1);
}
