/**
 * 单独同步图标（不采集指标）：
 *   pnpm icons                     全部 agent
 *   pnpm icons -- --only=pi,devin  只重抓指定的几个（合并进现有清单，不清理其他图标）
 *
 * 日常由 runDaily 自动调用，这里用于调试、加 icon: 覆盖后立即验证。
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadAgents } from './run.js';
import { resolveIcon, syncIcons, type IconManifest } from './icons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIR = join(ROOT, 'packages', 'web', 'public', 'icons');
const MANIFEST = join(ROOT, 'data', 'icons.json');

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : [];

const all = await loadAgents();

if (!only.length) {
  console.log(`[icons] ${all.length} agents`);
  const r = await syncIcons(all, {
    dir: DIR,
    manifestPath: MANIFEST,
    concurrency: 6,
    log: (s) => console.log(`[icons]${s}`),
  });
  console.log(`[icons] 完成 ${r.ok}/${all.length}`);
  if (r.failed.length) console.log(`[icons] 失败（将回退首字母块）：${r.failed.join(', ')}`);
} else {
  // 局部重抓：只动指定 slug，其余条目与文件原样保留
  const agents = all.filter((a) => only.includes(a.slug));
  const unknown = only.filter((s) => !agents.some((a) => a.slug === s));
  if (unknown.length) console.log(`[icons] 跳过（不在 agents.yaml）：${unknown.join(', ')}`);

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as IconManifest;
  const existing = new Set(await readdir(DIR));

  for (const agent of agents) {
    const r = await resolveIcon(agent);
    if (!r) {
      console.log(`[icons] ! ${agent.slug} 取图失败`);
      continue;
    }
    const hash = createHash('sha1').update(r.image.buf).digest('hex').slice(0, 8);
    const file = `${agent.slug}.${hash}.${r.image.ext}`;
    if (!existing.has(file)) await writeFile(join(DIR, file), r.image.buf);
    const old = manifest[agent.slug]?.file;
    manifest[agent.slug] = { file, source: r.source, w: r.image.w, h: r.image.h, url: r.url };
    console.log(`[icons] + ${agent.slug}: ${file} (${r.source}${r.image.w ? ` ${r.image.w}x${r.image.h}` : ''}) ← ${r.url}`);
    if (old && old !== file) {
      await unlink(join(DIR, old)).catch(() => {});
      console.log(`[icons] - ${old}`);
    }
  }

  const sorted: IconManifest = {};
  for (const k of Object.keys(manifest).sort()) sorted[k] = manifest[k]!;
  await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`[icons] 已更新 ${agents.length} 个（其余保持不变）`);
}
