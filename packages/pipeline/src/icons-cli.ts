/**
 * 单独同步图标（不采集指标）：pnpm --filter @agentnews/pipeline icons
 * 日常由 runDaily 自动调用，这里用于调试或首次填充。
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAgents } from './run.js';
import { syncIcons } from './icons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const agents = await loadAgents();
console.log(`[icons] ${agents.length} agents`);

const r = await syncIcons(agents, {
  dir: join(ROOT, 'packages', 'web', 'public', 'icons'),
  manifestPath: join(ROOT, 'data', 'icons.json'),
  concurrency: 6,
  log: (s) => console.log(`[icons]${s}`),
});

console.log(`[icons] 完成 ${r.ok}/${agents.length}`);
if (r.failed.length) console.log(`[icons] 失败（将回退首字母块）：${r.failed.join(', ')}`);
